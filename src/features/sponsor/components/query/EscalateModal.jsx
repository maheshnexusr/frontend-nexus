import { useState, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { sponsorQueryClient } from '@/features/sponsor/api/sponsorQueryClient';
import styles from './EscalateModal.module.css';

const PRIORITY_ORDER  = ['Low', 'Medium', 'High'];
const PRIORITY_COLORS = { Low: '#3b82f6', Medium: '#f59e0b', High: '#dc2626' };

export default function EscalateModal({ studyId, query, onConfirm, onClose }) {
  const [form, setForm] = useState({
    escalationReason: '',
    escalateTo:       '',
    newPriority:      nextPriority(query?.priority),
  });
  const [errors,    setErrors]  = useState({});
  const [userOpts,  setUserOpts] = useState([]);
  const [saving,    setSaving]   = useState(false);

  function nextPriority(current) {
    const idx = PRIORITY_ORDER.indexOf(current ?? 'Medium');
    return idx < PRIORITY_ORDER.length - 1 ? PRIORITY_ORDER[idx + 1] : current ?? 'High';
  }

  useEffect(() => {
    if (!studyId) return;
    sponsorQueryClient.getUsers(studyId).then(setUserOpts).catch(() => setUserOpts([]));
  }, [studyId]);

  const set = (key) => (val) => {
    const v = val?.target ? val.target.value : val;
    setForm((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleConfirm = async () => {
    const errs = {};
    if (!form.escalationReason.trim()) errs.escalationReason = 'Escalation reason is required.';
    if (!form.escalateTo)              errs.escalateTo       = 'Please select a user to escalate to.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try { await onConfirm(form); } finally { setSaving(false); }
  };

  const footer = (
    <>
      <button className={styles.btnCancel}  onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button className={styles.btnEscalate} onClick={handleConfirm} disabled={saving} type="button">
        <AlertTriangle size={13} />
        {saving ? 'Escalating…' : 'Escalate Query'}
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Escalate Query" size="sm" footer={footer}>
      <div className={styles.body}>

        {query && (
          <div className={styles.snippet}>
            {/* Identify by field (e.g. "Date of Birth"), not the internal id. */}
            <span className={styles.snippetId}>{query.fieldLabel || query.fieldName || '—'}</span>
            <span className={styles.snippetText}>{query.queryText}</span>
          </div>
        )}

        <FormField label="Escalation Reason" name="escalationReason" required error={errors.escalationReason}>
          <textarea
            id="escalationReason"
            className={`${styles.textarea} ${errors.escalationReason ? styles.inputError : ''}`}
            value={form.escalationReason}
            onChange={set('escalationReason')}
            placeholder="Explain why this query needs to be escalated…"
            rows={4}
          />
        </FormField>

        <FormField label="Escalate To" name="escalateTo" required error={errors.escalateTo}>
          <SearchableDropdown
            options={userOpts}
            value={form.escalateTo}
            onChange={set('escalateTo')}
            placeholder="Select a user or role…"
            searchPlaceholder="Search users…"
          />
        </FormField>

        <FormField label="Priority After Escalation" name="newPriority">
          <div className={styles.priorityOptions}>
            {PRIORITY_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.priorityBtn} ${form.newPriority === p ? styles.priorityBtnActive : ''}`}
                style={form.newPriority === p ? { background: PRIORITY_COLORS[p], color: '#fff', borderColor: PRIORITY_COLORS[p] } : {}}
                onClick={() => setForm((prev) => ({ ...prev, newPriority: p }))}
              >
                {p}
              </button>
            ))}
          </div>
          <p className={styles.priorityHint}>
            Current priority: <strong style={{ color: PRIORITY_COLORS[query?.priority] }}>{query?.priority ?? 'Medium'}</strong>
          </p>
        </FormField>

        <div className={styles.notice}>
          <Info size={13} className={styles.noticeIcon} />
          Email notification will be sent to the escalated user with full query details.
        </div>

      </div>
    </Modal>
  );
}
