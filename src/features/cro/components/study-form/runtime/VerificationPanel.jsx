import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  selectFieldBucket, setVerification,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import Popover from './Popover';
import { useFieldCapabilities } from './useFieldCapabilities';
import { formatDateTime } from '@/utils/formatDate';
import s from './runtime.module.css';

const fmt = (iso) => formatDateTime(iso);

export default function VerificationPanel({
  fieldId, fieldLabel, fieldValue, anchorRect, onClose,
  // Persisted SDV (capture). When present, this popover verifies for real and
  // reflects the persisted state + real verifier name. Otherwise (designer
  // preview) it falls back to the legacy client-only formRuntimeSlice bucket.
  verifiedInfo = null,
  onVerifyField,
}) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const bucket   = useSelector(selectFieldBucket(fieldId));
  const caps     = useFieldCapabilities();

  const persisted = typeof onVerifyField === 'function';
  // In persisted mode the truth comes from the server (verifiedInfo); otherwise
  // from the legacy client-only bucket.
  const v = persisted
    ? {
        verified:       verifiedInfo?.status === 'Verified',
        verifiedByName: verifiedInfo?.verifiedByName,
        verifiedAt:     verifiedInfo?.verifiedAt,
      }
    : (bucket?.verification ?? { verified: false });

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const [comment, setComment] = useState('');
  const [busy, setBusy]       = useState(false);
  // Spec §VM (CRA flow): the "Mark as Verified" dialog requires a comment so
  // every SDV action carries an audit-trail justification. Same rule for
  // "Unverify" — reversing a verification also needs a reason on record.
  const commentValid = comment.trim().length > 0;

  const verify = async (verified) => {
    if (!commentValid || busy) return;
    if (persisted) {
      setBusy(true);
      try {
        await onVerifyField(verified, comment.trim());
        setComment('');
        onClose?.();
      } finally {
        setBusy(false);
      }
      return;
    }
    dispatch(setVerification({
      fieldId,
      verified,
      comment: comment.trim(),
      ...me,
    }));
    setComment('');
  };

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Verify · ${fieldLabel}`}
      width={380}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.btnSecondary} onClick={onClose}>Close</button>
          {(persisted || caps.canVerify) && (v.verified ? (
            <button
              type="button"
              className={s.btnDanger}
              onClick={() => verify(false)}
              disabled={!commentValid || busy}
              title={commentValid ? '' : 'A comment is required'}
            >
              <XCircle size={13} /> {busy ? 'Saving…' : 'Mark as Unverified'}
            </button>
          ) : (
            <button
              type="button"
              className={s.btnPrimary}
              onClick={() => verify(true)}
              disabled={!commentValid || busy}
              title={commentValid ? '' : 'A comment is required'}
            >
              <CheckCircle2 size={13} /> {busy ? 'Saving…' : 'Mark as Verified'}
            </button>
          ))}
        </>
      }
    >
      <div className={`${s.verifyState} ${v.verified ? s.verifyStateOk : ''}`}>
        <div className={s.verifyStateLine}>
          <strong>Current value:</strong>{' '}
          {fieldValue === undefined || fieldValue === null || fieldValue === '' ? (
            <em style={{ color: '#94a3b8' }}>(empty)</em>
          ) : (
            String(fieldValue)
          )}
        </div>
        <div className={s.verifyMeta}>
          {v.verified
            ? <>✔ Verified by <strong>{v.verifiedByName}</strong> · {fmt(v.verifiedAt)}{v.comment ? ` · "${v.comment}"` : ''}</>
            : <>⚠ Pending verification</>
          }
        </div>
      </div>

      <div className={s.formField} style={{ marginBottom: 0 }}>
        <label className={s.fieldLabel}>
          Comment <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea
          className={s.textArea}
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Required — notes for the audit trail…"
          aria-required="true"
          aria-invalid={!commentValid}
        />
        {!commentValid && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
            A comment is required before {v.verified ? 'unverifying' : 'marking as verified'}.
          </div>
        )}
      </div>
    </Popover>
  );
}
