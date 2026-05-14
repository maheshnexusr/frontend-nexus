import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import css from './SiteFormModal.module.css';

/**
 * SiteFormModal — Create or Edit a site.
 *
 * Props:
 *   site      object | null  (null = create mode)
 *   countries Array<string | { id, name }>  (for Country dropdown)
 *   onSave    (data) => Promise<void>
 *   onClose   () => void
 */

/* ── Common dialing codes (extend as needed) ─────────────────────────────── */
const DIALING_CODES = [
  { code: '+91',  label: 'India' },
  { code: '+1',   label: 'United States' },
  { code: '+44',  label: 'United Kingdom' },
  { code: '+61',  label: 'Australia' },
  { code: '+1',   label: 'Canada' },
  { code: '+49',  label: 'Germany' },
  { code: '+33',  label: 'France' },
  { code: '+81',  label: 'Japan' },
  { code: '+65',  label: 'Singapore' },
  { code: '+971', label: 'UAE' },
];

const EMPTY = {
  siteName:           '',
  siteLocation:       '',
  address:            '',
  pointOfContactName: '',
  email:              '',
  countryCode:        '+91',
  contactNumber:      '',
  postalCode:         '',
  city:               '',
  district:           '',
  state:              '',
  country:            '',
  active:             true,
};

const PHONE_RE = /^\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form) {
  const errs = {};
  if (!form.siteName.trim())                       errs.siteName   = 'Site Name is required.';
  if (!form.postalCode.trim())                     errs.postalCode = 'Postal Code is required.';
  if (form.email && !EMAIL_RE.test(form.email))    errs.email      = 'Enter a valid email address.';
  if (form.contactNumber && !PHONE_RE.test(form.contactNumber.replace(/\D/g, '')))
                                                   errs.contactNumber = 'Enter a valid 10-digit number.';
  return errs;
}

/** Normalize incoming site shape (from API or legacy form) into our form fields. */
function seedFromSite(site) {
  if (!site) return { ...EMPTY };
  const legacyAddress = [site.addressLine1, site.addressLine2].filter(Boolean).join('\n');
  return {
    ...EMPTY,
    siteName:           site.siteName           ?? '',
    siteLocation:       site.siteLocation       ?? '',
    address:            site.address            ?? legacyAddress,
    pointOfContactName: site.pointOfContactName ?? site.contactPerson ?? '',
    email:              site.email              ?? '',
    countryCode:        site.countryCode        ?? '+91',
    contactNumber:      site.contactNumber      ?? '',
    postalCode:         site.postalCode         ?? site.zipCode ?? '',
    city:               site.city               ?? '',
    district:           site.district           ?? '',
    state:              site.state              ?? '',
    country:            site.country            ?? '',
    active:             site.status ? site.status === 'Active' : (site.active ?? true),
  };
}

