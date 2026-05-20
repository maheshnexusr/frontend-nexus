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
  CheckCircle2, Eye, ShieldCheck, Snowflake, Lock, PenLine, RotateCcw, X,
  Stamp,
} from 'lucide-react';
import {
  setFormStatus, approveForm, revokeApproval,
  FORM_STATUS_META,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { useFormGate } from '@/features/cro/components/study-form/runtime/useFormGate';
import SignFormModal from './SignFormModal';

// `kind` controls the click-handler path:
//   'transition'  → setFormStatus dispatch (with optional reason prompt)
//   'sign'        → opens SignFormModal (full attestation flow)
//   'approve'     → dispatches approveForm with a comment
//   'revokeApprove' → dispatches revokeApproval with a reason
const TRANSITIONS = [
  { kind: 'transition', to: 'Completed', label: 'Mark Completed',  Icon: CheckCircle2, gateKey: 'canMarkCompleted',    needsReason: false },
  { kind: 'transition', to: 'Reviewed',  label: 'Mark Reviewed',   Icon: Eye,          gateKey: 'canMarkReviewed',     needsReason: false },
  { kind: 'transition', to: 'Verified',  label: 'Mark Verified',   Icon: ShieldCheck,  gateKey: 'canMarkVerified',     needsReason: false },
  { kind: 'approve',                     label: 'Approve Form',    Icon: Stamp,        gateKey: 'canApproveForm',      needsReason: true  },
  { kind: 'revokeApprove',               label: 'Revoke Approval', Icon: RotateCcw,    gateKey: 'canRevokeApproval',   needsReason: true, variant: 'subtle' },
  { kind: 'transition', to: 'Frozen',    label: 'Freeze Form',     Icon: Snowflake,    gateKey: 'canFreezeForm',       needsReason: true  },
  { kind: 'transition', to: 'In Progress', label: 'Unfreeze',      Icon: Snowflake,    gateKey: 'canUnfreezeForm',     needsReason: true, variant: 'subtle' },
  { kind: 'transition', to: 'Locked',    label: 'Lock Form',       Icon: Lock,         gateKey: 'canLockForm',         needsReason: true  },
  { kind: 'transition', to: 'In Progress', label: 'Unlock',        Icon: Lock,         gateKey: 'canUnlockForm',       needsReason: true, variant: 'subtle' },
  { kind: 'sign',                        label: 'Sign Form',       Icon: PenLine,      gateKey: 'canSignForm',         needsReason: false },
  { kind: 'transition', to: 'Reviewed',  label: 'Revoke Signature', Icon: RotateCcw,   gateKey: 'canRevokeSignature',  needsReason: true, variant: 'subtle' },
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

export default function FormStatusToolbar() {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const gate     = useFormGate(null);

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const [prompt, setPrompt] = useState(null);   // { kind, to?, label, reason }
  const [signOpen, setSignOpen] = useState(false);

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
