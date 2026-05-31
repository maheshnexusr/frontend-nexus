/**
 * formRuntimeSlice — runtime state for the form (Step 4 preview / live form).
 *
 * Strictly separated from studyFormSlice (which holds the field *configuration*).
 * The runtime slice owns:
 *   - fieldData          : { [fieldId]: value }
 *   - collaboration      : { [fieldId]: { annotations, notes, queries,
 *                                        attachments, verification } }
 *   - audit              : flat array of all actions (newest first when read)
 *   - validationErrors   : { [fieldId]: string | null }
 *
 * Every collaboration mutation emits a corresponding audit entry through the
 * shared `pushAudit` helper, so consumers never have to log manually.
 */

import { createSlice, nanoid } from '@reduxjs/toolkit';

/* ── Empty buckets ───────────────────────────────────────────────────────── */
const emptyBucket = () => ({
  annotations: [],
  notes:       [],
  queries:     [],
  attachments: [],
  verification: { verified: false, verifiedBy: null, verifiedAt: null, verifiedByName: null },
});

/* ── Form status workflow ──────────────────────────────────────────────────
 * Single source of truth for the lifecycle of a form instance. Transitions
 * fan out to:
 *   - Field editability (Locked / Signed / Frozen → no edits anywhere)
 *   - Action visibility in the runner footer (Mark Completed, Verify,
 *     Freeze, Lock, Sign, Reopen)
 *   - The status pill rendered in the runner top bar
 *
 * Valid statuses: 'In Progress' | 'Completed' | 'Reviewed' | 'Verified' |
 *                 'Frozen' | 'Locked' | 'Signed'
 */
export const FORM_STATUSES = [
  'In Progress',
  'Completed',
  'Reviewed',
  'Verified',
  'Approved',     // Phase 3 — Medical Reviewer approval
  'Frozen',
  'Locked',
  'Signed',
];

export const FORM_STATUS_META = {
  'In Progress': { color: '#475569', bg: '#f1f5f9' },
  'Completed':   { color: '#1d4ed8', bg: '#dbeafe' },
  'Reviewed':    { color: '#0e7490', bg: '#cffafe' },
  'Verified':    { color: '#15803d', bg: '#dcfce7' },
  'Approved':    { color: '#0f766e', bg: '#ccfbf1' },
  'Frozen':      { color: '#1e40af', bg: '#dbeafe' },
  'Locked':      { color: '#92400e', bg: '#fef3c7' },
  'Signed':      { color: '#6d28d9', bg: '#ede9fe' },
};

/** Statuses that block ANY data edit (form-wide). */
export const READ_ONLY_STATUSES = new Set(['Frozen', 'Locked', 'Signed']);

/**
 * Spec §VM auto-reset: editing data on a page that has already been
 * Reviewed / Verified / Approved invalidates the prior review and bounces
 * the form back to "In Progress" so a CRA / DM must re-run the cascade.
 * Frozen/Locked/Signed already block edits at the gate layer, so they
 * never reach the reset path.
 */
const POST_REVIEW_STATUSES = new Set(['Reviewed', 'Verified', 'Approved']);

const initialState = {
  fieldData:        {},
  collaboration:    {},
  audit:            [],   // [{ id, fieldId, action, by, byName, at, meta }]
  validationErrors: {},

  // ─ Form status workflow ─
  formStatus:        'In Progress',
  formStatusHistory: [],  // [{ from, to, by, byName, at, reason }]
  fieldLocks:        {},  // { [fieldId]: { locked, frozen, by, byName, at, reason } }

  // ─ Phase 3 — signature + approval record ─
  formSignature:     null, // { by, byName, role, at, attestation, hash, revokedAt, revokedBy }
  formApproval:      null, // { by, byName, role, at, comment, revokedAt, revokedBy }
};

/* ── Helpers (mutate state in place — RTK uses immer) ─────────────────────── */
function ensureBucket(state, fieldId) {
  if (!state.collaboration[fieldId]) {
    state.collaboration[fieldId] = emptyBucket();
  }
  return state.collaboration[fieldId];
}

function pushAudit(state, entry) {
  state.audit.unshift({
    id: nanoid(),
    at: new Date().toISOString(),
    ...entry,
  });
}

/**
 * Spec §VM: when a verified field is edited, its verification is invalidated
 * and the parent form bounces out of any post-review status so the CRA must
 * re-run the cascade. Both events are audited so the reviewer can trace why
 * a previously Verified page suddenly went back to In Progress.
 */
