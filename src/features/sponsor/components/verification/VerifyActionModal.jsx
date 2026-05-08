import { useState } from 'react';
import Modal from '@/components/feedback/Modal';
import css from './VerifyActionModal.module.css';

/**
 * VerifyActionModal — shared modal for Approve and Reject actions on a subject.
 *
 * Props:
 *   mode       'approve' | 'reject'
 *   subject    { id, siteCode } | null  (null = bulk)
 *   bulk       number  (count when bulk mode)
 *   onConfirm  ({ rejectionReason?, comment }) => Promise<void>
 *   onClose    () => void
 */

const REJECTION_REASONS = [
  'Incomplete CRF data',
  'Missing source document references',
  'Data inconsistency detected',
  'Failed quality checks',
  'Unauthorized data entry',
  'Protocol deviation',
  'Out-of-range values not explained',
  'Audit trail discrepancy',
];

export default function VerifyActionModal({ mode, subject, bulk, onConfirm, onClose }) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [customReason,    setCustomReason]    = useState('');
  const [comment,         setComment]         = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState('');

  const isReject  = mode === 'reject';
  const isBulk    = !!bulk;
  const targetLabel = isBulk
    ? `${bulk} subject${bulk !== 1 ? 's' : ''}`
    : subject
      ? `Subject ${subject.id}`
      : 'subject';

  const effectiveReason = rejectionReason === '__custom__' ? customReason : rejectionReason;

  const canSubmit = isReject
    ? effectiveReason.trim().length > 0
    : true;

  async function handleSubmit() {
    if (!canSubmit) {
      setError('Please provide a rejection reason.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        ...(isReject ? { rejectionReason: effectiveReason } : {}),
        comment: comment.trim() || undefined,
      });
    } catch (e) {
      setError(e?.message ?? 'An error occurred. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isReject ? 'Reject Subject Data' : 'Approve Subject Data'}
      size="sm"
      footer={
        <div className={css.footer}>
          <button className={css.btnCancel} onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className={isReject ? css.btnReject : css.btnApprove}
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting
              ? (isReject ? 'Rejecting…' : 'Approving…')
              : (isReject ? 'Reject' : 'Approve')}
          </button>
        </div>
      }
    >
      <div className={css.body}>
        {/* Target */}
        <div className={isReject ? css.targetBannerReject : css.targetBannerApprove}>
          <span className={css.targetIcon}>{isReject ? '✕' : '✓'}</span>
          <span className={css.targetText}>
            {isReject
              ? `Rejecting data for ${targetLabel}`
              : `Approving data for ${targetLabel}`}
          </span>
        </div>

        {/* Rejection reason (reject only) */}
        {isReject && (
          <div className={css.field}>
            <label className={css.label}>
              Rejection Reason <span className={css.req}>*</span>
            </label>
            <select
              className={css.select}
              value={rejectionReason}
              onChange={(e) => { setRejectionReason(e.target.value); setError(''); }}
            >
              <option value="">— Select a reason —</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="__custom__">Other (specify below)</option>
            </select>

            {rejectionReason === '__custom__' && (
              <textarea
                className={css.textarea}
                placeholder="Describe the rejection reason…"
                rows={3}
                value={customReason}
                onChange={(e) => { setCustomReason(e.target.value); setError(''); }}
              />
            )}
          </div>
        )}

        {/* Comment */}
        <div className={css.field}>
          <label className={css.label}>
            {isReject ? 'Additional Comments' : 'Comment'}
            {!isReject && <span className={css.optional}> (optional)</span>}
          </label>
          <textarea
            className={css.textarea}
            placeholder={
              isReject
                ? 'Provide additional context for the site team (optional)…'
                : 'Add an approval note (optional)…'
            }
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className={css.charCount}>{comment.length} / 1000</div>
        </div>

        {/* Approve info */}
        {!isReject && (
          <p className={css.approveNote}>
            Approving marks this subject's data as verified and accepted.
            This action will be recorded in the audit trail.
          </p>
        )}

        {error && <p className={css.errorMsg}>{error}</p>}
      </div>
    </Modal>
  );
}
