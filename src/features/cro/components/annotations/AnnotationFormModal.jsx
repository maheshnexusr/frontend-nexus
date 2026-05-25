/**
 * AnnotationFormModal — Create / Edit one annotation in the master.
 *
 * Fields: Annotation (required, unique), Full Form, Description, Status.
 * Duplicate validation is on `annotation` only (case-insensitive); the
 * authoritative check happens on the backend (responds 409 on collision).
 */

import { useState, useEffect } from 'react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import TextArea           from '@/components/form/TextArea';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { annotationsClient } from '@/features/cro/api/annotationsClient';
import styles from './AnnotationFormModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = { annotation: '', fullForm: '', description: '', status: 'Active' };

export default function AnnotationFormModal({ mode, annotation, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && annotation) {
      setForm({
        annotation:  annotation.annotation  ?? '',
        fullForm:    annotation.fullForm    ?? '',
        description: annotation.description ?? '',
        status:      annotation.status      ?? 'Active',
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [isEdit, annotation]);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.annotation.trim()) errs.annotation = 'Annotation is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const saved = isEdit
        ? await annotationsClient.update(annotation.id, form)
        : await annotationsClient.create(form);
      onSave(saved);
    } catch (err) {
      if (err?.response?.status === 409) {
        setErrors({ annotation: 'Annotation already exists. Please use a unique value.' });
      } else {
        onError(isEdit
          ? 'Failed to update Annotation. Please try again.'
          : 'Failed to create Annotation. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} disabled={saving} type="button">
        Cancel
      </button>
      <button className={styles.btnSave} onClick={handleSubmit} disabled={saving} type="button">
        {saving ? 'Saving…' : isEdit ? 'Update Annotation' : 'Create Annotation'}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Annotation' : 'Add Annotation'}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        <FormField label="Annotation" name="annotation" required error={errors.annotation}>
          <input
            id="annotation"
            className={`${styles.input} ${errors.annotation ? styles.inputError : ''}`}
            value={form.annotation}
            onChange={set('annotation')}
            placeholder="e.g. AE, SAE, DOB…"
            autoFocus
          />
        </FormField>

        <FormField label="Full Form" name="fullForm">
          <input
            id="fullForm"
            className={styles.input}
            value={form.fullForm}
            onChange={set('fullForm')}
            placeholder="e.g. Adverse Event"
          />
        </FormField>

        <FormField label="Description" name="description">
          <TextArea
            name="description"
            value={form.description}
            onChange={set('description')}
            placeholder="Optional notes about this annotation…"
          />
        </FormField>

        <FormField label="Status" name="status">
          <SearchableDropdown
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={set('status')}
            placeholder="Select status"
          />
        </FormField>
      </div>
    </Modal>
  );
}
