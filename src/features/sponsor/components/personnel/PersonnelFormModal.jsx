import { useState } from 'react';
import Modal from '@/components/feedback/Modal';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import css from './PersonnelFormModal.module.css';

/**
 * PersonnelFormModal — Invite or Edit a site personnel record.
 *
 * Props:
 *   studyId    string
 *   personnel  object | null  (null = invite mode)
 *   sites      { id, label }[]
 *   onSave     (data) => Promise<void>
 *   onClose    () => void
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLES = [
  'Principal Investigator',
  'Site Coordinator',
  'Study Nurse',
  'Subject/Patient',
  'Pharmacist',
  'Lab Technician',
  'Other',
];

const COMP_TYPES      = ['None', 'Per Study', 'Per Subject', 'Per Visit', 'Milestone Based'];
const CURRENCIES      = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CHF'];
const PAY_SCHEDULES   = ['One-time', 'Monthly', 'Quarterly', 'Upon Completion', 'Milestone-based'];
const PAY_METHODS     = ['Bank Transfer', 'Check', 'Digital Wallet', 'Other'];

const EMPTY_COMP = {
  type:               'None',
  amount:             '',
  currency:           'USD',
  paymentSchedule:    'One-time',
  paymentMethod:      'Bank Transfer',
  bankDetailsRequired: false,
};

const EMPTY = {
  fullName:     '',
  email:        '',
  role:         '',
  // Multi-site assignment: `siteIds` is the authoritative list. First entry
  // becomes the primary `site_id` on the backend; rest land in
  // `additional_site_ids`. `siteId` is kept in the form state for back-compat
  // and is always derived from `siteIds[0]`.
  siteIds:      [],
  allSites:     false,
  status:       'Active',
  compensation: { ...EMPTY_COMP },
};

function validate(form, isEdit) {
  const e = {};
  if (!form.fullName.trim())                                e.fullName = 'Full Name is required.';
  if (!isEdit) {
    if (!form.email.trim())                                 e.email = 'Email Address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email Address must be valid.';
  }
  if (!form.role)                                                  e.role    = 'Role is required.';
  if (!form.allSites && (!form.siteIds || form.siteIds.length === 0)) {
    e.siteIds = 'Select at least one site (or tick All sites).';
  }
  if (form.compensation.type !== 'None') {
    const amt = Number(form.compensation.amount);
    if (!form.compensation.amount || isNaN(amt) || amt <= 0)
      e.compAmount = 'Compensation amount must be greater than zero.';
  }
  return e;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PersonnelFormModal({ studyId, personnel, sites, onSave, onClose }) {
  const isEdit = !!personnel;

  const [form,       setForm]       = useState(() => {
    if (!personnel) return { ...EMPTY };
    // Hydrate siteIds from whichever shape the personnel record carries.
    // Newer backend rows surface `site_ids` (array); legacy rows only have
    // a single `siteId`. The `allSites` flag is implicit — set if the
    // hydrated list covers every site in the study.
    const hydratedSiteIds =
         (Array.isArray(personnel.siteIds)  && personnel.siteIds)
      ?? (Array.isArray(personnel.site_ids) && personnel.site_ids)
      ?? (personnel.siteId ? [personnel.siteId] : []);
    const allSites = hydratedSiteIds.length > 0
      && sites?.length > 0
      && hydratedSiteIds.length === sites.length;
    return {
      ...EMPTY,
      ...personnel,
      siteIds:  hydratedSiteIds,
      allSites,
      compensation: { ...EMPTY_COMP, ...(personnel.compensation ?? {}) },
    };
  });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState('');

  // ── Helpers ───────────────────────────────────────────────────────────────

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  }

  function setComp(field, value) {
    setForm((prev) => ({ ...prev, compensation: { ...prev.compensation, [field]: value } }));
    if (field === 'amount') setErrors((prev) => { const e = { ...prev }; delete e.compAmount; return e; });
  }

  function handleRoleChange(role) {
    set('role', role);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const errs = validate(form, isEdit);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError('');
    setSubmitting(true);
    try {
      await onSave(form);
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('exists'))
        setErrors((prev) => ({ ...prev, email: 'Email address already exists for this study.' }));
      else
        setApiError(msg || 'Failed to save. Please try again.');
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? `Edit Personnel — ${personnel.fullName}` : 'Invite Site Personnel'}
      size="lg"
      footer={
        <div className={css.footer}>
          <button className={css.btnCancel} onClick={onClose} disabled={submitting}>Cancel</button>
          <button className={css.btnSave} onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Sending Invitation…') : (isEdit ? 'Save Changes' : 'Send Invitation')}
          </button>
        </div>
      }
    >
      <div className={css.body}>
        {apiError && <div className={css.apiError}>{apiError}</div>}

        {/* ── A: Basic Information ─────────────────────────────────────── */}
        <div className={css.section}>
          <h3 className={css.sectionTitle}>Basic Information</h3>
          <div className={css.grid2}>
            <Field label="Full Name" req error={errors.fullName}>
              <input
                className={`${css.input} ${errors.fullName ? css.inputError : ''}`}
                placeholder="Dr. Jane Smith"
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
              />
            </Field>
            <Field label="Email Address" req error={errors.email}>
              <input
                type="email"
                className={`${css.input} ${errors.email ? css.inputError : ''} ${isEdit ? css.inputReadonly : ''}`}
                placeholder="user@hospital.com"
                value={form.email}
                onChange={(e) => !isEdit && set('email', e.target.value)}
                readOnly={isEdit}
              />
            </Field>
            <Field label="Role" req error={errors.role}>
              <select
                className={`${css.input} ${errors.role ? css.inputError : ''}`}
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value)}
              >
                <option value="">— Select Role —</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Sites" req error={errors.siteIds}>
              {/* Multi-site assignment. "All sites" is a shortcut that snaps
                  siteIds to every site in the study; toggling it off restores
                  the previous selection. The first selected site becomes the
                  primary on the backend. */}
              <div className={css.multiSiteWrap}>
                <label className={css.allSitesRow}>
                  <input
                    type="checkbox"
                    checked={!!form.allSites}
                    onChange={(e) => {
                      const all = e.target.checked;
                      set('allSites', all);
                      if (all) set('siteIds', sites.map((s) => s.id));
                    }}
                  />
                  <span>Assign to <strong>all sites</strong> in this study</span>
                </label>
                {!form.allSites && (
                  <SearchableDropdown
                    options={sites.map((s) => ({ value: s.id, label: s.label }))}
                    value={form.siteIds}
                    onChange={(val) => set('siteIds', Array.isArray(val) ? val : (val ? [val] : []))}
                    multiple
                    placeholder="Select one or more sites…"
                    searchPlaceholder="Search sites…"
                    clearable
                  />
                )}
              </div>
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
        </div>

        {/* Consent Template section removed per spec — consent management
            lives entirely in the dedicated Consent Builder / Submission /
            Review pages now; personnel records no longer carry consent
            requirements or template selection. */}

        {/* ── C: Compensation ──────────────────────────────────────────── */}
        <div className={css.section}>
          <h3 className={css.sectionTitle}>Compensation</h3>
          <div className={css.grid2}>
            <Field label="Compensation Type">
              <select
                className={css.input}
                value={form.compensation.type}
                onChange={(e) => setComp('type', e.target.value)}
              >
                {COMP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            {form.compensation.type !== 'None' && (
              <>
                <Field label="Amount" req error={errors.compAmount}>
                  <div className={css.amountRow}>
                    <select
                      className={`${css.input} ${css.currencySelect}`}
                      value={form.compensation.currency}
                      onChange={(e) => setComp('currency', e.target.value)}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${css.input} ${css.amountInput} ${errors.compAmount ? css.inputError : ''}`}
                      placeholder="0.00"
                      value={form.compensation.amount}
                      onChange={(e) => setComp('amount', e.target.value)}
                    />
                  </div>
                </Field>
                <Field label="Payment Schedule">
                  <select
                    className={css.input}
                    value={form.compensation.paymentSchedule}
                    onChange={(e) => setComp('paymentSchedule', e.target.value)}
                  >
                    {PAY_SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Payment Method">
                  <select
                    className={css.input}
                    value={form.compensation.paymentMethod}
                    onChange={(e) => setComp('paymentMethod', e.target.value)}
                  >
                    {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <div className={css.field}>
                  <label className={css.checkLabel}>
                    <input
                      type="checkbox"
                      checked={form.compensation.bankDetailsRequired}
                      onChange={(e) => setComp('bankDetailsRequired', e.target.checked)}
                    />
                    <span>Bank Details Required in Consent Form</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {form.compensation.type !== 'None' && (
            <div className={css.compNote}>
              <strong>{form.compensation.type}</strong>:&nbsp;
              {form.compensation.type === 'Per Study' && 'A fixed amount paid once for study participation.'}
              {form.compensation.type === 'Per Subject' && 'Amount calculated automatically based on enrolled subjects.'}
              {form.compensation.type === 'Per Visit' && 'Amount calculated based on completed visits.'}
              {form.compensation.type === 'Milestone Based' && 'Manual approval required per milestone. Define milestones in study settings.'}
            </div>
          )}
        </div>
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
