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

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';

import FormField           from '@/components/form/FormField';
import TextArea            from '@/components/form/TextArea';
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

// Fallback consent-template label for well-known role names, used only when
// the backend hasn't returned any templates yet (purely cosmetic).
const ROLE_TEMPLATE_HINT = {
  'Principal Investigator': 'PI Consent Template',
  'Site Coordinator':       'Site Coordinator Consent Template',
  'Study Nurse':            'Site Personnel Consent Template',
  'Subject/Patient':        'Subject Consent Template',
};

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
  fullName:          '',
  email:             '',
  role:              '',
  siteId:            '',
  status:            'Active',
  consentRequired:   true,
  consentTemplateId: '',
  compensation:      { ...EMPTY_COMP },
};

function ic(s, err) { return err ? `${s.input} ${s.inputError}` : s.input; }
function asOpt(arr) { return arr.map((v) => ({ value: v, label: v })); }

function validate(form, isEdit) {
  const e = {};
  if (!form.fullName.trim())                                e.fullName = 'Full Name is required.';
  if (!isEdit) {
    if (!form.email.trim())                                 e.email    = 'Email Address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email    = 'Email Address must be valid.';
  }
  if (!form.role)                                           e.role     = 'Role is required.';
  if (!form.siteId)                                         e.siteId   = 'Site Name is required.';
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
  const isEdit                   = !!personnelId;

  const [form,       setForm]       = useState(EMPTY);
  const [errors,     setErrors]     = useState({});
  const [loading,    setLoading]    = useState(isEdit);
  const [saving,     setSaving]     = useState(false);
  const [apiError,   setApiError]   = useState('');

  const [siteOpts,   setSiteOpts]   = useState([]);
  const [roleOpts,   setRoleOpts]   = useState([]);     // pulled from Site Roles master
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [templates,  setTemplates]  = useState([]);
  const [tmplLoading, setTmplLoading] = useState(false);

  // ── Load active sites + Site Roles master ─────────────────────────────────
  useEffect(() => {
    sponsorSitesClient.list(studyId)
      .then((all) => {
        const active = all.filter((s) => s.status !== 'Inactive');
        setSiteOpts(active.map((s) => ({ value: s.id, label: s.siteName || s.siteCode || '(unnamed site)' })));
      })
      .catch(() => setSiteOpts([]));

    // Role dropdown comes ONLY from the Site Roles master — no hardcoded list.
    sponsorRolesClient.list(studyId, { status: 'Active' })
      .then((all) => {
        setRoleOpts(
          all
            .filter((r) => r.status === 'Active')
            .sort((a, b) => (a.roleName ?? '').localeCompare(b.roleName ?? ''))
            .map((r) => ({ value: r.roleName, label: r.roleName, _id: r.id })),
        );
      })
      .catch(() => setRoleOpts([]))
      .finally(() => setRolesLoaded(true));
  }, [studyId]);

  // ── Load existing personnel record ─────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    sponsorPersonnelClient.getById?.(studyId, personnelId)
      ?.then((p) => {
        if (!p) return;
        setForm({
          ...EMPTY,
          ...p,
          compensation: { ...EMPTY_COMP, ...(p.compensation ?? {}) },
        });
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load personnel record.' })))
      .finally(() => setLoading(false));
  }, [isEdit, studyId, personnelId, dispatch]);

  // ── Load consent templates whenever the role changes ─────────────────────
  const loadTemplates = useCallback(async (role) => {
    if (!role) return;
    setTmplLoading(true);
    try {
      const list = await sponsorPersonnelClient.getConsentTemplates(studyId, role);
      setTemplates(list);
      if (list.length > 0) {
        setForm((prev) => prev.consentTemplateId ? prev : { ...prev, consentTemplateId: list[0].id });
      }
    } catch {
      setTemplates([]);
    } finally {
      setTmplLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    if (form.role) loadTemplates(form.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.role]);

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
    setForm((prev) => ({ ...prev, role: role ?? '', consentTemplateId: '' }));
    setErrors((prev) => { const e = { ...prev }; delete e.role; return e; });
    setTemplates([]);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate(form, isEdit);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError('');
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await sponsorPersonnelClient.update(studyId, personnelId, form);
        dispatch(addToast({ type: 'success', message: `'${updated.fullName ?? form.fullName}' updated successfully.` }));
      } else {
        const created = await sponsorPersonnelClient.invite(studyId, form);
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

      <h1 className={styles.title}>{isEdit ? 'Edit Site Personnel' : 'Invite Site Personnel'}</h1>
      <p className={styles.sub}>
        {isEdit
          ? 'Update this user\'s details. Email address is fixed.'
          : 'Invite a user to this study. They\'ll receive an email with login instructions and a consent form to complete.'}
      </p>

      {apiError && <div className={styles.apiError}>{apiError}</div>}

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
          <FormField label="Site Name" name="siteId" required error={errors.siteId}>
            <SearchableDropdown
              options={siteOpts}
              value={form.siteId}
              onChange={set('siteId')}
              placeholder={siteOpts.length === 0 ? 'No active sites' : 'Select site…'}
              searchPlaceholder="Search sites…"
            />
          </FormField>
        </div>

        <div className={styles.row2}>
          <FormField label="Status" name="status">
            <SearchableDropdown
              options={asOpt(['Active', 'Inactive'])}
              value={form.status}
              onChange={set('status')}
            />
          </FormField>
          <div /> {/* spacer for grid balance */}
        </div>
      </section>

      {/* ── Consent ──────────────────────────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Consent</h2>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.consentRequired}
            onChange={(e) => set('consentRequired')(e.target.checked)}
          />
          <span>
            <strong>Consent required</strong>
            <span className={styles.helpText}>
              {' '}— if unchecked, this user can access the workspace immediately without submitting a consent form.
            </span>
          </span>
        </label>

        {form.consentRequired && (
          <div className={styles.row2}>
            <FormField label="Consent Template" name="consentTemplateId">
              {templates.length > 0 ? (
                <SearchableDropdown
                  options={templates.map((t) => ({
                    value: t.id,
                    label: `${t.name}${t.version ? ` · v${t.version}` : ''}`,
                  }))}
                  value={form.consentTemplateId}
                  onChange={set('consentTemplateId')}
                  placeholder="Select template…"
                />
              ) : (
                <div className={styles.templateHint}>
                  <FileText size={14} className={styles.templateIcon} />
                  <span>
                    {tmplLoading
                      ? 'Loading templates…'
                      : form.role
                        ? `Default: ${ROLE_TEMPLATE_HINT[form.role] ?? 'Site Personnel Consent Template'}`
                        : 'Select a role to see available templates.'}
                  </span>
                </div>
              )}
            </FormField>
            {form.consentTemplateId && (
              <a
                href={`/sponsor/${studyId}/consent/config?templateId=${form.consentTemplateId}`}
                className={styles.previewLink}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={13} /> Preview consent template
              </a>
            )}
          </div>
        )}
      </section>

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

      {/* Footer */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={handleCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.btnSave}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Send Invitation'}
        </button>
      </div>
    </div>
  );
}
