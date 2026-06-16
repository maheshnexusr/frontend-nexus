import { useState } from 'react';
import { XCircle, Info, Check, AlertTriangle } from 'lucide-react';
import Modal     from '@/components/feedback/Modal';
import styles from './RejectModal.module.css';

const ACTION_ITEMS = [
  { key: 'updatePersonalInfo', label: 'Update personal information'     },
  { key: 'uploadDocument',     label: 'Upload correct document'         },
  { key: 'provideSignature',   label: 'Provide missing signature'       },
  { key: 'reconsent',          label: 'Re-consent with updated form'    },
  { key: 'correctBankDetails', label: 'Correct bank account details'    },
  { key: 'provideId',          label: 'Provide valid identification'    },
];

const MAX_MESSAGE = 1000;

export default function RejectModal({ submission, bulk, onConfirm, onClose }) {
  const [form, setForm] = useState({
    rejectionReason: '',
    customMessage:   '',
    actionItems:     [],
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const toggleAction = (key) => {
    setForm((p) => ({
      ...p,
      actionItems: p.actionItems.includes(key)
        ? p.actionItems.filter((k) => k !== key)
        : [...p.actionItems, key],
    }));
  };

  const handleConfirm = async () => {
    const errs = {};
    if (!form.rejectionReason.trim()) errs.rejectionReason = 'Rejection reason is required.';
    if (form.customMessage.length > MAX_MESSAGE) errs.customMessage = `Message cannot exceed ${MAX_MESSAGE} characters.`;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await onConfirm(form);
    } finally {
      setSaving(false);
    }
  };

  const title = bulk
    ? `Reject ${bulk} Selected Consent${bulk !== 1 ? 's' : ''}`
    : 'Reject Consent Submission';

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button className={styles.btnReject} onClick={handleConfirm} disabled={saving} type="button">
        <XCircle size={15} />
        {saving ? 'Rejecting…' : bulk ? `Reject ${bulk}` : 'Reject Consent'}
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={title} size="md" footer={footer}>
      <div className={styles.body}>

        {/* Destructive intent banner */}
        <div className={styles.banner}>
          <span className={styles.bannerIcon}><AlertTriangle size={16} /></span>
          <div>
            <strong className={styles.bannerTitle}>This consent will be rejected.</strong>
            <span className={styles.bannerText}>
              {bulk
                ? `The same reason and action items will be sent to all ${bulk} selected submissions.`
                : 'The user will be emailed the reason below and can resubmit after making the corrections.'}
            </span>
          </div>
        </div>

        {/* Who is being rejected */}
        {!bulk && submission && (
          <div className={styles.userInfo}>
            <span className={styles.avatar}>
              {(submission.userName || '?').trim().charAt(0).toUpperCase()}
            </span>
            <div className={styles.userMain}>
              <span className={styles.userName}>{submission.userName || 'Unknown user'}</span>
              <span className={styles.userMeta}>
                {[submission.role, submission.siteName].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div className={styles.field}>
          <label htmlFor="rejectionReason" className={styles.label}>
            Reason for rejection <span className={styles.req}>*</span>
          </label>
          <textarea
            id="rejectionReason"
            className={`${styles.textarea} ${errors.rejectionReason ? styles.inputError : ''}`}
            value={form.rejectionReason}
            onChange={set('rejectionReason')}
            placeholder="Provide a clear reason for rejecting this consent submission…"
            rows={3}
          />
          {errors.rejectionReason
            ? <span className={styles.errorText}>{errors.rejectionReason}</span>
            : <span className={styles.hint}>Shared with the user in the rejection email.</span>}
        </div>

        {/* Action items — selectable chips */}
        <div className={styles.field}>
          <label className={styles.label}>Action items</label>
          <span className={styles.hint}>Select what the user needs to correct (optional).</span>
          <div className={styles.actionGrid}>
            {ACTION_ITEMS.map(({ key, label }) => {
              const active = form.actionItems.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  onClick={() => toggleAction(key)}
                  aria-pressed={active}
                >
                  <span className={styles.chipBox}>{active && <Check size={12} strokeWidth={3} />}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional instructions */}
        <div className={styles.field}>
          <label htmlFor="customMessage" className={styles.label}>Additional instructions</label>
          <textarea
            id="customMessage"
            className={`${styles.textarea} ${errors.customMessage ? styles.inputError : ''}`}
            value={form.customMessage}
            onChange={set('customMessage')}
            placeholder="Optional message with specific instructions for the user…"
            rows={3}
          />
          <div className={styles.metaRow}>
            {errors.customMessage
              ? <span className={styles.errorText}>{errors.customMessage}</span>
              : <span className={styles.hint}>Optional.</span>}
            <span className={`${styles.counter} ${form.customMessage.length > MAX_MESSAGE ? styles.counterOver : ''}`}>
              {form.customMessage.length}/{MAX_MESSAGE}
            </span>
          </div>
        </div>

        <div className={styles.noticeRow}>
          <Info size={13} className={styles.noticeIcon} />
          <span>A rejection email with the reason and action items is sent automatically.</span>
        </div>

      </div>
    </Modal>
  );
}
