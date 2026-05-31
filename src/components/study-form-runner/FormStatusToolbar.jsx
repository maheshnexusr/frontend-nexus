/**
 * FormStatusToolbar — top-of-form bar that shows the current status pill
 * and renders the next-legal-transition buttons based on role × status.
 *
 * Each transition that needs justification (Freeze/Lock/Unfreeze/Unlock/
 * Revoke Signature) opens a small reason prompt before dispatching.
 *
 * Backed by `useFormGate()` for status + role gating and the
 * formRuntimeSlice transition reducers for state changes.
 */

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Eye, Snowflake, Lock, X,
  AlertTriangle,
} from 'lucide-react';
import {
  setFormStatus, approveForm, revokeApproval, setVerification,
  selectAllFieldData,
  FORM_STATUS_META,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { useFormGate } from '@/features/cro/components/study-form/runtime/useFormGate';
import SignFormModal from './SignFormModal';

// Field `type` values that don't capture data (headings, paragraphs, dividers).
// Kept aligned with StudyFormRunner's isLayout check.
const LAYOUT_TYPES = new Set(['h2', 'paragraph', 'divider']);

const isEmptyValue = (v) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// `kind` controls the click-handler path:
//   'transition'  → setFormStatus dispatch (with optional reason prompt)
//   'sign'        → opens SignFormModal (full attestation flow)
//   'approve'     → dispatches approveForm with a comment
//   'revokeApprove' → dispatches revokeApproval with a reason
// The legacy browser-only status chain (Mark Completed / Reviewed / Verified),
// Approve and Sign actions were never persisted and are superseded by the
// persisted footer flow: Save → Mark Page Completed → Verify Page → Submit.
// Only the form-protection actions (Freeze / Lock) remain in this toolbar.
const TRANSITIONS = [
  { kind: 'transition', to: 'Frozen',    label: 'Freeze Form', Icon: Snowflake, gateKey: 'canFreezeForm',   needsReason: true  },
  { kind: 'transition', to: 'In Progress', label: 'Unfreeze',  Icon: Snowflake, gateKey: 'canUnfreezeForm', needsReason: true, variant: 'subtle' },
  { kind: 'transition', to: 'Locked',    label: 'Lock Form',   Icon: Lock,      gateKey: 'canLockForm',     needsReason: true  },
  { kind: 'transition', to: 'In Progress', label: 'Unlock',    Icon: Lock,      gateKey: 'canUnlockForm',   needsReason: true, variant: 'subtle' },
];

const PILL_STYLE = (meta) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: meta?.bg ?? '#f1f5f9',
  color: meta?.color ?? '#475569',
  whiteSpace: 'nowrap',
});

const BTN_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 7,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid transparent',
};

const VARIANT = {
  primary: { background: '#2563eb', color: '#fff' },
  subtle:  { background: '#fff', color: '#475569', borderColor: '#cbd5e1' },
};

