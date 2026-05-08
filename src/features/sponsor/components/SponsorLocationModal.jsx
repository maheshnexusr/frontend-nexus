import { useState, useEffect } from 'react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { sponsorLocationsClient } from '@/features/sponsor/api/sponsorLocationsClient';
import { sponsorCountriesClient } from '@/features/sponsor/api/sponsorCountriesClient';
import styles from './SponsorLocationModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = {
  countryId:  '',
  state:      '',
  district:   '',
  city:       '',
  postalCode: '',
  status:     'Active',
};

export default function SponsorLocationModal({ mode, location, studyId, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,          setForm]     = useState(EMPTY);
  const [errors,        setErrors]   = useState({});
  const [saving,        setSaving]   = useState(false);
  const [countryOpts,   setCountries] = useState([]);

  // Load active countries for dropdown
  useEffect(() => {
    sponsorCountriesClient.list(studyId).then((all) =>
      setCountries(
        all
          .filter((c) => c.status === 'Active')
          .sort((a, b) => a.countryName.localeCompare(b.countryName))
          .map((c) => ({ value: c.id, label: c.countryName })),
      ),
    );
  }, [studyId]);

  useEffect(() => {
    if (isEdit && location) {
      setForm({
        countryId:  location.countryId  ?? '',
        state:      location.state      ?? '',
        district:   location.district   ?? '',
        city:       location.city       ?? '',
        postalCode: location.postalCode ?? '',
        status:     location.status     ?? 'Active',
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [isEdit, location]);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.countryId)         errs.countryId  = 'Country is required.';
    if (!form.state.trim())      errs.state      = 'State is required.';
    if (!form.district.trim())   errs.district   = 'District is required.';
    if (!form.city.trim())       errs.city       = 'City is required.';
    if (!form.postalCode.trim()) errs.postalCode = 'Postal Code is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const saved = isEdit
        ? await sponsorLocationsClient.update(studyId, location.id, form)
        : await sponsorLocationsClient.create(studyId, form);

      onSave(saved);
    } catch (err) {
      // 409 = duplicate combination
      if (err?.status === 409 || err?.response?.status === 409) {
        setErrors({ postalCode: 'Location with this Country, State, District, City, and Postal Code already exists.' });
      } else {
        onError(
          isEdit
            ? 'Failed to update location. Please try again.'
            : 'Failed to create location. Please try again.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button className={styles.btnSave}   onClick={handleSubmit} disabled={saving} type="button">
        {saving ? 'Saving…' : isEdit ? 'Update Location' : 'Create Location'}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Location' : 'Add Location'}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>

        <FormField label="Country" name="countryId" required error={errors.countryId}>
          <SearchableDropdown
            options={countryOpts}
            value={form.countryId}
            onChange={set('countryId')}
            placeholder="Select country…"
            searchPlaceholder="Search countries…"
          />
        </FormField>

        <div className={styles.row2}>
          <FormField label="State" name="state" required error={errors.state}>
            <input
              id="state"
              className={`${styles.input} ${errors.state ? styles.inputError : ''}`}
              value={form.state}
              onChange={set('state')}
              placeholder="e.g. California"
            />
          </FormField>

          <FormField label="District" name="district" required error={errors.district}>
            <input
              id="district"
              className={`${styles.input} ${errors.district ? styles.inputError : ''}`}
              value={form.district}
              onChange={set('district')}
              placeholder="e.g. Los Angeles County"
            />
          </FormField>
        </div>

        <div className={styles.row2}>
          <FormField label="City" name="city" required error={errors.city}>
            <input
              id="city"
              className={`${styles.input} ${errors.city ? styles.inputError : ''}`}
              value={form.city}
              onChange={set('city')}
              placeholder="e.g. Los Angeles"
            />
          </FormField>

          <FormField label="Postal Code" name="postalCode" required error={errors.postalCode}>
            <input
              id="postalCode"
              className={`${styles.input} ${errors.postalCode ? styles.inputError : ''}`}
              value={form.postalCode}
              onChange={set('postalCode')}
              placeholder="e.g. 90001"
            />
          </FormField>
        </div>

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
