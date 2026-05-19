import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  selectFieldBucket, setVerification,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import Popover from './Popover';
import { useFieldCapabilities } from './useFieldCapabilities';
import s from './runtime.module.css';

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function VerificationPanel({ fieldId, fieldLabel, fieldValue, anchorRect, onClose }) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const bucket   = useSelector(selectFieldBucket(fieldId));
  const caps     = useFieldCapabilities();
  const v        = bucket?.verification ?? { verified: false };

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const [comment, setComment] = useState('');

  const verify = (verified) => {
    dispatch(setVerification({
      fieldId,
      verified,
      comment: comment.trim() || null,
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
          {caps.canVerify && (v.verified ? (
            <button type="button" className={s.btnDanger} onClick={() => verify(false)}>
              <XCircle size={13} /> Unverify
            </button>
          ) : (
            <button type="button" className={s.btnPrimary} onClick={() => verify(true)}>
              <CheckCircle2 size={13} /> Verify
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
        <label className={s.fieldLabel}>Comment (optional)</label>
        <textarea
          className={s.textArea}
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Notes for the audit trail…"
        />
      </div>
    </Popover>
  );
}
