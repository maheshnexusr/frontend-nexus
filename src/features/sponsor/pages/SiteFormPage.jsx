/**
 * SiteFormPage — full-page Create / Edit Site form for the sponsor workspace.
 *
 * Routes:
 *   /sponsor/:studyId/sites/new
 *   /sponsor/:studyId/sites/:siteId/edit
 *
 * Mirrors the CRO SponsorForm layout (top bar with Back, single card with
 * sectioned content, footer with Active toggle + Cancel/Save).
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft } from 'lucide-react';

import FormField         from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { addToast }      from '@/app/notificationSlice';
import { sponsorSitesClient }     from '@/features/sponsor/api/sponsorSitesClient';
import { sponsorCountriesClient } from '@/features/sponsor/api/sponsorCountriesClient';
import { sponsorPersonnelClient } from '@/features/sponsor/api/sponsorPersonnelClient';
import { sponsorRolesClient }     from '@/features/sponsor/api/sponsorRolesClient';

import styles from './SiteFormPage.module.css';

const PHONE_RE = /^\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY = {
  // Sponsor-assigned identifier for the site (stored as `site_number` on the
  // tenant `sites` table; aliased as site_code everywhere else on the wire).
  siteCode:           '',
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
  countryId:          '',
  active:             true,
};

function ic(s, err) { return err ? `${s.input} ${s.inputError}` : s.input; }

function seedFromSite(site) {
  if (!site) return { ...EMPTY };
  const legacyAddress = [site.addressLine1, site.addressLine2].filter(Boolean).join('\n');
  return {
    ...EMPTY,
    siteCode:           site.siteCode ?? site.siteNumber ?? site.site_number ?? '',
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
    countryId:          site.countryId          ?? '',
    active:             site.status ? site.status === 'Active' : (site.active ?? true),
  };
}

export default function SiteFormPage() {
  const { studyId, siteId } = useParams();
  const navigate            = useNavigate();
  const dispatch            = useDispatch();
  const isEdit              = !!siteId;

  const [form,         setForm]        = useState(EMPTY);
  const [errors,       setErrors]      = useState({});
  const [loading,      setLoading]     = useState(isEdit);
  const [saving,       setSaving]      = useState(false);
  const [apiError,     setApiError]    = useState('');
  const [countryOpts,  setCountryOpts] = useState([]);
  const [dialingCodes, setDialingCodes] = useState([]);

  // ── Load active countries for both Country dropdown and Country Code list ──
  // Uses the auth-only lookup endpoint — populating this dropdown must not
  // require the `masters` permission.
  useEffect(() => {
    sponsorCountriesClient.lookup()
      .then((all) => {
        const active = all.filter((c) => c.status === 'Active');
        setCountryOpts(
          active
            .sort((a, b) => a.countryName.localeCompare(b.countryName))
            .map((c) => ({ value: c.id, label: c.countryName, dialingCode: c.dialingCode })),
        );
        // Build dialing-code options from the loaded countries (fall back to a
        // stock list if the master is empty so the field is never broken).
        const codes = active
          .filter((c) => c.dialingCode)
          .map((c) => ({ code: c.dialingCode, label: c.countryName }));
        if (codes.length > 0) setDialingCodes(codes);
        else setDialingCodes(FALLBACK_CODES);
      })
      .catch(() => {
        setDialingCodes(FALLBACK_CODES);
        dispatch(addToast({ type: 'error', message: 'Failed to load countries.' }));
      });
  }, [studyId, dispatch]);

  // ── Load existing site when editing ────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    sponsorSitesClient.getById?.(studyId, siteId)
      ?.then((site) => { setForm(seedFromSite(site)); })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load site.' })))
      .finally(() => setLoading(false));
  }, [isEdit, studyId, siteId, dispatch]);

  const set = (field) => (val) => {
    const v = val?.target ? val.target.value : val;
    setForm((p) => ({ ...p, [field]: v }));
    setErrors((p) => { const e = { ...p }; delete e[field]; return e; });
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.siteCode.trim())                     errs.siteCode   = 'Site ID is required.';
    if (!form.siteName.trim())                     errs.siteName   = 'Site Name is required.';
    if (!form.postalCode.trim())                   errs.postalCode = 'Postal Code is required.';
    if (form.email && !EMAIL_RE.test(form.email))  errs.email      = 'Enter a valid email address.';
    if (form.contactNumber && !PHONE_RE.test(form.contactNumber.replace(/\D/g, '')))
                                                   errs.contactNumber = 'Enter a valid 10-digit number.';
    return errs;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError('');
    setSaving(true);
    try {
      const payload = { ...form, status: form.active ? 'Active' : 'Inactive' };

      if (isEdit) {
        await sponsorSitesClient.update(studyId, siteId, payload);
        dispatch(addToast({ type: 'success', message: 'Site updated successfully.' }));
      } else {
        const created = await sponsorSitesClient.create(studyId, payload);
        dispatch(addToast({ type: 'success', message: 'Site created successfully.' }));

        // On create: if a Point of Contact + email were supplied, chain a
        // personnel-invite call so the PI receives an activation email.
        // Site creation alone does not send mail — the invite endpoint is
        // the one that builds the activation link.
        const piName  = form.pointOfContactName?.trim();
        const piEmail = form.email?.trim();
        const newSiteId = created?.id ?? created?.siteId;
        if (newSiteId && piName && piEmail) {
          try {
            // Find a Principal Investigator role from the active Site Roles
            // master; if none exists, fall back to the first active role so
            // the invite still goes through.
            const roles  = await sponsorRolesClient.lookup(studyId, { status: 'Active' });
            const active = roles.filter((r) => r.status === 'Active');
            const piRole = active.find((r) =>
                              /principal.*investigator|^pi$/i.test(r.roleName ?? ''),
                           ) ?? active[0];

            if (!piRole) {
              dispatch(addToast({
                type: 'warning',
                message: 'Site created. Create a Principal Investigator role under Site Roles, then invite the PI from Site Personnel.',
                duration: 6000,
              }));
            } else {
              await sponsorPersonnelClient.invite(studyId, {
                siteId:           newSiteId,
                fullName:         piName,
                email:            piEmail,
                contactNumber:    form.contactNumber || '',
                role:             piRole.roleName,
                roleId:           piRole.id,
                status:           'Active',
                consentRequired:  true,
              });
              dispatch(addToast({
                type:    'success',
                message: `Invitation email sent to ${piEmail}.`,
                duration: 5000,
              }));
            }
          } catch (inviteErr) {
            // The site itself is already saved — surface the invite failure
            // without rolling back. The user can resend from the Personnel page.
            const msg = inviteErr?.response?.data?.message ?? inviteErr?.message ?? '';
            dispatch(addToast({
              type:    'warning',
              message: `Site created, but invitation could not be sent: ${msg || 'unknown error'}. You can invite the PI manually from Site Personnel.`,
              duration: 7000,
            }));
          }
        }
      }
      navigate(`/sponsor/${studyId}/sites`);
    } catch (e) {
      setApiError(e?.response?.data?.message ?? e?.message ?? 'Failed to save site. Please try again.');
      setSaving(false);
    }
  };

  const handleCancel = () => navigate(`/sponsor/${studyId}/sites`);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}><div className={styles.spinner} /></div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={handleCancel} type="button">
          <ArrowLeft size={16} /> Back
        </button>
        <div className={styles.pageTitle}>
          <h1 className={styles.title}>{isEdit ? 'Edit Site' : 'Create New Site'}</h1>
          <p className={styles.sub}>
            {isEdit ? 'Update the site details below.' : 'Fill in the details to register a new site.'}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className={styles.card}>
        {apiError && <div className={styles.apiError}>{apiError}</div>}

        <section className={styles.section}>
          <div className={styles.row2}>
            <FormField label="Site ID" name="siteCode" required error={errors.siteCode}>
              <input
                id="siteCode"
                className={ic(styles, errors.siteCode)}
                value={form.siteCode}
                onChange={set('siteCode')}
                placeholder="e.g. S001"
              />
            </FormField>
            <FormField label="Site Name" name="siteName" required error={errors.siteName}>
              <input
                id="siteName"
                className={ic(styles, errors.siteName)}
                value={form.siteName}
                onChange={set('siteName')}
              />
            </FormField>
          </div>
          <div className={styles.row2}>
            <FormField label="Site Location" name="siteLocation">
              <input
                id="siteLocation"
                className={styles.input}
                value={form.siteLocation}
                onChange={set('siteLocation')}
              />
            </FormField>
            <div /> {/* spacer for grid balance */}
          </div>

          <FormField label="Address" name="address">
            <textarea
              id="address"
              className={`${styles.input} ${styles.textarea}`}
              rows={3}
              value={form.address}
              onChange={set('address')}
            />
          </FormField>

          <div className={styles.row2}>
            <FormField label="Point of Contact Name" name="pointOfContactName">
              <input
                id="pointOfContactName"
                className={styles.input}
                value={form.pointOfContactName}
                onChange={set('pointOfContactName')}
              />
            </FormField>
            <FormField label="Email Address" name="email" error={errors.email}>
              <input
                id="email"
                type="email"
                className={ic(styles, errors.email)}
                placeholder="Enter email address"
                value={form.email}
                onChange={set('email')}
              />
            </FormField>
          </div>

          <div className={styles.row2}>
            <FormField label="Country Code" name="countryCode">
              <SearchableDropdown
                options={dialingCodes.map((c) => ({
                  value: `${c.code}|${c.label}`,   // unique value to disambiguate +1 (US/CA)
                  label: `${c.code} (${c.label})`,
                }))}
                value={`${form.countryCode}|${
                  dialingCodes.find((c) => c.code === form.countryCode)?.label ?? ''
                }`}
                onChange={(v) => set('countryCode')(v ? v.split('|')[0] : '')}
                placeholder="Select country code…"
                searchPlaceholder="Search…"
              />
            </FormField>
            <FormField label="Contact Number" name="contactNumber" error={errors.contactNumber}>
              <input
                id="contactNumber"
                className={ic(styles, errors.contactNumber)}
                placeholder="Enter 10-digit phone number"
                value={form.contactNumber}
                onChange={set('contactNumber')}
              />
            </FormField>
          </div>

          <div className={styles.row2}>
            <FormField label="Postal Code" name="postalCode" required error={errors.postalCode}>
              <input
                id="postalCode"
                className={ic(styles, errors.postalCode)}
                placeholder="Enter postal code"
                value={form.postalCode}
                onChange={set('postalCode')}
              />
            </FormField>
            <FormField label="City" name="city">
              <input
                id="city"
                className={styles.input}
                value={form.city}
                onChange={set('city')}
              />
            </FormField>
          </div>

          <div className={styles.row2}>
            <FormField label="District" name="district">
              <input
                id="district"
                className={styles.input}
                value={form.district}
                onChange={set('district')}
              />
            </FormField>
            <FormField label="State" name="state">
              <input
                id="state"
                className={styles.input}
                value={form.state}
                onChange={set('state')}
              />
            </FormField>
          </div>

          <FormField label="Country" name="countryId">
            <SearchableDropdown
              options={countryOpts}
              value={form.countryId}
              onChange={(v) => set('countryId')(v ?? '')}
              placeholder={countryOpts.length === 0 ? 'No countries available' : 'Select country…'}
              searchPlaceholder="Search countries…"
            />
          </FormField>
        </section>

        {/* Footer */}
        <div className={styles.footer}>
          <label className={styles.activeWrap}>
            <span className={styles.toggle}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active')(e.target.checked)}
              />
              <span className={`${styles.toggleTrack} ${form.active ? styles.toggleTrackOn : ''}`} />
            </span>
            <span className={styles.activeLabel}>Active Status</span>
          </label>

          <div className={styles.footerActions}>
            <button className={styles.btnCancel} onClick={handleCancel} disabled={saving} type="button">
              Cancel
            </button>
            <button className={styles.btnSave} onClick={handleSubmit} disabled={saving} type="button">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Site'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Stock dialing codes used only when the Countries master is empty. */
const FALLBACK_CODES = [
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
