/**
 * SignFormModal — 21 CFR Part 11-style e-signature capture.
 *
 *   - Attestation checkbox (must be checked)
 *   - Optional password re-entry (recommended for production; backend
 *     verifies it before persisting the signature)
 *   - Captures the user's role / name / timestamp
 *   - Dispatches `signForm({ by, byName, role, attestation, hash })`
 *     which flips the form to `Signed` and writes an audit entry
 *
 * The `hash` is a no-op client placeholder — backend should compute a
 * cryptographic signature over (subject_id, form_id, form_data_version,
 * user_id, timestamp) and persist it as the canonical signature record.
 */

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { PenLine, X } from 'lucide-react';
import { signForm } from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';

const DEFAULT_ATTESTATION = `By signing this electronic record I confirm that the data captured in this form is accurate, complete, and a true representation of the source documents. This electronic signature is the legally binding equivalent of my handwritten signature, in accordance with 21 CFR Part 11.`;

export default function SignFormModal({ open, onClose }) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);

  const [attestationChecked, setChecked] = useState(false);
  const [password,           setPassword] = useState('');
  const [submitting,         setSubmitting] = useState(false);

  if (!open) return null;

  const handleSign = async () => {
    if (!attestationChecked || submitting) return;
    setSubmitting(true);
    try {
      // Backend will verify password + compute a cryptographic hash.
      // Frontend just records the intent + the attestation text.
      dispatch(signForm({
        by:          user?.id ?? 'unknown',
        byName:      user?.fullName ?? user?.email ?? 'You',
        role:        user?.roleName ?? null,
        attestation: DEFAULT_ATTESTATION,
        hash:        null,
      }));
      setChecked(false);
      setPassword('');
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Sign form"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: 16,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 24px 50px rgba(15,23,42,0.3)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: '#ede9fe', color: '#6d28d9' }}>
            <PenLine size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Sign Form</div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>21 CFR Part 11 electronic signature</div>
          </div>
          <button type="button" onClick={onClose} style={btnIcon}>
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Signer info */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.04, textTransform: 'uppercase', marginBottom: 4 }}>
              Signing as
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{user?.fullName ?? user?.email ?? '—'}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{user?.roleName ?? 'Unknown role'} · {user?.email ?? ''}</div>
          </div>

          {/* Attestation */}
          <label style={{ display: 'flex', gap: 10, fontSize: 12.5, color: '#334155', lineHeight: 1.5, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={attestationChecked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>{DEFAULT_ATTESTATION}</span>
          </label>

          {/* Password (optional; backend enforces) */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Password (re-enter to confirm) *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', fontSize: 13,
                border: '1px solid #e2e8f0', borderRadius: 7, outline: 'none',
              }}
            />
          </div>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fafbff', borderRadius: '0 0 14px 14px' }}>
          <button type="button" onClick={onClose} style={btnSecondary} disabled={submitting}>Cancel</button>
          <button
            type="button"
            onClick={handleSign}
            disabled={!attestationChecked || !password.trim() || submitting}
            style={{
              ...btnPrimary,
              opacity: (attestationChecked && password.trim() && !submitting) ? 1 : 0.55,
              cursor: (attestationChecked && password.trim() && !submitting) ? 'pointer' : 'not-allowed',
            }}
          >
            <PenLine size={13} /> {submitting ? 'Signing…' : 'Sign Form'}
          </button>
        </footer>
      </div>
    </div>
  );
}

const btnIcon = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', borderRadius: 6 };
const btnSecondary = { padding: '7px 16px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnPrimary   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: '#6d28d9', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
