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

const initialState = {
  fieldData:        {},
  collaboration:    {},
  audit:            [],   // [{ id, fieldId, action, by, byName, at, meta }]
  validationErrors: {},
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
          meta: { queryId: payload.query.id, title: payload.query.title },
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
            status:      'Open',
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

    /* ── Init / Reset ───────────────────────────────────────────────────── */
    hydrateRuntime(state, { payload }) {
      // Replace the runtime state from a saved snapshot — used when the user
      // opens an existing response.
      const next = payload ?? {};
      state.fieldData        = next.fieldData        ?? {};
      state.collaboration    = next.collaboration    ?? {};
      state.audit            = next.audit            ?? [];
      state.validationErrors = {};
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

export default formRuntimeSlice.reducer;