function resetVerificationOnEdit(state, fieldId, by, byName) {
  const bucket = state.collaboration[fieldId];
  if (bucket?.verification?.verified) {
    bucket.verification = {
      verified: false,
      verifiedBy: null,
      verifiedByName: null,
      verifiedAt: null,
      comment: null,
    };
    pushAudit(state, {
      fieldId,
      action: 'verification.auto_reset',
      by,
      byName,
      meta: { reason: 'Field value changed after verification — Not Verified.' },
    });
  }
  if (POST_REVIEW_STATUSES.has(state.formStatus)) {
    const from = state.formStatus;
    state.formStatus = 'In Progress';
    state.formStatusHistory.push({
      from,
      to: 'In Progress',
      by,
      byName,
      at: new Date().toISOString(),
      reason: 'Auto-reset: data edited after page was reviewed/verified.',
    });
    pushAudit(state, {
      fieldId,
      action: 'form.status.auto_reset',
      by,
      byName,
      meta: { from, to: 'In Progress' },
    });
  }
}

/* ── Slice ────────────────────────────────────────────────────────────────── */
const formRuntimeSlice = createSlice({
  name: 'formRuntime',
  initialState,
  reducers: {
    /* ── Form values ────────────────────────────────────────────────────── */
    setFieldValue: {
      reducer(state, { payload }) {
        const { fieldId, value, label, by, byName } = payload;
        const old = state.fieldData[fieldId]?.value;
        state.fieldData[fieldId] = { value, label };
        if (old !== value) {
          pushAudit(state, {
            fieldId, action: 'value.changed', by, byName,
            meta: { oldValue: old ?? null, newValue: value },
          });
          resetVerificationOnEdit(state, fieldId, by, byName);
        }
      },
      prepare: (payload) => ({ payload }),
    },

    clearField(state, { payload }) {
      const { fieldId, by, byName } = payload;
      const old = state.fieldData[fieldId]?.value;
      delete state.fieldData[fieldId];
      pushAudit(state, {
        fieldId, action: 'value.cleared', by, byName,
        meta: { oldValue: old ?? null },
      });
      resetVerificationOnEdit(state, fieldId, by, byName);
    },

    /* ── Annotations ────────────────────────────────────────────────────── */
    addAnnotation: {
      reducer(state, { payload }) {
        const bucket = ensureBucket(state, payload.fieldId);
        bucket.annotations.push(payload.annotation);
        pushAudit(state, {
          fieldId: payload.fieldId, action: 'annotation.added',
          by: payload.annotation.createdBy, byName: payload.annotation.createdByName,
          meta: { annotationId: payload.annotation.id, comment: payload.annotation.comment },
        });
      },
      prepare: ({ fieldId, comment, by, byName }) => ({
        payload: {
          fieldId,
          annotation: {
            id: nanoid(),
            comment,
            createdBy: by,
            createdByName: byName,
            createdAt: new Date().toISOString(),
            resolved: false,
          },
        },
      }),
    },

    resolveAnnotation(state, { payload }) {
      const { fieldId, annotationId, by, byName } = payload;
      const bucket = ensureBucket(state, fieldId);
      const a = bucket.annotations.find((x) => x.id === annotationId);
      if (!a) return;
      a.resolved        = true;
      a.resolvedBy      = by;
      a.resolvedByName  = byName;
      a.resolvedAt      = new Date().toISOString();
      pushAudit(state, {
        fieldId, action: 'annotation.resolved', by, byName,
        meta: { annotationId },
      });
    },

    deleteAnnotation(state, { payload }) {
      const { fieldId, annotationId, by, byName } = payload;
      const bucket = ensureBucket(state, fieldId);
      bucket.annotations = bucket.annotations.filter((x) => x.id !== annotationId);
      pushAudit(state, { fieldId, action: 'annotation.deleted', by, byName, meta: { annotationId } });
    },

    /* ── Notes ──────────────────────────────────────────────────────────── */
    addNote: {
      reducer(state, { payload }) {
        const bucket = ensureBucket(state, payload.fieldId);
        bucket.notes.push(payload.note);
        pushAudit(state, {
          fieldId: payload.fieldId, action: 'note.added',
          by: payload.note.createdBy, byName: payload.note.createdByName,
          meta: { noteId: payload.note.id },
        });
      },
      prepare: ({ fieldId, text, by, byName }) => ({
        payload: {
          fieldId,
          note: {
            id: nanoid(),
            text,
            createdBy: by,
            createdByName: byName,
            createdAt: new Date().toISOString(),
          },
        },
      }),
    },

    updateNote(state, { payload }) {
      const { fieldId, noteId, text, by, byName } = payload;
      const bucket = ensureBucket(state, fieldId);
      const n = bucket.notes.find((x) => x.id === noteId);
      if (!n) return;
      n.text       = text;
      n.updatedAt  = new Date().toISOString();
      n.updatedBy  = by;
      pushAudit(state, { fieldId, action: 'note.updated', by, byName, meta: { noteId } });
    },

    deleteNote(state, { payload }) {
      const { fieldId, noteId, by, byName } = payload;
      const bucket = ensureBucket(state, fieldId);
      bucket.notes = bucket.notes.filter((x) => x.id !== noteId);
      pushAudit(state, { fieldId, action: 'note.deleted', by, byName, meta: { noteId } });
    },

    /* ── Queries ────────────────────────────────────────────────────────── */
    addQuery: {
      reducer(state, { payload }) {
        const bucket = ensureBucket(state, payload.fieldId);
        bucket.queries.push(payload.query);
        pushAudit(state, {
          fieldId: payload.fieldId, action: 'query.raised',
          by: payload.query.createdBy, byName: payload.query.createdByName,
          meta: {
            queryId:    payload.query.id,
            title:      payload.query.title,
            priority:   payload.query.priority,
            assignedTo: payload.query.assignedTo,
            status:     payload.query.status,
          },
        });
      },
      prepare: ({ fieldId, title, description, priority, assignedTo, by, byName }) => ({
        payload: {
          fieldId,
          query: {
            id: nanoid(),
            title,
            description,
            priority:    priority    ?? 'Medium',  // Low | Medium | High | Critical
            assignedTo:  assignedTo  ?? null,
            status:      'Raised',
            createdBy:   by,
            createdByName: byName,
            createdAt:   new Date().toISOString(),
            history:     [],
          },
        },
      }),
    },

    updateQueryStatus(state, { payload }) {
      const { fieldId, queryId, status, response, by, byName } = payload;
      const bucket = ensureBucket(state, fieldId);
      const q = bucket.queries.find((x) => x.id === queryId);
      if (!q) return;
      const old = q.status;
      q.status     = status;
      q.updatedAt  = new Date().toISOString();
      q.history    = q.history ?? [];
      q.history.push({ at: q.updatedAt, by, byName, from: old, to: status, response: response ?? null });
      pushAudit(state, {
        fieldId, action: 'query.statusChanged', by, byName,
        meta: { queryId, from: old, to: status, response: response ?? null },
      });
    },

    deleteQuery(state, { payload }) {
      const { fieldId, queryId, by, byName } = payload;
      const bucket = ensureBucket(state, fieldId);
      bucket.queries = bucket.queries.filter((x) => x.id !== queryId);
      pushAudit(state, { fieldId, action: 'query.deleted', by, byName, meta: { queryId } });
    },

    /* ── Attachments ────────────────────────────────────────────────────── */
    addAttachment: {
      reducer(state, { payload }) {
        const bucket = ensureBucket(state, payload.fieldId);
        bucket.attachments.push(payload.attachment);
        pushAudit(state, {
          fieldId: payload.fieldId, action: 'attachment.added',
          by: payload.attachment.uploadedBy, byName: payload.attachment.uploadedByName,
          meta: { attachmentId: payload.attachment.id, fileName: payload.attachment.fileName },
        });
      },
      prepare: ({ fieldId, fileName, fileUrl, fileSize, fileType, by, byName }) => ({
        payload: {
          fieldId,
          attachment: {
            id: nanoid(),
            fileName,
            fileUrl,
            fileSize:        fileSize ?? null,
            fileType:        fileType ?? '',
            uploadedBy:      by,
            uploadedByName:  byName,
            uploadedAt:      new Date().toISOString(),
          },
        },
      }),
    },

    removeAttachment(state, { payload }) {
      const { fieldId, attachmentId, by, byName } = payload;
      const bucket = ensureBucket(state, fieldId);
      const a = bucket.attachments.find((x) => x.id === attachmentId);
      bucket.attachments = bucket.attachments.filter((x) => x.id !== attachmentId);
      pushAudit(state, {
        fieldId, action: 'attachment.removed', by, byName,
        meta: { attachmentId, fileName: a?.fileName ?? '' },
      });
    },

    /* ── Verification ───────────────────────────────────────────────────── */
    setVerification(state, { payload }) {
      const { fieldId, verified, by, byName, comment } = payload;
      const bucket = ensureBucket(state, fieldId);
      bucket.verification = {
        verified,
        verifiedBy:     verified ? by      : null,
        verifiedByName: verified ? byName  : null,
        verifiedAt:     verified ? new Date().toISOString() : null,
        comment:        comment ?? null,
      };
      pushAudit(state, {
        fieldId,
        action: verified ? 'verification.verified' : 'verification.unverified',
        by, byName,
        meta: { comment: comment ?? null },
      });
    },

    /* ── Validation ─────────────────────────────────────────────────────── */
    setValidationError(state, { payload }) {
      const { fieldId, error } = payload;
      if (error) state.validationErrors[fieldId] = error;
      else delete state.validationErrors[fieldId];
    },

    /* ── Form Status transitions ───────────────────────────────────────── */
    setFormStatus(state, { payload }) {
      const { to, by, byName, reason } = payload;
      if (!FORM_STATUSES.includes(to)) return;
      const from = state.formStatus;
      if (from === to) return;
      state.formStatus = to;
      state.formStatusHistory.push({
        from, to, by, byName, reason: reason || null,
        at: new Date().toISOString(),
      });
      pushAudit(state, {
        fieldId: null,
        action:  'form.statusChanged',
        by, byName,
        meta:    { from, to, reason: reason || null },
      });
    },

    /* ── Per-field lock / freeze ───────────────────────────────────────── */
    lockField(state, { payload }) {
      const { fieldId, by, byName, reason } = payload;
      state.fieldLocks[fieldId] = {
        ...(state.fieldLocks[fieldId] ?? {}),
        locked: true, frozen: state.fieldLocks[fieldId]?.frozen ?? false,
        by, byName, at: new Date().toISOString(),
        reason: reason || null,
      };
      pushAudit(state, {
        fieldId, action: 'field.locked', by, byName,
        meta: { reason: reason || null },
      });
    },

    unlockField(state, { payload }) {
      const { fieldId, by, byName, reason } = payload;
      const cur = state.fieldLocks[fieldId];
      if (!cur?.locked) return;
      state.fieldLocks[fieldId] = { ...cur, locked: false };
      pushAudit(state, {
        fieldId, action: 'field.unlocked', by, byName,
        meta: { reason: reason || null },
      });
    },

    freezeField(state, { payload }) {
      const { fieldId, by, byName, reason } = payload;
      state.fieldLocks[fieldId] = {
        ...(state.fieldLocks[fieldId] ?? {}),
        frozen: true, locked: state.fieldLocks[fieldId]?.locked ?? false,
        by, byName, at: new Date().toISOString(),
        reason: reason || null,
      };
      pushAudit(state, {
        fieldId, action: 'field.frozen', by, byName,
        meta: { reason: reason || null },
      });
    },

    unfreezeField(state, { payload }) {
      const { fieldId, by, byName, reason } = payload;
      const cur = state.fieldLocks[fieldId];
      if (!cur?.frozen) return;
      state.fieldLocks[fieldId] = { ...cur, frozen: false };
      pushAudit(state, {
        fieldId, action: 'field.unfrozen', by, byName,
        meta: { reason: reason || null },
      });
    },

    /* ── Phase 3 — Signature + Approval records ────────────────────────── */
    signForm(state, { payload }) {
      const { by, byName, role, attestation, hash } = payload;
      const at = new Date().toISOString();
      state.formSignature = {
        by, byName, role: role || null,
        at, attestation: attestation || '', hash: hash || null,
        revokedAt: null, revokedBy: null,
      };
      const from = state.formStatus;
      state.formStatus = 'Signed';
      state.formStatusHistory.push({
        from, to: 'Signed', by, byName,
        reason: attestation || 'Form signed', at,
      });
      pushAudit(state, {
        fieldId: null, action: 'form.signed', by, byName,
        meta: { from, attestation: attestation || null },
      });
    },

    revokeSignature(state, { payload }) {
      const { by, byName, reason } = payload;
      if (!state.formSignature) return;
      const at = new Date().toISOString();
      state.formSignature = { ...state.formSignature, revokedAt: at, revokedBy: by };
      const from = state.formStatus;
      state.formStatus = 'Reviewed';
      state.formStatusHistory.push({ from, to: 'Reviewed', by, byName, reason: reason || null, at });
      pushAudit(state, {
        fieldId: null, action: 'form.signatureRevoked', by, byName,
        meta: { from, reason: reason || null },
      });
    },

    approveForm(state, { payload }) {
      const { by, byName, role, comment } = payload;
      const at = new Date().toISOString();
      state.formApproval = {
        by, byName, role: role || null,
        at, comment: comment || '',
        revokedAt: null, revokedBy: null,
      };
      const from = state.formStatus;
      state.formStatus = 'Approved';
      state.formStatusHistory.push({ from, to: 'Approved', by, byName, reason: comment || null, at });
      pushAudit(state, {
        fieldId: null, action: 'form.approved', by, byName,
        meta: { from, comment: comment || null },
      });
    },

    revokeApproval(state, { payload }) {
      const { by, byName, reason } = payload;
      if (!state.formApproval) return;
      const at = new Date().toISOString();
      state.formApproval = { ...state.formApproval, revokedAt: at, revokedBy: by };
      const from = state.formStatus;
      state.formStatus = 'Reviewed';
      state.formStatusHistory.push({ from, to: 'Reviewed', by, byName, reason: reason || null, at });
      pushAudit(state, {
        fieldId: null, action: 'form.approvalRevoked', by, byName,
        meta: { from, reason: reason || null },
      });
    },

    /* ── Init / Reset ───────────────────────────────────────────────────── */
    hydrateRuntime(state, { payload }) {
      // Replace the runtime state from a saved snapshot — used when the user
      // opens an existing response.
      const next = payload ?? {};
      state.fieldData         = next.fieldData         ?? {};
      state.collaboration     = next.collaboration     ?? {};
      state.audit             = next.audit             ?? [];
      state.validationErrors  = {};
      state.formStatus        = next.formStatus        ?? 'In Progress';
      state.formStatusHistory = next.formStatusHistory ?? [];
      state.fieldLocks        = next.fieldLocks        ?? {};
      state.formSignature     = next.formSignature     ?? null;
      state.formApproval      = next.formApproval      ?? null;
    },

    resetRuntime() { return initialState; },
  },
});

