import { useState, useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import Modal     from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import styles from './RespondModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Open',        label: 'Keep Open'          },
  { value: 'In Progress', label: 'Mark In Progress'   },
  { value: 'Resolved',    label: 'Mark Resolved'      },
];

export default function RespondModal({ query, onConfirm, onClose }) {
  const [form, setForm] = useState({
    responseText:      '',
    statusUpdate:      'In Progress',
    updatedFieldValue: '',
    attachments:       [],
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const fileRef = useRef(null);

  const set = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    if (key === 'responseText') setErrors((p) => ({ ...p, responseText: undefined }));
  };

  const addFiles = (e) => {
    const files = [...(e.target.files ?? [])];
    setForm((p) => ({ ...p, attachments: [...p.attachments, ...files] }));
    e.target.value = '';
  };
  const removeFile = (idx) =>
    setForm((p) => ({ ...p, attachments: p.attachments.filter((_, i) => i !== idx) }));

  const handleConfirm = async () => {
    if (!form.responseText.trim()) { setErrors({ responseText: 'Response text is required.' }); return; }
    setSaving(true);
    try { await onConfirm(form); } finally { setSaving(false); }
  };

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button className={styles.btnSave}   onClick={handleConfirm} disabled={saving} type="button">
        {saving ? 'Sending…' : 'Send Response'}
      </button>
    </>
  );

  // Identify the query by its field (e.g. "Date of Birth") — readable for
  // reviewers — rather than the internal random id.
  const fieldName = query?.fieldLabel || query?.fieldName || '';

  return (
    <Modal open onClose={onClose} title={fieldName ? `Respond to Query · ${fieldName}` : 'Respond to Query'} size="sm" footer={footer}>
      <div className={styles.body}>

        {query && (
          <div className={styles.querySnippet}>
            <span className={styles.snippetLabel}>Query</span>
            <p className={styles.snippetText}>{query.queryText}</p>
          </div>
        )}

        <FormField label="Response" name="responseText" required error={errors.responseText}>
          <textarea
            id="responseText"
            className={`${styles.textarea} ${errors.responseText ? styles.inputError : ''}`}
            value={form.responseText}
            onChange={set('responseText')}
            placeholder="Provide a detailed response to this query…"
            rows={5}
          />
        </FormField>

        <FormField label="Update Status" name="statusUpdate">
          <div className={styles.statusOptions}>
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className={`${styles.statusOption} ${form.statusUpdate === opt.value ? styles.statusOptionActive : ''}`}>
                <input
                  type="radio"
                  name="statusUpdate"
                  value={opt.value}
                  checked={form.statusUpdate === opt.value}
                  onChange={set('statusUpdate')}
                  style={{ display: 'none' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Updated Field Value" name="updatedFieldValue" helpText="Optional — provide corrected value if applicable.">
          <input
            id="updatedFieldValue"
            className={styles.input}
            value={form.updatedFieldValue}
            onChange={set('updatedFieldValue')}
            placeholder="Enter corrected value (if any)"
          />
        </FormField>

        <FormField label="Attachments" name="attachments" helpText="PDF, JPG, PNG, DOC, XLS – optional">
          <div className={styles.attachArea}>
            <button type="button" className={styles.attachBtn} onClick={() => fileRef.current?.click()}>
              <Paperclip size={13} /> Attach Files
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={addFiles}
            />
            {form.attachments.map((f, i) => (
              <div key={i} className={styles.attachPill}>
                <span className={styles.attachName}>{f.name}</span>
                <button type="button" className={styles.attachRemove} onClick={() => removeFile(i)}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </FormField>

      </div>
    </Modal>
  );
}
