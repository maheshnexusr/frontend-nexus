import { useState } from 'react';
import { XCircle, Info } from 'lucide-react';
import Modal     from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import styles from './RejectModal.module.css';

const ACTION_ITEMS = [
  { key: 'updatePersonalInfo', label: 'Update personal information'     },
  { key: 'uploadDocument',     label: 'Upload correct document'         },
  { key: 'provideSignature',   label: 'Provide missing signature'       },
  { key: 'reconsent',          label: 'Re-consent with updated form'    },
  { key: 'correctBankDetails', label: 'Correct bank account details'    },
  { key: 'provideId',          label: 'Provide valid identification'    },
];

export default function RejectModal({ submission, bulk, onConfirm, onClose }) {
  const [form, setForm] = useState({
    rejectionReason: '',
    customMessage:   '',
    actionItems:     [],
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [charCount, setCharCount] = useState(0);

  const set = (key) => (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, [key]: val }));
    if (key === 'customMessage') setCharCount(val.length);
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
    if (form.customMessage.length > 1000) errs.customMessage = 'Custom message cannot exceed 1000 characters.';
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
        <XCircle size={14} />
        {saving ? 'Rejecting…' : bulk ? `Reject ${bulk}` : 'Reject'}
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
            The same rejection reason will be sent to all {bulk} selected submissions.
          </div>
        )}

        <FormField label="Reason for Rejection" name="rejectionReason" required error={errors.rejectionReason}
          helpText="This reason will be shared with the user in the rejection email.">
          <textarea
            id="rejectionReason"
            className={`${styles.textarea} ${errors.rejectionReason ? styles.inputError : ''}`}
            value={form.rejectionReason}
            onChange={set('rejectionReason')}
            placeholder="Provide a clear reason for rejecting this consent submission…"
            rows={4}
          />
        </FormField>

        <FormField label="Action Items" name="actionItems" helpText="Select specific actions the user needs to take.">
          <div className={styles.actionList}>
            {ACTION_ITEMS.map(({ key, label }) => (
              <label key={key} className={styles.checkRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={form.actionItems.includes(key)}
                  onChange={() => toggleAction(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </FormField>

        <FormField
          label="Additional Instructions"
          name="customMessage"
          helpText={`Optional additional message to the user. ${charCount}/1000`}
          error={errors.customMessage}
        >
          <textarea
            id="customMessage"
            className={`${styles.textarea} ${errors.customMessage ? styles.inputError : ''}`}
            value={form.customMessage}
            onChange={set('customMessage')}
            placeholder="Optional: Provide specific instructions for the user…"
            rows={3}
          />
        </FormField>

        <div className={styles.noticeRow}>
          <Info size={13} className={styles.noticeIcon} />
          <span>User will receive a rejection email with the reason and action items. They can resubmit after making corrections.</span>
        </div>

      </div>
    </Modal>
  );
}
