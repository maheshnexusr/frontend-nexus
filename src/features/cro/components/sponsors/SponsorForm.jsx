/**
 * SponsorForm — shared create / edit form for Sponsor records.
 * Used by both SponsorNewPage and SponsorEditPage.
 */

import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useDispatch }         from 'react-redux';
import { ArrowLeft }           from 'lucide-react';
import { sponsorsClient }      from '@/features/cro/api/sponsorsClient';
import { countriesClient }     from '@/features/cro/api/countriesClient';
import { addToast }            from '@/features/notifications/notificationSlice';
import FormField               from '@/components/form/FormField';
import TextArea                from '@/components/form/TextArea';
import SearchableDropdown      from '@/components/form/SearchableDropdown';
import ImageUpload             from '@/components/form/ImageUpload';
import styles from './SponsorForm.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = {
  photograph:         null,
  fullName:           '',
  contactNumber:      '',
  email:              '',
  organizationName:   '',
  website:            '',
  registrationNumber: '',
  addressLine1:       '',
  addressLine2:       '',
  city:               '',
  district:           '',
  state:              '',
  zipcode:            '',
  countryId:          '',
  countryName:        '',
  status:             'Active',
};

export default function SponsorForm({ mode, sponsorId }) {
  const isEdit   = mode === 'edit';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [form,           setForm]    = useState(EMPTY);
  const [errors,         setErrors]  = useState({});
  const [saving,         setSaving]  = useState(false);
  const [loadingData,    setLoading] = useState(isEdit);
  const [countryOptions, setCountryOptions] = useState([]);

  // Load active countries
  useEffect(() => {
    countriesClient.list().then((all) =>
      setCountryOptions(
        all
          .filter((c) => c.status === 'Active')
          .sort((a, b) => a.countryName.localeCompare(b.countryName))
          .map((c) => ({ value: c.id, label: c.countryName })),
      ),
    );
  }, []);

  // Load existing sponsor when editing
  useEffect(() => {
    if (!isEdit || !sponsorId) return;
    sponsorsClient.getById(sponsorId).then((s) => {
      if (s) setForm({ ...EMPTY, ...s });
      setLoading(false);
    });
  }, [isEdit, sponsorId]);

  // ── field helpers ─────────────────────────────────────────────────────────
  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCountryChange = (id) => {
    const opt = countryOptions.find((o) => o.value === id);
    setForm((prev) => ({ ...prev, countryId: id, countryName: opt?.label ?? '' }));
    setErrors((prev) => ({ ...prev, countryId: undefined }));
  };

  // ── validation + submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = {};
    if (!form.fullName.trim())           errs.fullName           = 'Full Name is required.';
    if (!form.contactNumber.trim())      errs.contactNumber      = 'Contact Number is required.';
    if (!form.email.trim())              errs.email              = 'Email Address is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email       = 'Please enter a valid email address.';
    if (!form.organizationName.trim())   errs.organizationName   = 'Organization Name is required.';
    if (!form.registrationNumber.trim()) errs.registrationNumber = 'Registration Number is required.';
    if (!form.city.trim())               errs.city               = 'City is required.';
    if (!form.district.trim())           errs.district           = 'District is required.';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      // Uniqueness checks (only for create; email is locked on edit)
      if (!isEdit) {
        const [emailTaken, regTaken] = await Promise.all([
          sponsorsClient.emailExists(form.email),
          sponsorsClient.regNumExists(form.registrationNumber),
        ]);
        if (emailTaken) { setErrors((p) => ({ ...p, email: 'Email Address already exists in the system.' })); setSaving(false); return; }
        if (regTaken)   { setErrors((p) => ({ ...p, registrationNumber: 'Registration Number already exists.' })); setSaving(false); return; }
      } else {
        const regTaken = await sponsorsClient.regNumExists(form.registrationNumber, sponsorId);
        if (regTaken) { setErrors((p) => ({ ...p, registrationNumber: 'Registration Number already exists.' })); setSaving(false); return; }
      }

      const saved = isEdit
        ? await sponsorsClient.update(sponsorId, form)
        : await sponsorsClient.create(form);

      dispatch(addToast({
        type:    'success',
        message: isEdit
          ? `Sponsor '${saved.fullName}' updated successfully.`
          : `Sponsor '${saved.fullName}' created successfully. An invitation email has been sent to ${saved.email}.`,
        duration: 5000,
      }));

      navigate('/cro/sponsors');
    } catch {
      dispatch(addToast({
        type:    'error',
        message: isEdit
          ? 'Failed to update sponsor. Please try again.'
          : 'Failed to create sponsor. Please try again.',
      }));
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/cro/sponsors')} type="button">
          <ArrowLeft size={16} />
          Back to Sponsors
        </button>
        <div className={styles.pageTitle}>
          <h1 className={styles.title}>{isEdit ? 'Edit Sponsor' : 'Add Sponsor'}</h1>
          <p className={styles.sub}>
            {isEdit ? `Editing: ${form.fullName || '—'}` : 'Fill in the details to register a new sponsor.'}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className={styles.card}>

        {/* ── Photo ──────────────────────────────────────────────────────── */}
        <div className={styles.photoRow}>
          <FormField label="Sponsor Photograph" name="photograph">
            <ImageUpload
              value={form.photograph}
              onChange={(val) => setForm((p) => ({ ...p, photograph: val }))}
              accept="image/jpeg,image/jpg,image/png"
              maxSize={2}
              circular
            />
          </FormField>
          <p className={styles.photoHint}>JPEG or PNG · max 2 MB</p>
        </div>

        {/* ── Section: Personal & Contact ───────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Personal & Contact</h3>
          <div className={styles.row2}>
            <FormField label="Full Name" name="fullName" required error={errors.fullName}>
              <input id="fullName" className={ic(styles, errors.fullName)} value={form.fullName} onChange={set('fullName')} placeholder="e.g. John Smith" />
            </FormField>
            <FormField label="Email Address" name="email" required error={errors.email}>
              <input
                id="email"
                type="email"
                className={ic(styles, errors.email)}
                value={form.email}
                onChange={set('email')}
                placeholder="sponsor@example.com"
                disabled={isEdit}
                style={isEdit ? { background: 'var(--bg-subtle,#f8fafc)', cursor: 'not-allowed', color: 'var(--text-secondary,#64748b)' } : undefined}
              />
            </FormField>
          </div>
          <div className={styles.row2}>
            <FormField label="Contact Number" name="contactNumber" required error={errors.contactNumber}>
              <input id="contactNumber" className={ic(styles, errors.contactNumber)} value={form.contactNumber} onChange={set('contactNumber')} placeholder="+1 555 000 0000" />
            </FormField>
            <FormField label="Status" name="status">
              <SearchableDropdown options={STATUS_OPTIONS} value={form.status} onChange={set('status')} placeholder="Select status" />
            </FormField>
          </div>
        </section>

        {/* ── Section: Organisation ─────────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Organisation</h3>
          <div className={styles.row2}>
            <FormField label="Organization Name" name="organizationName" required error={errors.organizationName}>
              <input id="organizationName" className={ic(styles, errors.organizationName)} value={form.organizationName} onChange={set('organizationName')} placeholder="e.g. Pfizer Inc." />
            </FormField>
            <FormField label="Registration Number" name="registrationNumber" required error={errors.registrationNumber}>
              <input id="registrationNumber" className={ic(styles, errors.registrationNumber)} value={form.registrationNumber} onChange={set('registrationNumber')} placeholder="Unique registration ID" />
            </FormField>
          </div>
          <div className={styles.row2}>
            <FormField label="Website" name="website">
              <input id="website" className={styles.input} value={form.website} onChange={set('website')} placeholder="https://example.com" type="url" />
            </FormField>
          </div>
        </section>

        {/* ── Section: Address ──────────────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Address</h3>
          <div className={styles.row2}>
            <FormField label="Address Line 1" name="addressLine1">
              <input id="addressLine1" className={styles.input} value={form.addressLine1} onChange={set('addressLine1')} placeholder="Street address" />
            </FormField>
            <FormField label="Address Line 2" name="addressLine2">
              <input id="addressLine2" className={styles.input} value={form.addressLine2} onChange={set('addressLine2')} placeholder="Apt, suite, floor…" />
            </FormField>
          </div>
          <div className={styles.row3}>
            <FormField label="City" name="city" required error={errors.city}>
              <input id="city" className={ic(styles, errors.city)} value={form.city} onChange={set('city')} placeholder="City" />
            </FormField>
            <FormField label="District" name="district" required error={errors.district}>
              <input id="district" className={ic(styles, errors.district)} value={form.district} onChange={set('district')} placeholder="District / County" />
            </FormField>
            <FormField label="State" name="state">
              <input id="state" className={styles.input} value={form.state} onChange={set('state')} placeholder="State / Province" />
            </FormField>
          </div>
          <div className={styles.row2}>
            <FormField label="Zipcode" name="zipcode">
              <input id="zipcode" className={styles.input} value={form.zipcode} onChange={set('zipcode')} placeholder="Postal / ZIP code" />
            </FormField>
            <FormField label="Country" name="countryId">
              <SearchableDropdown
                options={countryOptions}
                value={form.countryId}
                onChange={handleCountryChange}
                placeholder="Select country…"
                searchPlaceholder="Search countries…"
              />
            </FormField>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={() => navigate('/cro/sponsors')} disabled={saving} type="button">
            Cancel
          </button>
          <button className={styles.btnSave} onClick={handleSubmit} disabled={saving} type="button">
            {saving ? 'Saving…' : isEdit ? 'Update Sponsor' : 'Create Sponsor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ic(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
