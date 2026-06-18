/**
 * PersonnelFormPage — full-page Invite / Edit Site Personnel for the sponsor
 * workspace.
 *
 * Routes:
 *   /sponsor/:studyId/personnel/new
 *   /sponsor/:studyId/personnel/:personnelId/edit
 *
 * Same fields as the legacy PersonnelFormModal but rendered as a full page,
 * matching the SiteFormPage / SiteRoleFormPage layout.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft } from 'lucide-react';

import FormField           from '@/components/form/FormField';
import SearchableDropdown  from '@/components/form/SearchableDropdown';
import { sponsorPersonnelClient } from '@/features/sponsor/api/sponsorPersonnelClient';
import { sponsorSitesClient }     from '@/features/sponsor/api/sponsorSitesClient';
import { sponsorRolesClient }     from '@/features/sponsor/api/sponsorRolesClient';
import { addToast }               from '@/app/notificationSlice';

import styles from './PersonnelFormPage.module.css';

// ── Constants ───────────────────────────────────────────────────────────────
// Role dropdown is populated entirely from the Site Roles master
// (sponsorRolesClient.list). No hardcoded defaults — if the master is empty,
// the user must create roles under "Site Management → Site Role" first.

const COMP_TYPES    = ['None', 'Per Study', 'Per Subject', 'Per Visit', 'Milestone Based'];
const CURRENCIES    = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CHF'];
const PAY_SCHEDULES = ['One-time', 'Monthly', 'Quarterly', 'Upon Completion', 'Milestone-based'];
const PAY_METHODS   = ['Bank Transfer', 'Check', 'Digital Wallet', 'Other'];

const EMPTY_COMP = {
  type:                'None',
  amount:              '',
  currency:            'USD',
  paymentSchedule:     'One-time',
  paymentMethod:       'Bank Transfer',
  bankDetailsRequired: false,
};

const EMPTY = {
  fullName:       '',
  email:          '',
  role:           '',   // role_name (for display)
  roleId:         '',   // site_roles.role_id — what the API expects
  // Consent form assigned to this person. Only required/shown when the selected
  // role has Consent Required enabled.
  consentTemplateId: '',
  // Multi-site assignment. `assignAllSites=true` posts every active site;
  // otherwise `siteIds` is the explicit subset the user picked.
  assignAllSites: false,
  siteIds:        [],
  status:         'Active',
  // Per-personnel subject cap (spec 16). '' = unlimited. Once the person has
  // completed the CRF for this many subjects they are auto-locked out until a
  // CRO Admin raises it.
  maxSubjects:    '',
  compensation:   { ...EMPTY_COMP },
};

// "S001 — Main Hospital" — site code first, name after the em-dash. Either may
// be missing; fall back to whichever is present.
const formatSiteLabel = (s) => {
  const code = (s.siteCode ?? '').trim();
  const name = (s.siteName ?? '').trim();
  if (code && name) return `${code} — ${name}`;
  return code || name || '(unnamed site)';
};

function ic(s, err) { return err ? `${s.input} ${s.inputError}` : s.input; }
function asOpt(arr) { return arr.map((v) => ({ value: v, label: v })); }

function validate(form, isEdit, consentApplicable) {
  const e = {};
  if (!form.fullName.trim())                                e.fullName = 'Full Name is required.';
  if (!isEdit) {
    if (!form.email.trim())                                 e.email    = 'Email Address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email    = 'Email Address must be valid.';
  }
  if (!form.role)                                           e.role     = 'Role is required.';
  // A consent form is only required when the role needs consent AND a form exists
  // for it; with no form available the assignment is skipped (not a blocker).
  if (consentApplicable && !form.consentTemplateId)        e.consentTemplateId = 'Please assign a consent form for this role.';
  // Either "All Sites" is chosen OR at least one specific site is selected.
  if (!form.assignAllSites && (!Array.isArray(form.siteIds) || form.siteIds.length === 0)) {
    e.siteIds = 'Pick at least one site, or choose "All Sites".';
  }
  if (form.compensation.type !== 'None') {
    const amt = Number(form.compensation.amount);
    if (!form.compensation.amount || Number.isNaN(amt) || amt <= 0) {
      e.compAmount = 'Compensation amount must be greater than zero.';
    }
  }
  return e;
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function PersonnelFormPage() {
  const { studyId, personnelId } = useParams();
  const navigate                 = useNavigate();
  const dispatch                 = useDispatch();
  const location                 = useLocation();
  const readOnly                 = location.pathname.endsWith('/view');
  const isEdit                   = !!personnelId && !readOnly;

  const [form,       setForm]       = useState(EMPTY);
  const [errors,     setErrors]     = useState({});
  const [loading,    setLoading]    = useState(!!personnelId);
  const [saving,     setSaving]     = useState(false);
  const [apiError,   setApiError]   = useState('');

  // The full active-site list — kept around so "All Sites" can expand to the
  // explicit array of site_ids at submit time.
  const [allActiveSites, setAllActiveSites] = useState([]);
  const [siteOpts,    setSiteOpts]   = useState([]);
  const [roleOpts,    setRoleOpts]   = useState([]);     // pulled from Site Roles master
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [consentForms, setConsentForms] = useState([]);  // published consent forms

  // Whether the currently selected role requires a consent assignment — driven
  // entirely by the role's `consentRequired` flag (never a hardcoded role name).
  const selectedRoleOpt = roleOpts.find((o) => o.value === form.role);
  const consentRequired = selectedRoleOpt?._consentRequired === true;
  const selectedRoleId  = selectedRoleOpt?._id ?? '';
  // Only offer consents ASSIGNED to the selected role (empty assigned-roles = all).
  const consentFormChoices = consentForms.filter(
    (f) => !Array.isArray(f.assignedRoleIds) || f.assignedRoleIds.length === 0 || f.assignedRoleIds.includes(selectedRoleId),
  );
  // Show + require the Consent Form Assignment ONLY when the role requires consent
  // AND there is at least one published consent form available for that role.
  // If the role has Consent Required on but no form exists for it yet, we don't
  // block creation — the section is hidden and no form is required, so the user
  // can still be created (consent_template_id stays null).
  const consentApplicable = consentRequired && consentFormChoices.length > 0;

  // ── Load active sites + Site Roles master ─────────────────────────────────
  // Both use the auth-only lookup endpoints — populating these dropdowns must
  // not require the `sites` / `site_roles` permissions.
  useEffect(() => {
    sponsorSitesClient.lookup(studyId)
      .then((all) => {
        const active = all.filter((s) => s.status !== 'Inactive');
        setAllActiveSites(active);
        setSiteOpts(active.map((s) => ({ value: s.id, label: formatSiteLabel(s) })));
      })
      .catch(() => { setAllActiveSites([]); setSiteOpts([]); });

    // Role dropdown comes ONLY from the Site Roles master — no hardcoded list.
    sponsorRolesClient.lookup(studyId, { status: 'Active' })
      .then((all) => {
        setRoleOpts(
          all
            .filter((r) => r.status === 'Active')
            .sort((a, b) => (a.roleName ?? '').localeCompare(b.roleName ?? ''))
            .map((r) => ({
              value: r.roleName,
              label: r.roleName,
              _id: r.id,
              _consentRequired: r.consentRequired === true,
            })),
        );
      })
      .catch(() => setRoleOpts([]))
      .finally(() => setRolesLoaded(true));

    // Published consent forms — populate the "Consent Form Assignment" dropdown
    // shown when the selected role requires consent.
    sponsorPersonnelClient.getConsentForms()
      .then((forms) => setConsentForms(forms))
      .catch(() => setConsentForms([]));
  }, [studyId]);

  // ── Load existing personnel record (edit OR view) ──────────────────────────
  useEffect(() => {
    if (!personnelId) return;
    setLoading(true);
    sponsorPersonnelClient.getById?.(studyId, personnelId)
      ?.then((p) => {
        if (!p) return;
        // Legacy records store a single `siteId`; new ones may return
        // `siteIds` directly. Normalize into the array form the page uses.
        const seeded = Array.isArray(p.siteIds) && p.siteIds.length
          ? p.siteIds
          : (p.siteId ? [p.siteId] : []);
        setForm({
          ...EMPTY,
          ...p,
          siteIds: seeded,
          assignAllSites: false,
          compensation: { ...EMPTY_COMP, ...(p.compensation ?? {}) },
        });
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load personnel record.' })))
      .finally(() => setLoading(false));
  }, [studyId, personnelId, dispatch]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = (field) => (val) => {
    const v = val?.target ? val.target.value : val;
    setForm((prev) => ({ ...prev, [field]: v }));
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  };
  const setComp = (field) => (val) => {
    const v = val?.target ? val.target.value : val;
    setForm((prev) => ({ ...prev, compensation: { ...prev.compensation, [field]: v } }));
    if (field === 'amount') setErrors((prev) => { const e = { ...prev }; delete e.compAmount; return e; });
  };
  const handleRoleChange = (role) => {
    // The Select's value is the role_name; resolve the matching role_id so the
    // API gets the id it expects (the backend also accepts the name as a
    // fallback, but sending the id is the contract).
    const opt = roleOpts.find((o) => o.value === role);
    const roleId = opt?._id ?? '';
    // Drop any consent assignment when the new role doesn't require consent.
    const keepConsent = opt?._consentRequired === true;
    setForm((prev) => ({
      ...prev,
      role: role ?? '',
      roleId,
      consentTemplateId: keepConsent ? prev.consentTemplateId : '',
    }));
    setErrors((prev) => { const e = { ...prev }; delete e.role; delete e.consentTemplateId; return e; });
  };

  const handleAssignModeChange = (allSites) => {
    setForm((prev) => ({ ...prev, assignAllSites: allSites }));
    setErrors((prev) => { const e = { ...prev }; delete e.siteIds; return e; });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate(form, isEdit, consentApplicable);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError('');
    setSaving(true);
    // "All Sites" expands to every active site_id at submit time. Service
    // accepts the array; the primary site (first element) is what site-scoped
    // queries pin to, and the rest land in additional_site_ids.
    const resolvedSiteIds = form.assignAllSites
      ? allActiveSites.map((s) => s.id).filter(Boolean)
      : form.siteIds;
    const payload = {
      ...form,
      siteIds: resolvedSiteIds,
      consentTemplateId: consentApplicable ? form.consentTemplateId : '',
    };
    try {
      if (isEdit) {
        const updated = await sponsorPersonnelClient.update(studyId, personnelId, payload);
        dispatch(addToast({ type: 'success', message: `'${updated.fullName ?? form.fullName}' updated successfully.` }));
      } else {
        const created = await sponsorPersonnelClient.invite(studyId, payload);
        dispatch(addToast({
          type:     'success',
          message:  `'${created.fullName ?? form.fullName}' invited. Invitation email sent to ${created.email ?? form.email}.`,
          duration: 5000,
        }));
      }
      navigate(`/sponsor/${studyId}/personnel`);
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? '';
      if (/email|exists/i.test(msg)) {
        setErrors((prev) => ({ ...prev, email: 'Email address already exists for this study.' }));
      } else if (/maximum site/i.test(msg)) {
        setApiError('Maximum site limit reached for this study. Cannot add new sites.');
      } else {
        setApiError(msg || 'Failed to save. Please try again.');
      }
      setSaving(false);
    }
  };

  const handleCancel = () => navigate(`/sponsor/${studyId}/personnel`);

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
      <Link to={`/sponsor/${studyId}/personnel`} className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Site Personnel
      </Link>

      <h1 className={styles.title}>{readOnly ? 'View Site Personnel' : isEdit ? 'Edit Site Personnel' : 'Invite Site Personnel'}</h1>
      <p className={styles.sub}>
        {readOnly
          ? 'Personnel details (read-only).'
          : isEdit
          ? 'Update this user\'s details. Email address is fixed.'
          : 'Invite a user to this study. They\'ll receive an email with login instructions to get started.'}
      </p>

      {apiError && <div className={styles.apiError}>{apiError}</div>}

      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, pointerEvents: readOnly ? 'none' : undefined }}>
      {/* ── Basic Information ────────────────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Basic Information</h2>

        <div className={styles.row2}>
          <FormField label="Full Name" name="fullName" required error={errors.fullName}>
            <input
              id="fullName"
              className={ic(styles, errors.fullName)}
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="e.g. Dr. Jane Smith"
            />
          </FormField>
          <FormField label="Email Address" name="email" required error={errors.email}>
            <input
              id="email"
              type="email"
              className={ic(styles, errors.email)}
              value={form.email}
              onChange={set('email')}
              placeholder="jane.smith@hospital.com"
              disabled={isEdit}
              readOnly={isEdit}
            />
          </FormField>
        </div>

        <div className={styles.row2}>
          <FormField
            label="Role"
            name="role"
            required
            error={errors.role}
            helpText={rolesLoaded && roleOpts.length === 0
              ? 'No site roles configured yet. Create roles under Site Management → Site Role first.'
              : undefined}
          >
            <SearchableDropdown
              options={roleOpts}
              value={form.role}
              onChange={handleRoleChange}
              placeholder={
                !rolesLoaded
                  ? 'Loading roles…'
                  : roleOpts.length === 0
                    ? 'No site roles available'
                    : 'Select role…'
              }
              searchPlaceholder="Search roles…"
            />
          </FormField>
          <FormField label="Status" name="status">
            <SearchableDropdown
              options={asOpt(['Active', 'Inactive'])}
              value={form.status}
              onChange={set('status')}
            />
          </FormField>
        </div>

        {/* Site Details — assign to ALL active sites, or pick a SPECIFIC subset
            (single or multi). The All radio expands to every active site_id at
            submit time so the backend always receives the explicit list. */}
        <FormField label="Site Details" name="siteIds" required error={errors.siteIds}>
          <div className={styles.assignModeRow}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="assignMode"
                checked={form.assignAllSites === true}
                onChange={() => handleAssignModeChange(true)}
              />
              <span>All Sites <span className={styles.helpText}>({allActiveSites.length})</span></span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="assignMode"
                checked={form.assignAllSites === false}
                onChange={() => handleAssignModeChange(false)}
              />
              <span>Specific Sites</span>
            </label>
          </div>
          {!form.assignAllSites && (
            <SearchableDropdown
              multiple
              options={siteOpts}
              value={form.siteIds}
              onChange={set('siteIds')}
              placeholder={siteOpts.length === 0 ? 'No active sites' : 'Select one or more sites…'}
              searchPlaceholder="Search by site code or name…"
            />
          )}
        </FormField>

        {/* Subject limit (spec 16) — once the person completes the CRF for this
            many subjects they're auto-locked out until a CRO Admin raises it.
            Blank = unlimited. */}
        <div style={{ marginTop: 16 }}>
          <FormField
            label="Max Subjects (CRF completion limit)"
            name="maxSubjects"
            helpText="Leave blank for unlimited. The person is auto-locked once they complete the CRF for this many subjects; raising it here unlocks them."
          >
            <input
              id="maxSubjects"
              type="number"
              min={0}
              className={styles.input}
              value={form.maxSubjects ?? ''}
              onChange={(e) => set('maxSubjects')(e.target.value)}
              placeholder="Unlimited"
            />
            {isEdit && form.autoLocked && (
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#b45309' }}>
                This person is currently <strong>auto-locked</strong> (reached their subject limit). Increase the limit to unlock them.
              </p>
            )}
          </FormField>
        </div>
      </section>

      {/* ── Consent Form Assignment ──────────────────────────────────────────
          Shown only when the role has "Consent Required" enabled AND at least one
          consent form exists for it. If no form is available, the section is
          hidden and the person can still be created (no consent assignment). */}
      {consentApplicable && (
        <section className={styles.card}>
          <h2 className={styles.cardHeading}>Consent Form Assignment (Required)</h2>
          <p className={styles.cardSub}>
            Select the consent form that will be assigned to this site personnel. The
            selected form will be available for review, acknowledgment, or signature
            based on the user&apos;s role.
          </p>
          <FormField label="Consent Form" name="consentTemplateId" required error={errors.consentTemplateId}>
            <SearchableDropdown
              options={consentFormChoices.map((f) => ({
                value: f.id,
                label: [f.code, f.name].filter(Boolean).join(' — ') + (f.version ? ` (v${f.version})` : ''),
              }))}
              value={form.consentTemplateId}
              onChange={set('consentTemplateId')}
              placeholder={
                consentFormChoices.length === 0
                  ? 'No consent form assigned to this role'
                  : 'Search or select a consent form…'
              }
              searchPlaceholder="Search consent forms…"
            />
          </FormField>
          {consentFormChoices.length === 0 && (
            <p className={styles.cardSub} style={{ marginTop: 8 }}>
              No published consent form is assigned to this role yet. In the Consent
              Builder, publish a consent and add this role under “Assigned Roles”.
            </p>
          )}
        </section>
      )}

      {/* ── Compensation ─────────────────────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Compensation</h2>
        <p className={styles.cardSub}>
          Configure how this user is compensated for their participation in the study. Leave as <em>None</em> if no compensation applies.
        </p>

        <div className={styles.row2}>
          <FormField label="Compensation Type" name="compType">
            <SearchableDropdown
              options={asOpt(COMP_TYPES)}
              value={form.compensation.type}
              onChange={setComp('type')}
            />
          </FormField>
        </div>

        {form.compensation.type !== 'None' && (
          <>
            <div className={styles.row2}>
              <FormField label="Amount" name="compAmount" required error={errors.compAmount}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={ic(styles, errors.compAmount)}
                  value={form.compensation.amount}
                  onChange={setComp('amount')}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Currency" name="compCurrency">
                <SearchableDropdown
                  options={asOpt(CURRENCIES)}
                  value={form.compensation.currency}
                  onChange={setComp('currency')}
                />
              </FormField>
            </div>

            <div className={styles.row2}>
              <FormField label="Payment Schedule" name="paymentSchedule">
                <SearchableDropdown
                  options={asOpt(PAY_SCHEDULES)}
                  value={form.compensation.paymentSchedule}
                  onChange={setComp('paymentSchedule')}
                />
              </FormField>
              <FormField label="Payment Method" name="paymentMethod">
                <SearchableDropdown
                  options={asOpt(PAY_METHODS)}
                  value={form.compensation.paymentMethod}
                  onChange={setComp('paymentMethod')}
                />
              </FormField>
            </div>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.compensation.bankDetailsRequired}
                onChange={(e) => setComp('bankDetailsRequired')(e.target.checked)}
              />
              <span>
                <strong>Collect bank details in the consent form</strong>
                <span className={styles.helpText}>
                  {' '}— the user will be asked to provide bank/payment details before consent submission.
                </span>
              </span>
            </label>
          </>
        )}
      </section>
      </fieldset>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={handleCancel}
          disabled={saving}
        >
          {readOnly ? 'Close' : 'Cancel'}
        </button>
        {!readOnly && (
          <button
            type="button"
            className={styles.btnSave}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Send Invitation'}
          </button>
        )}
      </div>
    </div>
  );
}
