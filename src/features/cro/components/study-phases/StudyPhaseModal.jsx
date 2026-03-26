import { useState, useEffect } from 'react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { studyPhasesClient } from '@/features/cro/api/studyPhasesClient';
import styles from './StudyPhaseModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = { phaseName: '', status: 'Active' };

export default function StudyPhaseModal({ mode, phase, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && phase) {
      setForm({ phaseName: phase.phaseName, status: phase.status });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [isEdit, phase]);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.phaseName.trim()) errs.phaseName = 'Phase Name is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const exists = await studyPhasesClient.nameExists(
        form.phaseName,
        isEdit ? phase.id : null,
      );
      if (exists) {
        setErrors({ phaseName: 'Phase Name already exists. Please use a unique name.' });
        setSaving(false);
        return;
      }

      const saved = isEdit
        ? await studyPhasesClient.update(phase.id, form)
        : await studyPhasesClient.create(form);

      onSave(saved);
    } catch {
      onError(
        isEdit
          ? 'Failed to update Study Phase. Please try again.'
          : 'Failed to create Study Phase. Please try again.',
      );
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
        {saving ? 'Saving…' : isEdit ? 'Update Phase' : 'Create Phase'}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Study Phase' : 'Create Study Phase'}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        <FormField label="Phase Name" name="phaseName" required error={errors.phaseName}>
          <input
            id="phaseName"
            className={`${styles.input} ${errors.phaseName ? styles.inputError : ''}`}
            value={form.phaseName}
            onChange={set('phaseName')}
            placeholder="e.g. Phase I, Phase II, Pilot Study…"
            autoFocus
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
