import { useState, useEffect } from 'react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import TextArea           from '@/components/form/TextArea';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { regionsClient }  from '@/features/cro/api/regionsClient';
import styles from './RegionModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = { regionName: '', description: '', status: 'Active' };

export default function RegionModal({ mode, region, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && region) {
      setForm({ regionName: region.regionName, description: region.description ?? '', status: region.status });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [isEdit, region]);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.regionName.trim()) errs.regionName = 'Region Name is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const exists = await regionsClient.nameExists(form.regionName, isEdit ? region.id : null);
      if (exists) {
        setErrors({ regionName: 'Region Name already exists. Please use a unique name.' });
        setSaving(false);
        return;
      }

      const saved = isEdit
        ? await regionsClient.update(region.id, form)
        : await regionsClient.create(form);

      onSave(saved);
    } catch {
      onError(
        isEdit
          ? 'Failed to update region. Please try again.'
          : 'Failed to create region. Please try again.',
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
        {saving ? 'Saving…' : isEdit ? 'Update Region' : 'Create Region'}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Region' : 'Add Region'}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        <FormField label="Region Name" name="regionName" required error={errors.regionName}>
          <input
            id="regionName"
            className={`${styles.input} ${errors.regionName ? styles.inputError : ''}`}
            value={form.regionName}
            onChange={set('regionName')}
            placeholder="e.g. North America, Europe, Asia-Pacific…"
            autoFocus
          />
        </FormField>

        <FormField label="Description" name="description">
          <TextArea
            name="description"
            value={form.description}
            onChange={set('description')}
            placeholder="List the countries covered or describe the region's scope…"
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
