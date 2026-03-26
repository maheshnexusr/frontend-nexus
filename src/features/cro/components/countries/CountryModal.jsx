import { useState, useEffect } from 'react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import TextArea           from '@/components/form/TextArea';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { countriesClient } from '@/features/cro/api/countriesClient';
import styles from './CountryModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = { countryName: '', description: '', status: 'Active' };

export default function CountryModal({ mode, country, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && country) {
      setForm({ countryName: country.countryName, description: country.description ?? '', status: country.status });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [isEdit, country]);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.countryName.trim()) errs.countryName = 'Country Name is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const exists = await countriesClient.nameExists(form.countryName, isEdit ? country.id : null);
      if (exists) {
        setErrors({ countryName: 'Country Name already exists. Please use a unique name.' });
        setSaving(false);
        return;
      }

      const saved = isEdit
        ? await countriesClient.update(country.id, form)
        : await countriesClient.create(form);

      onSave(saved);
    } catch {
      onError(
        isEdit
          ? 'Failed to update Country. Please try again.'
          : 'Failed to create Country. Please try again.',
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
        {saving ? 'Saving…' : isEdit ? 'Update Country' : 'Create Country'}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Country' : 'Add Country'}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        <FormField label="Country Name" name="countryName" required error={errors.countryName}>
          <input
            id="countryName"
            className={`${styles.input} ${errors.countryName ? styles.inputError : ''}`}
            value={form.countryName}
            onChange={set('countryName')}
            placeholder="e.g. United States, India…"
            autoFocus
          />
        </FormField>

        <FormField label="Description" name="description">
          <TextArea
            name="description"
            value={form.description}
            onChange={set('description')}
            placeholder="Optional notes about this country…"
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