export default function SiteFormModal({ site, countries, onSave, onClose }) {
  const isEdit = !!site;
  const [form,       setForm]       = useState(() => seedFromSite(site));
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState('');

  useEffect(() => { setForm(seedFromSite(site)); }, [site]);

  const set = (field) => (val) => {
    setForm((p) => ({ ...p, [field]: val }));
    setErrors((p) => { const e = { ...p }; delete e[field]; return e; });
  };

  const handleSubmit = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError('');
    setSubmitting(true);
    try {
      await onSave({
        ...form,
        // Keep status string for backend compatibility
        status: form.active ? 'Active' : 'Inactive',
      });
    } catch (e) {
      setApiError(e?.response?.data?.message ?? e?.message ?? 'Failed to save site. Please try again.');
      setSubmitting(false);
    }
  };

  // Country options can come in as ['India', ...] or [{id, name}, ...].
  const countryOpts = (countries ?? []).map((c) =>
    typeof c === 'string' ? { value: c, label: c } : { value: c.id ?? c.name, label: c.name ?? c.id },
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className={css.titleRow}>
          <button type="button" className={css.backBtn} onClick={onClose} aria-label="Back">
            <ArrowLeft size={15} /> Back
          </button>
          <span className={css.titleText}>{isEdit ? 'Edit Site' : 'Create New Site'}</span>
        </span>
      }
      footer={
        <div className={css.footer}>
          <label className={css.activeWrap}>
            <span className={css.toggle}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active')(e.target.checked)}
              />
              <span className={`${css.toggleTrack} ${form.active ? css.toggleTrackOn : ''}`} />
            </span>
            <span className={css.activeLabel}>Active Status</span>
          </label>

          <div className={css.footerActions}>
            <button className={css.btnCancel} onClick={onClose} disabled={submitting}>Cancel</button>
            <button className={css.btnSave} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Site'}
            </button>
          </div>
        </div>
      }
    >
      <div className={css.body}>
        {apiError && <div className={css.apiError}>{apiError}</div>}

        {/* Row: Site Name + Site Location */}
        <div className={css.grid2}>
          <Field label="Site Name" req error={errors.siteName}>
            <input
              className={`${css.input} ${errors.siteName ? css.inputError : ''}`}
              value={form.siteName}
              onChange={(e) => set('siteName')(e.target.value)}
            />
          </Field>
          <Field label="Site Location">
            <input
              className={css.input}
              value={form.siteLocation}
              onChange={(e) => set('siteLocation')(e.target.value)}
            />
          </Field>
        </div>

        {/* Row: Address (full width textarea) */}
        <Field label="Address">
          <textarea
            className={`${css.input} ${css.textarea}`}
            rows={3}
            value={form.address}
            onChange={(e) => set('address')(e.target.value)}
          />
        </Field>

        {/* Row: Point of Contact + Email */}
        <div className={css.grid2}>
          <Field label="Point of Contact Name">
            <input
              className={css.input}
              value={form.pointOfContactName}
              onChange={(e) => set('pointOfContactName')(e.target.value)}
            />
          </Field>
          <Field label="Email Address" error={errors.email}>
            <input
              type="email"
              className={`${css.input} ${errors.email ? css.inputError : ''}`}
              placeholder="Enter email address"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
            />
          </Field>
        </div>

        {/* Row: Country Code + Contact Number */}
        <div className={css.grid2}>
          <Field label="Country Code">
            <select
              className={css.input}
              value={form.countryCode}
              onChange={(e) => set('countryCode')(e.target.value)}
            >
              {DIALING_CODES.map((c) => (
                <option key={`${c.code}-${c.label}`} value={c.code}>
                  {c.code} ({c.label})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact Number" error={errors.contactNumber}>
            <input
              className={`${css.input} ${errors.contactNumber ? css.inputError : ''}`}
              placeholder="Enter 10-digit phone number"
              value={form.contactNumber}
              onChange={(e) => set('contactNumber')(e.target.value)}
            />
          </Field>
        </div>

        {/* Row: Postal Code + City */}
        <div className={css.grid2}>
          <Field label="Postal Code" req error={errors.postalCode}>
            <input
              className={`${css.input} ${errors.postalCode ? css.inputError : ''}`}
              placeholder="Select or enter postal code…"
              value={form.postalCode}
              onChange={(e) => set('postalCode')(e.target.value)}
            />
          </Field>
          <Field label="City">
            <input
              className={css.input}
              placeholder="Select or enter city…"
              value={form.city}
              onChange={(e) => set('city')(e.target.value)}
            />
          </Field>
        </div>

        {/* Row: District + State */}
        <div className={css.grid2}>
          <Field label="District">
            <input
              className={css.input}
              placeholder="Select or enter district…"
              value={form.district}
              onChange={(e) => set('district')(e.target.value)}
            />
          </Field>
          <Field label="State">
            <input
              className={css.input}
              placeholder="Select state…"
              value={form.state}
              onChange={(e) => set('state')(e.target.value)}
            />
          </Field>
        </div>

        {/* Row: Country (full width) */}
        <Field label="Country">
          {countryOpts.length > 0 ? (
            <select
              className={css.input}
              value={form.country}
              onChange={(e) => set('country')(e.target.value)}
            >
              <option value="">Select country…</option>
              {countryOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              className={css.input}
              placeholder="Select country…"
              value={form.country}
              onChange={(e) => set('country')(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
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
