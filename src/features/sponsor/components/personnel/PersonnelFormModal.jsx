import { useState, useEffect, useCallback } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorPersonnelClient } from '../../api/sponsorPersonnelClient';
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

// Role → default template label (used as hint when no templates load)
const ROLE_TEMPLATE_HINT = {
  'Principal Investigator': 'PI Consent Template',
  'Site Coordinator':       'Site Coordinator Consent Template',
  'Study Nurse':            'Site Personnel Consent Template',
  'Subject/Patient':        'Subject Consent Template',
};

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
  fullName:          '',
  email:             '',
  role:              '',
  siteId:            '',
  status:            'Active',
  consentRequired:   true,
  consentTemplateId: '',
  compensation:      { ...EMPTY_COMP },
};

function validate(form, isEdit) {
  const e = {};
  if (!form.fullName.trim())                                e.fullName = 'Full Name is required.';
  if (!isEdit) {
    if (!form.email.trim())                                 e.email = 'Email Address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email Address must be valid.';
  }
  if (!form.role)                                           e.role    = 'Role is required.';
  if (!form.siteId)                                         e.siteId  = 'Site Name is required.';
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

  const [form,       setForm]       = useState(() =>
    personnel
      ? { ...EMPTY, ...personnel, compensation: { ...EMPTY_COMP, ...(personnel.compensation ?? {}) } }
      : { ...EMPTY },
  );
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState('');

  // Consent templates
  const [templates,    setTemplates]    = useState([]);
  const [tmplLoading,  setTmplLoading]  = useState(false);

  // ── Load templates when role changes ──────────────────────────────────────

  const loadTemplates = useCallback(async (role) => {
    if (!role) return;
    setTmplLoading(true);
    try {
      const list = await sponsorPersonnelClient.getConsentTemplates(studyId, role);
      setTemplates(list);
      // auto-select first template if none selected
      if (list.length > 0 && !form.consentTemplateId) {
        setForm((prev) => ({ ...prev, consentTemplateId: list[0].id }));
      }
    } catch {
      setTemplates([]);
    } finally {
      setTmplLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  useEffect(() => {
    if (form.role) loadTemplates(form.role);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.role]);

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
    set('consentTemplateId', '');
    setTemplates([]);
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

  // ── Selected template metadata ────────────────────────────────────────────

  const selectedTemplate = templates.find((t) => t.id === form.consentTemplateId);

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
            <Field label="Site" req error={errors.siteId}>
              <select
                className={`${css.input} ${errors.siteId ? css.inputError : ''}`}
                value={form.siteId}
                onChange={(e) => set('siteId', e.target.value)}
              >
                <option value="">— Select Site —</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
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

        {/* ── B: Consent Template ──────────────────────────────────────── */}
        <div className={css.section}>
          <h3 className={css.sectionTitle}>Consent Template</h3>

          <div className={css.consentRequiredRow}>
            <label className={css.checkLabel}>
              <input
                type="checkbox"
                checked={form.consentRequired}
                onChange={(e) => set('consentRequired', e.target.checked)}
              />
              <span>Consent Required</span>
            </label>
            <span className={css.consentHint}>
              {form.consentRequired
                ? 'User must complete consent before accessing the system.'
                : 'User can access system without completing consent.'}
            </span>
          </div>

          {form.consentRequired && (
            <>
              {!form.role ? (
                <p className={css.tmplNote}>Select a role to load applicable consent templates.</p>
              ) : tmplLoading ? (
                <p className={css.tmplNote}>Loading templates…</p>
              ) : templates.length > 0 ? (
                <div className={css.tmplList}>
                  {templates.map((t) => (
                    <label key={t.id} className={`${css.tmplOption} ${form.consentTemplateId === t.id ? css.tmplOptionActive : ''}`}>
                      <input
                        type="radio"
                        name="consentTemplate"
                        value={t.id}
                        checked={form.consentTemplateId === t.id}
                        onChange={() => set('consentTemplateId', t.id)}
                      />
                      <div className={css.tmplInfo}>
                        <span className={css.tmplName}>{t.name}</span>
                        <span className={css.tmplMeta}>
                          v{t.version || '1.0'}
                          {t.updatedAt && ` · Updated ${new Date(t.updatedAt).toLocaleDateString()}`}
                        </span>
                      </div>
                      <ExternalLink size={12} className={css.tmplPreview} title="Preview template" />
                    </label>
                  ))}
                </div>
              ) : (
                <div className={css.tmplFallback}>
                  <FileText size={14} />
                  <span>
                    Default template: <strong>{ROLE_TEMPLATE_HINT[form.role] ?? 'Site Personnel Consent Template'}</strong>
                    {' '}(will be applied automatically)
                  </span>
                </div>
              )}
            </>
          )}
        </div>

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