export default function FormStatusToolbar({ pageFields = [], pageTitle = '' }) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const gate     = useFormGate(null);

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const [prompt, setPrompt] = useState(null);   // { kind, to?, label, reason }
  const [signOpen, setSignOpen] = useState(false);
  // Spec §VM (CRA flow): Page-level "Mark as Reviewed" runs a mandatory-field
  // check + a confirm popup + cascade-verifies every field on the page before
  // transitioning the form status to Reviewed.
  const [reviewOpen, setReviewOpen] = useState(false);

  const apply = (kind, to, reason) => {
    if (kind === 'transition') {
      dispatch(setFormStatus({ to, ...me, reason }));
    } else if (kind === 'approve') {
      dispatch(approveForm({ ...me, role: user?.roleName ?? null, comment: reason || '' }));
    } else if (kind === 'revokeApprove') {
      dispatch(revokeApproval({ ...me, reason: reason || '' }));
    }
    setPrompt(null);
  };

  const onClickTransition = (t) => {
    if (t.kind === 'sign') {
      setSignOpen(true);
      return;
    }
    // Page-level Mark as Reviewed has its own dialog (mandatory-fields gate
    // + cascade verification). The generic reason prompt won't do.
    if (t.kind === 'transition' && t.to === 'Reviewed' && t.label === 'Mark Reviewed') {
      setReviewOpen(true);
      return;
    }
    if (t.needsReason) {
      setPrompt({ kind: t.kind, to: t.to, label: t.label, reason: '' });
    } else {
      apply(t.kind, t.to, null);
    }
  };

  const available = TRANSITIONS.filter((t) => gate[t.gateKey]);
  const meta      = FORM_STATUS_META[gate.formStatus];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '10px 16px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        marginBottom: 12,
      }}
    >
      <span style={PILL_STYLE(meta)} title={`Form status: ${gate.formStatus}`}>
        {gate.formStatus}
      </span>

      {gate.anyReadOnly && (
        <span style={{ fontSize: 11.5, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Lock size={11} /> Read-only — no edits allowed
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {available.length === 0 ? (
          <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
            No actions available
          </span>
        ) : available.map((t) => (
          <button
            key={`${t.gateKey}-${t.to}`}
            type="button"
            onClick={() => onClickTransition(t)}
            style={{ ...BTN_BASE, ...(t.variant === 'subtle' ? VARIANT.subtle : VARIANT.primary) }}
            title={`${t.label} → ${t.to}`}
          >
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {prompt && (
        <ReasonPrompt
          label={prompt.label}
          value={prompt.reason}
          onChange={(reason) => setPrompt((p) => ({ ...p, reason }))}
          onConfirm={() => apply(prompt.kind, prompt.to, prompt.reason)}
          onCancel={() => setPrompt(null)}
        />
      )}

      <SignFormModal open={signOpen} onClose={() => setSignOpen(false)} />

      {reviewOpen && (
        <MarkAsReviewedDialog
          pageFields={pageFields}
          pageTitle={pageTitle}
          onCancel={() => setReviewOpen(false)}
          onConfirm={(comment, dataFields) => {
            // Cascade: mark every data field on this page as Verified before
            // moving the form status forward. Skip fields that are already
            // verified — preserves their original comment + signer identity.
            dataFields.forEach((f) => {
              if (!f.isVerified) {
                dispatch(setVerification({
                  fieldId: f.id,
                  verified: true,
                  comment: `Cascade from page "Mark as Reviewed": ${comment}`,
                  ...me,
                }));
              }
            });
            dispatch(setFormStatus({ to: 'Reviewed', ...me, reason: comment }));
            setReviewOpen(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * MarkAsReviewedDialog — spec §VM Page-level Mark as Reviewed.
 *
 * 1. Enumerates the current page's data-bearing fields (skipping h2/paragraph/
 *    divider layout entries) and reads their value + verification state from
 *    the runtime slice.
 * 2. Blocks the action if any mandatory field is empty — lists the offenders
 *    so the CRA knows exactly what to fix before re-trying.
 * 3. When the page is filled in, shows a confirmation prompt that:
 *      - counts the fields about to be cascade-verified
 *      - requires a comment (recorded on the status transition + on every
 *        cascade verification)
 *      - calls back with (comment, dataFields) so the parent does the actual
 *        dispatches — keeps state isolation clean.
 */
function MarkAsReviewedDialog({ pageFields, pageTitle, onCancel, onConfirm }) {
  const allFieldData    = useSelector(selectAllFieldData);
  const allCollaboration = useSelector((s) => s.formRuntime.collaboration);

  const [comment, setComment] = useState('');

  const dataFields = (pageFields || [])
    .filter((f) => f && !LAYOUT_TYPES.has(f.type))
    .map((f) => {
      const value      = allFieldData?.[f.id]?.value;
      const verified   = !!allCollaboration?.[f.id]?.verification?.verified;
      const isEmpty    = isEmptyValue(value);
      return {
        id:         f.id,
        label:      f.label || '(unnamed field)',
        required:   !!f.required,
        isEmpty,
        isVerified: verified,
      };
    });

  const missingMandatory = dataFields.filter((f) => f.required && f.isEmpty);
  const unverifiedCount  = dataFields.filter((f) => !f.isVerified).length;

  const blocked      = missingMandatory.length > 0;
  const commentValid = comment.trim().length > 0;
  const canConfirm   = !blocked && commentValid && dataFields.length > 0;

  return (
    <div
      role="dialog"
      aria-label="Mark page as Reviewed"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: 16,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 18px 40px rgba(15,23,42,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <strong style={{ fontSize: 14, color: '#0f172a' }}>Mark Page as Reviewed</strong>
            {pageTitle && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{pageTitle}</div>
            )}
          </div>
          <button type="button" onClick={onCancel} style={{ ...BTN_BASE, background: 'transparent', padding: 4 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          {blocked ? (
            <div
              style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: 12, color: '#7f1d1d', marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 6 }}>
                <AlertTriangle size={14} />
                Cannot mark as Reviewed — {missingMandatory.length} mandatory field
                {missingMandatory.length === 1 ? '' : 's'} still empty
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55 }}>
                {missingMandatory.slice(0, 8).map((f) => (
                  <li key={f.id}>{f.label}</li>
                ))}
                {missingMandatory.length > 8 && (
                  <li style={{ color: '#991b1b' }}>+ {missingMandatory.length - 8} more</li>
                )}
              </ul>
            </div>
          ) : (
            <div
              style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: 12, color: '#14532d', marginBottom: 12, fontSize: 13,
              }}
            >
              You're about to mark this page as <strong>Reviewed</strong>.
              {' '}
              {unverifiedCount > 0
                ? <>This will cascade-verify <strong>{unverifiedCount}</strong> unverified field{unverifiedCount === 1 ? '' : 's'}.</>
                : <>All {dataFields.length} field{dataFields.length === 1 ? ' is' : 's are'} already verified.</>}
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Comment <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Required — captured on the status transition and on every cascade verification."
            aria-required="true"
            aria-invalid={!commentValid}
            disabled={blocked}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: 10, fontSize: 13, color: '#0f172a',
              border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', resize: 'vertical',
              background: blocked ? '#f8fafc' : '#fff',
            }}
            autoFocus={!blocked}
          />
          {!commentValid && !blocked && (
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
              A comment is required.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', background: '#fafbff', borderTop: '1px solid #f1f5f9', borderRadius: '0 0 12px 12px' }}>
          <button type="button" onClick={onCancel} style={{ ...BTN_BASE, ...VARIANT.subtle }}>Cancel</button>
          <button
            type="button"
            onClick={() => onConfirm(comment.trim(), dataFields)}
            disabled={!canConfirm}
            title={blocked ? 'Fill in the mandatory fields first' : (!commentValid ? 'Add a comment' : '')}
            style={{
              ...BTN_BASE, ...VARIANT.primary,
              opacity: canConfirm ? 1 : 0.55,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            <Eye size={13} /> Confirm Review
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonPrompt({ label, value, onChange, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: 16,
      }}
      role="dialog"
      aria-label={`${label} — reason`}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 18px 40px rgba(15,23,42,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <strong style={{ fontSize: 14, color: '#0f172a' }}>{label}</strong>
          <button type="button" onClick={onCancel} style={{ ...BTN_BASE, background: 'transparent', padding: 4 }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Reason (recorded in audit trail) *
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Why are you performing this action?"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: 10, fontSize: 13, color: '#0f172a',
              border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', resize: 'vertical',
            }}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', background: '#fafbff', borderTop: '1px solid #f1f5f9', borderRadius: '0 0 12px 12px' }}>
          <button type="button" onClick={onCancel} style={{ ...BTN_BASE, ...VARIANT.subtle }}>Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!value.trim()}
            style={{
              ...BTN_BASE, ...VARIANT.primary,
              opacity: value.trim() ? 1 : 0.55,
              cursor: value.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
