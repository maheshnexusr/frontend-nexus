import { useState } from 'react';
import Modal     from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import styles from './FieldConfigModal.module.css';

export default function FieldConfigModal({ field, onSave, onClose }) {
  const [form, setForm] = useState({
    label:        field.label        ?? field.defaultLabel ?? '',
    isMandatory:  field.isMandatory  ?? false,
    displayOrder: field.displayOrder ?? 1,
    helpText:     field.helpText     ?? '',
  });
  const [errors, setErrors] = useState({});

  const set = (key) => (e) => {
    const val = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleSubmit = () => {
    const errs = {};
    if (!form.label.trim()) errs.label = 'Field Label is required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...field, ...form, displayOrder: Number(form.displayOrder) || 1 });
  };

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} type="button">Cancel</button>
      <button className={styles.btnSave} onClick={handleSubmit} type="button">Save</button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Configure: ${field.defaultLabel}`}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>

        <FormField label="Field Label" name="label" required error={errors.label}>
          <input
            id="label"
            className={`${styles.input} ${errors.label ? styles.inputError : ''}`}
            value={form.label}
            onChange={set('label')}
            placeholder="Customise the label shown to the user"
          />
        </FormField>

        <div className={styles.row2}>
          <FormField label="Display Order" name="displayOrder">
            <input
              id="displayOrder"
              type="number"
              min={1}
              className={styles.input}
              value={form.displayOrder}
              onChange={set('displayOrder')}
            />
          </FormField>

          <FormField label="Required">
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={form.isMandatory}
                onChange={set('isMandatory')}
              />
              Make this field mandatory
            </label>
          </FormField>
        </div>

        <FormField label="Help Text" name="helpText" helpText="Optional tooltip or guidance shown below the field.">
          <input
            id="helpText"
            className={styles.input}
            value={form.helpText}
            onChange={set('helpText')}
            placeholder="e.g. Enter the name as it appears on your ID"
          />
        </FormField>

      </div>
    </Modal>
  );
}
