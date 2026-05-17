import { useState, useEffect } from 'react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import TextArea           from '@/components/form/TextArea';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { sponsorCountriesClient } from '@/features/sponsor/api/sponsorCountriesClient';
import styles from './SponsorCountryModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = {
  countryName: '',
  countryCode: '',
  dialingCode: '',
  description: '',
  status:      'Active',
};

export default function SponsorCountryModal({ mode, country, studyId, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && country) {
      setForm({
        countryName: country.countryName ?? '',
        countryCode: country.countryCode ?? '',
        dialingCode: country.dialingCode ?? '',
        description: country.description ?? '',
        status:      country.status      ?? 'Active',
      });
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
    if (!form.countryCode.trim()) errs.countryCode = 'Country Code is required.';
    else if (!/^[A-Za-z]{2}$/.test(form.countryCode.trim()))
      errs.countryCode = 'Country Code must be a 2-letter ISO code (e.g. US, IN).';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const currentId = isEdit ? country.id : null;

      const nameTaken = await sponsorCountriesClient.nameExists(studyId, form.countryName.trim(), currentId);
      if (nameTaken) {
        setErrors({ countryName: 'Country Name already exists. Please use a unique name.' });
        setSaving(false);
        return;
      }

      const codeTaken = await sponsorCountriesClient.codeExists(studyId, form.countryCode.trim().toUpperCase(), currentId);
      if (codeTaken) {
        setErrors({ countryCode: 'Country Code already exists. Please use a unique code.' });
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        countryCode: form.countryCode.trim().toUpperCase(),
      };

      const saved = isEdit
        ? await sponsorCountriesClient.update(studyId, country.id, payload)
        : await sponsorCountriesClient.create(studyId, payload);

      onSave(saved);
    } catch {
      onError(
        isEdit
          ? 'Failed to update country. Please try again.'
          : 'Failed to create country. Please try again.',
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
            placeholder="e.g. United States"
            autoFocus
          />
        </FormField>

        <div className={styles.row2}>
          <FormField label="Country Code" name="countryCode" required error={errors.countryCode}>
            <input
              id="countryCode"
              className={`${styles.input} ${errors.countryCode ? styles.inputError : ''}`}
              value={form.countryCode}
              onChange={set('countryCode')}
              placeholder="e.g. US"
              maxLength={2}
            />
          </FormField>

          <FormField label="Dialing Code" name="dialingCode" error={errors.dialingCode}>
            <input
              id="dialingCode"
              className={styles.input}
              value={form.dialingCode}
              onChange={set('dialingCode')}
              placeholder="e.g. +1"
            />
          </FormField>
        </div>

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
