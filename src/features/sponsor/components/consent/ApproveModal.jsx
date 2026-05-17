import { useState } from 'react';
import { CheckCircle, Info } from 'lucide-react';
import Modal     from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import styles from './ApproveModal.module.css';

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function ApproveModal({ submission, bulk, onConfirm, onClose }) {
  const [form, setForm] = useState({
    customMessage: '',
    effectiveDate: today(),
    expiryDate:    addDays(today(), 365),
  });
  const [saving, setSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const set = (key) => (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, [key]: val }));
    if (key === 'customMessage') setCharCount(val.length);
  };

  const handleEffectiveDateChange = (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, effectiveDate: val, expiryDate: addDays(val, 365) }));
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(form);
    } finally {
      setSaving(false);
    }
  };

  const title = bulk
    ? `Approve ${bulk} Selected Consent${bulk !== 1 ? 's' : ''}`
    : 'Approve Consent Submission';

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button className={styles.btnApprove} onClick={handleConfirm} disabled={saving} type="button">
        <CheckCircle size={14} />
        {saving ? 'Approving…' : bulk ? `Approve ${bulk}` : 'Approve'}
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={title} size="sm" footer={footer}>
      <div className={styles.body}>

        {!bulk && submission && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{submission.userName}</span>
            <span className={styles.userMeta}>{submission.role} · {submission.siteName}</span>
          </div>
        )}

        {bulk && (
          <div className={styles.bulkInfo}>
            <Info size={14} />
            The same effective date and optional message will be applied to all {bulk} selected submissions.
          </div>
        )}

        <div className={styles.row2}>
          <FormField label="Effective Date" name="effectiveDate">
            <input
              type="date"
              id="effectiveDate"
              className={styles.input}
              value={form.effectiveDate}
              onChange={handleEffectiveDateChange}
            />
          </FormField>
          <FormField label="Expiry Date" name="expiryDate" helpText="Auto-set from consent config">
            <input
              type="date"
              id="expiryDate"
              className={styles.input}
              value={form.expiryDate}
              onChange={set('expiryDate')}
            />
          </FormField>
        </div>

        <FormField
          label="Message to User"
          name="customMessage"
          helpText={`Optional — default: "Your consent has been approved." ${charCount}/1000`}
        >
          <textarea
            id="customMessage"
            className={`${styles.textarea} ${charCount > 1000 ? styles.inputError : ''}`}
            value={form.customMessage}
            onChange={set('customMessage')}
            placeholder="Your consent has been approved."
            rows={4}
            maxLength={1050}
          />
        </FormField>

        <div className={styles.noticeRow}>
          <Info size={13} className={styles.noticeIcon} />
          <span>User will be notified via email with the approval details and effective date.</span>
        </div>

      </div>
    </Modal>
  );
}
