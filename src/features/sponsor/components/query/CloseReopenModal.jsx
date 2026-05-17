import { useState } from 'react';
import { CheckCircle, RotateCcw, Info } from 'lucide-react';
import Modal     from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import styles from './CloseReopenModal.module.css';

/**
 * Shared modal for Close and Reopen actions.
 * mode: 'close' | 'reopen'
 */
export default function CloseReopenModal({ mode, query, onConfirm, onClose }) {
  const isClose = mode === 'close';

  const [reason,  setReason]  = useState('');
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [checked, setChecked] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(isClose ? 'Closure reason is required.' : 'Reopen reason is required.');
      return;
    }
    if (isClose && !checked) { setError('Please confirm the issue is resolved.'); return; }
    setSaving(true);
    try {
      await onConfirm(isClose ? { closureReason: reason } : { reopenReason: reason });
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button
        className={isClose ? styles.btnClose : styles.btnReopen}
        onClick={handleConfirm}
        disabled={saving}
        type="button"
      >
        {isClose ? <CheckCircle size={13} /> : <RotateCcw size={13} />}
        {saving
          ? (isClose ? 'Closing…' : 'Reopening…')
          : (isClose ? 'Close Query' : 'Reopen Query')}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isClose ? 'Close Query' : 'Reopen Query'}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        {query && (
          <div className={styles.snippet}>
            <span className={styles.snippetId}>#{query.id}</span>
            <span className={styles.snippetText}>{query.queryText}</span>
          </div>
        )}

        <FormField
          label={isClose ? 'Closure Reason' : 'Reason for Reopening'}
          name="reason"
          required
          error={error}
        >
          <textarea
            id="reason"
            className={`${styles.textarea} ${error ? styles.inputError : ''}`}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            placeholder={isClose
              ? 'Describe how the query was resolved…'
              : 'Explain why this query needs to be reopened…'}
            rows={4}
          />
        </FormField>

        {isClose && (
          <label className={styles.confirmRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={checked}
              onChange={(e) => { setChecked(e.target.checked); setError(''); }}
            />
            I confirm that the issue has been resolved and the data is correct.
          </label>
        )}

        <div className={styles.notice}>
          <Info size={13} className={styles.noticeIcon} />
          {isClose
            ? 'Email notification will be sent to all participants in the query thread.'
            : 'Reopening this query will notify the original query raiser and relevant stakeholders.'}
        </div>
      </div>
    </Modal>
  );
}
