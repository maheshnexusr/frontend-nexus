import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import css from './SiteFormModal.module.css';

/**
 * SiteFormModal — Create or Edit a site.
 *
 * Props:
 *   site      object | null  (null = create mode)
 *   countries string[]       (for Country dropdown)
 *   onSave    (data) => Promise<void>
 *   onClose   () => void
 */

const EMPTY = {
  siteCode:            '',
  siteName:            '',
  expectedEnrollments: '',
  status:              'Active',
  isLocked:            false,
  contactPerson:       '',
  email:               '',
  contactNumber:       '',
  addressLine1:        '',
  addressLine2:        '',
  city:                '',
  state:               '',
  country:             '',
};

function validate(form, isEdit) {
  const errs = {};
  if (!isEdit && !form.siteCode.trim())           errs.siteCode            = 'Site Code is required.';
  if (!form.siteName.trim())                       errs.siteName            = 'Site Name is required.';
  const exp = Number(form.expectedEnrollments);
  if (!form.expectedEnrollments || isNaN(exp) || exp < 0)
                                                   errs.expectedEnrollments = 'Expected Enrollments must be a positive number.';
  if (!form.contactPerson.trim())                  errs.contactPerson       = 'Contact Person is required.';
  if (!form.email.trim())                          errs.email               = 'Email Address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                                   errs.email               = 'Email Address must be valid.';
  if (!form.contactNumber.trim())                  errs.contactNumber       = 'Contact Number is required.';
  if (!form.city.trim())                           errs.city                = 'City is required.';
  if (!form.state.trim())                          errs.state               = 'State is required.';
  if (!form.country.trim())                        errs.country             = 'Country is required.';
  return errs;
}

export default function SiteFormModal({ site, countries, onSave, onClose }) {
  const isEdit = !!site;
  const [form,       setForm]       = useState(() => site ? { ...EMPTY, ...site, expectedEnrollments: String(site.expectedEnrollments ?? '') } : { ...EMPTY });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState('');

  useEffect(() => {
    if (site) setForm({ ...EMPTY, ...site, expectedEnrollments: String(site.expectedEnrollments ?? '') });
  }, [site]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  }

  async function handleSubmit() {
    const errs = validate(form, isEdit);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError('');
    setSubmitting(true);
    try {
      await onSave({ ...form, expectedEnrollments: Number(form.expectedEnrollments) });
    } catch (e) {
      setApiError(e?.response?.data?.message ?? e?.message ?? 'Failed to save site. Please try again.');
      setSubmitting(false);
    }
  }

  function Field({ label, req, error, children }) {
    return (
      <div className={css.field}>
        <label className={css.label}>{label}{req && <span className={css.req}> *</span>}</label>
        {children}
        {error && <span className={css.fieldError}>{error}</span>}
      </div>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? `Edit Site — ${site.siteCode}` : 'Create New Site'}
      size="lg"
      footer={
        <div className={css.footer}>
          <button className={css.btnCancel} onClick={onClose} disabled={submitting}>Cancel</button>
          <button className={css.btnSave} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Site'}
          </button>
        </div>
      }
    >
      <div className={css.body}>
        {apiError && <div className={css.apiError}>{apiError}</div>}

        {/* ── Section A: Basic Info ───────────────────────────────────────── */}
        <div className={css.section}>
          <h3 className={css.sectionTitle}>Basic Information</h3>
          <div className={css.grid2}>
            <Field label="Site Code" req error={errors.siteCode}>
              <input
                className={`${css.input} ${errors.siteCode ? css.inputError : ''}`}
                placeholder="e.g. SITE-001"
                value={form.siteCode}
                onChange={(e) => set('siteCode', e.target.value)}
                disabled={isEdit}
                readOnly={isEdit}
              />
            </Field>
            <Field label="Site Name" req error={errors.siteName}>
              <input
                className={`${css.input} ${errors.siteName ? css.inputError : ''}`}
                placeholder="e.g. City Hospital New York"
                value={form.siteName}
                onChange={(e) => set('siteName', e.target.value)}
              />
            </Field>
            <Field label="Expected Enrollments" req error={errors.expectedEnrollments}>
              <input
                type="number"
                min={0}
                className={`${css.input} ${errors.expectedEnrollments ? css.inputError : ''}`}
                placeholder="0"
                value={form.expectedEnrollments}
                onChange={(e) => set('expectedEnrollments', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                className={css.input}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <div className={css.lockRow}>
            <span className={css.lockLabel}>
              <Lock size={13} /> Site Lock
            </span>
            <label className={css.toggle}>
              <input
                type="checkbox"
                checked={form.isLocked}
                onChange={(e) => set('isLocked', e.target.checked)}
              />
              <span className={css.toggleTrack} />
            </label>
            <span className={css.lockState}>{form.isLocked ? 'Locked' : 'Unlocked'}</span>
          </div>
        </div>

        {/* ── Section B: Contact Info ─────────────────────────────────────── */}
        <div className={css.section}>
          <h3 className={css.sectionTitle}>Contact Information</h3>
          <div className={css.grid2}>
            <Field label="Contact Person" req error={errors.contactPerson}>
              <input
                className={`${css.input} ${errors.contactPerson ? css.inputError : ''}`}
                placeholder="Principal Investigator name"
                value={form.contactPerson}
                onChange={(e) => set('contactPerson', e.target.value)}
              />
            </Field>
            <Field label="Email Address" req error={errors.email}>
              <input
                type="email"
                className={`${css.input} ${errors.email ? css.inputError : ''}`}
                placeholder="contact@hospital.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Contact Number" req error={errors.contactNumber}>
              <input
                className={`${css.input} ${errors.contactNumber ? css.inputError : ''}`}
                placeholder="+1 555 000 0000"
                value={form.contactNumber}
                onChange={(e) => set('contactNumber', e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* ── Section C: Address Info ─────────────────────────────────────── */}
        <div className={css.section}>
          <h3 className={css.sectionTitle}>Address Information</h3>
          <div className={css.grid1}>
            <Field label="Address Line 1">
              <input
                className={css.input}
                placeholder="Street address"
                value={form.addressLine1}
                onChange={(e) => set('addressLine1', e.target.value)}
              />
            </Field>
            <Field label="Address Line 2">
              <input
                className={css.input}
                placeholder="Suite / Floor / Building"
                value={form.addressLine2}
                onChange={(e) => set('addressLine2', e.target.value)}
              />
            </Field>
          </div>
          <div className={css.grid3}>
            <Field label="City" req error={errors.city}>
              <input
                className={`${css.input} ${errors.city ? css.inputError : ''}`}
                placeholder="City"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </Field>
            <Field label="State / Province" req error={errors.state}>
              <input
                className={`${css.input} ${errors.state ? css.inputError : ''}`}
                placeholder="State"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
              />
            </Field>
            <Field label="Country" req error={errors.country}>
              {countries && countries.length > 0 ? (
                <select
                  className={`${css.input} ${errors.country ? css.inputError : ''}`}
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                >
                  <option value="">— Select —</option>
                  {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  className={`${css.input} ${errors.country ? css.inputError : ''}`}
                  placeholder="Country"
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                />
              )}
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}
