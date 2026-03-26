import { useState, useEffect } from 'react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { locationsClient } from '@/features/cro/api/locationsClient';
import { countriesClient } from '@/features/cro/api/countriesClient';
import styles from './LocationModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = {
  countryId:   '',
  countryName: '',
  state:       '',
  district:    '',
  city:        '',
  postalCode:  '',
  status:      'Active',
};

export default function LocationModal({ mode, location, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,            setForm]           = useState(EMPTY);
  const [errors,          setErrors]         = useState({});
  const [saving,          setSaving]         = useState(false);
  const [countryOptions,  setCountryOptions] = useState([]);

  // Load active countries for dropdown
  useEffect(() => {
    countriesClient.list().then((all) => {
      setCountryOptions(
        all
          .filter((c) => c.status === 'Active')
          .sort((a, b) => a.countryName.localeCompare(b.countryName))
          .map((c) => ({ value: c.id, label: c.countryName })),
      );
    });
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (isEdit && location) {
      setForm({
        countryId:   location.countryId,
        countryName: location.countryName,
        state:       location.state,
        district:    location.district ?? '',
        city:        location.city,
        postalCode:  location.postalCode,
        status:      location.status,
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [isEdit, location]);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined, combination: undefined }));
  };

  // When country changes via SearchableDropdown, also store countryName
  const handleCountryChange = (countryId) => {
    const opt = countryOptions.find((o) => o.value === countryId);
    setForm((prev) => ({ ...prev, countryId, countryName: opt?.label ?? '' }));
    setErrors((prev) => ({ ...prev, countryId: undefined, combination: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.countryId)          errs.countryId  = 'Country is required.';
    if (!form.state.trim())       errs.state      = 'State is required.';
    if (!form.city.trim())        errs.city       = 'City is required.';
    if (!form.postalCode.trim())  errs.postalCode = 'Postal Code is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const dup = await locationsClient.combinationExists(form, isEdit ? location.id : null);
      if (dup) {
        setErrors({ combination: 'Location with this Country, State, District, City, and Postal Code already exists.' });
        setSaving(false);
        return;
      }

      const saved = isEdit
        ? await locationsClient.update(location.id, form)
        : await locationsClient.create(form);

      onSave(saved);
    } catch {
      onError(
        isEdit
          ? 'Failed to update location. Please try again.'
          : 'Failed to create location. Please try again.',
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
        {saving ? 'Saving…' : isEdit ? 'Update Location' : 'Create Location'}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Location' : 'Add Location'}
      size="md"
      footer={footer}
    >
      <div className={styles.body}>
        {/* Combination error */}
        {errors.combination && (
          <div className={styles.comboError}>{errors.combination}</div>
        )}

        {/* Country */}
        <FormField label="Country" name="countryId" required error={errors.countryId}>
          <SearchableDropdown
            options={countryOptions}
            value={form.countryId}
            onChange={handleCountryChange}
            placeholder="Select country…"
            searchPlaceholder="Search countries…"
            error={!!errors.countryId}
          />
        </FormField>

        {/* State + District */}
        <div className={styles.row2}>
          <FormField label="State / Province" name="state" required error={errors.state}>
            <input
              id="state"
              className={inputCls(styles, errors.state)}
              value={form.state}
              onChange={set('state')}
              placeholder="e.g. California"
            />
          </FormField>
          <FormField label="District / County" name="district">
            <input
              id="district"
              className={styles.input}
              value={form.district}
              onChange={set('district')}
              placeholder="Optional"
            />
          </FormField>
        </div>

        {/* City + Postal Code */}
        <div className={styles.row2}>
          <FormField label="City" name="city" required error={errors.city}>
            <input
              id="city"
              className={inputCls(styles, errors.city)}
              value={form.city}
              onChange={set('city')}
              placeholder="e.g. Los Angeles"
            />
          </FormField>
          <FormField label="Postal Code" name="postalCode" required error={errors.postalCode}>
            <input
              id="postalCode"
              className={inputCls(styles, errors.postalCode)}
              value={form.postalCode}
              onChange={set('postalCode')}
              placeholder="e.g. 90001"
            />
          </FormField>
        </div>

        {/* Status */}
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

function inputCls(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