export const {
  setFieldValue,
  clearField,
  addAnnotation,
  resolveAnnotation,
  deleteAnnotation,
  addNote,
  updateNote,
  deleteNote,
  addQuery,
  updateQueryStatus,
  deleteQuery,
  addAttachment,
  removeAttachment,
  setVerification,
  setValidationError,
  hydrateRuntime,
  resetRuntime,
  // Phase 1 — form status workflow
  setFormStatus,
  lockField, unlockField, freezeField, unfreezeField,
  // Phase 3 — signature + approval
  signForm, revokeSignature, approveForm, revokeApproval,
} = formRuntimeSlice.actions;

/* ── Selectors ─────────────────────────────────────────────────────────────── */
export const selectFieldValue = (fieldId) => (s) => s.formRuntime.fieldData[fieldId]?.value;
export const selectFieldBucket = (fieldId) => (s) =>
  s.formRuntime.collaboration[fieldId] ?? emptyBucket();
export const selectFieldErrors = (fieldId) => (s) => s.formRuntime.validationErrors[fieldId] ?? null;
export const selectAuditForField = (fieldId) => (s) =>
  s.formRuntime.audit.filter((a) => a.fieldId === fieldId);
export const selectAllAudit = (s) => s.formRuntime.audit;
export const selectAllFieldData = (s) => s.formRuntime.fieldData;

/* ── Phase 1 — Form status / field-lock selectors ───────────────────────── */
export const selectFormStatus        = (s) => s.formRuntime.formStatus;
export const selectFormStatusHistory = (s) => s.formRuntime.formStatusHistory;
/** { locked, frozen, by, byName, at, reason } or {} when neither. */
export const selectFieldLock         = (fieldId) => (s) =>
  s.formRuntime.fieldLocks[fieldId] ?? {};

/* ── Phase 3 — signature + approval selectors ───────────────────────────── */
export const selectFormSignature = (s) => s.formRuntime.formSignature;
export const selectFormApproval  = (s) => s.formRuntime.formApproval;

export default formRuntimeSlice.reducer;
