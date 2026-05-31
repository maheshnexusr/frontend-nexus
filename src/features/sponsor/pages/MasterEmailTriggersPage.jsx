/**
 * MasterEmailTriggersPage — /sponsor/:studyId/masters/email-triggers
 *
 * Configures which email template fires for each system event trigger.
 *
 * For each trigger you can:
 *   • Assign an email template (selected from active templates)
 *   • Choose which recipient roles receive the email
 *   • Enable / disable the trigger
 *
 * Triggers are grouped by module. The DEFAULT_TRIGGERS list acts as the
 * seed when the backend returns an empty list (dev / first-run).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Mail, ToggleLeft, ToggleRight, Pencil, X,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  RefreshCw, Info,
} from 'lucide-react';
import { sponsorEmailTriggersClient } from '@/features/sponsor/api/sponsorEmailTriggersClient';
import { useReadOnlyView }            from '@/features/workspace/hooks/useReadOnlyView';
import { usePermissions }             from '@/features/auth/usePermissions';
import { addToast } from '@/app/notificationSlice';
import css from './MasterEmailTriggersPage.module.css';

/* ── Trigger catalogue (seeds UI when backend returns empty) ────────────── */
const DEFAULT_TRIGGERS = [
  /* ── 2.1 User Account ─────────────────────────────────────────────────── */
  { eventCode: 'USER_WELCOME',            module: 'User Account', eventLabel: 'Welcome Email (First-time Login)',    description: 'Sent to a new user on their very first login to the platform.' },
  { eventCode: 'USER_PASSWORD_RESET',     module: 'User Account', eventLabel: 'Password Reset Request',             description: 'Sent when a user requests a password reset link.' },
  { eventCode: 'USER_PASSWORD_CHANGED',   module: 'User Account', eventLabel: 'Password Changed Confirmation',      description: 'Sent to confirm that a user\'s password has been successfully changed.' },
  { eventCode: 'USER_LOGIN_NEW_DEVICE',   module: 'User Account', eventLabel: 'Login Confirmation (New Device)',    description: 'Sent when a login is detected from an unrecognised device or location.' },

  /* ── 2.2 Site Personnel ────────────────────────────────────────────────── */
  { eventCode: 'PERSONNEL_INVITE',              module: 'Personnel', eventLabel: 'Site Personnel Invitation',                    description: 'Sent to the invitee when they are added to the study.' },
  { eventCode: 'PERSONNEL_REMOVED',             module: 'Personnel', eventLabel: 'Site Personnel Removal / Deletion',            description: 'Sent when a personnel member is removed from the study.' },
  { eventCode: 'PERSONNEL_ACTIVE_TO_INACTIVE',  module: 'Personnel', eventLabel: 'Site Personnel Status Change (Active → Inactive)', description: 'Sent when a personnel member\'s status is changed from Active to Inactive.' },
  { eventCode: 'PERSONNEL_INACTIVE_TO_ACTIVE',  module: 'Personnel', eventLabel: 'Site Personnel Status Change (Inactive → Active)', description: 'Sent when a personnel member\'s status is restored from Inactive to Active.' },
  { eventCode: 'PERSONNEL_REINVITE',            module: 'Personnel', eventLabel: 'Resend Invitation',                            description: 'Sent when a study invitation is resent to site personnel.' },

  /* ── 2.3 Study Status ─────────────────────────────────────────────────── */
  { eventCode: 'STUDY_CLOSE_OUT',         module: 'Study Status', eventLabel: 'Study Close Out',             description: 'Sent to all active site personnel when the study is closed out.' },
  { eventCode: 'STUDY_LOCK_OUT',          module: 'Study Status', eventLabel: 'Study Lock Out',              description: 'Sent to all active site personnel when the study is locked.' },

  /* ── 2.4 Site Management ──────────────────────────────────────────────── */
  { eventCode: 'SITE_LOCKED',             module: 'Sites', eventLabel: 'Site Locked',                 description: 'Sent when a site is locked — no further data entry permitted.' },
  { eventCode: 'SITE_UNLOCKED',           module: 'Sites', eventLabel: 'Site Unlock',                 description: 'Sent when a site lock is lifted and data entry is re-enabled.' },
  { eventCode: 'SITE_ACTIVATED',          module: 'Sites', eventLabel: 'Site Activated',              description: 'Sent when a site status is changed to Active.' },
  { eventCode: 'SITE_DEACTIVATED',        module: 'Sites', eventLabel: 'Site Deactivated',            description: 'Sent when a site status is changed to Inactive.' },
  { eventCode: 'ENROLLMENT_TARGET_REACHED', module: 'Sites', eventLabel: 'Enrollment Target Reached', description: 'Sent when actual enrollments reach the expected target for a site.' },

  /* ── 2.5 Query Management ──────────────────────────────────────────────── */
  { eventCode: 'QUERY_RAISED',            module: 'Queries', eventLabel: 'Query Raised',                description: 'Sent when a new data query is raised against a subject record.' },
  { eventCode: 'QUERY_CLOSED',            module: 'Queries', eventLabel: 'Query Resolved',              description: 'Sent when a query is marked as resolved or closed.' },
  { eventCode: 'QUERY_RESPONDED',         module: 'Queries', eventLabel: 'Query Responded',             description: 'Sent when a site responds to an open query.' },
  { eventCode: 'QUERY_ESCALATED',         module: 'Queries', eventLabel: 'Query Escalated',             description: 'Sent when a query is escalated to a higher authority.' },
  { eventCode: 'QUERY_OVERDUE',           module: 'Queries', eventLabel: 'Query Overdue Reminder',      description: 'Sent when an open query has not been responded to within the configured SLA period.' },

  /* ── Consent Management ────────────────────────────────────────────────── */
  { eventCode: 'CONSENT_REQUEST',         module: 'Consent', eventLabel: 'Consent Request',             description: 'Sent when a consent template is assigned and awaiting signing.' },
  { eventCode: 'CONSENT_APPROVED',        module: 'Consent', eventLabel: 'Consent Approved',            description: 'Sent when consent is reviewed and approved.' },
  { eventCode: 'CONSENT_REJECTED',        module: 'Consent', eventLabel: 'Consent Rejected',            description: 'Sent when consent is reviewed and rejected.' },
  { eventCode: 'CONSENT_EXPIRY_REMINDER', module: 'Consent', eventLabel: 'Consent Expiry Reminder',     description: 'Sent X days before a consent form expires.' },

  /* ── Data Verification ─────────────────────────────────────────────────── */
  { eventCode: 'VERIFICATION_APPROVED',   module: 'Verification', eventLabel: 'Data Verification Approved',  description: 'Sent when subject data is approved during verification.' },
  { eventCode: 'VERIFICATION_REJECTED',   module: 'Verification', eventLabel: 'Data Verification Rejected',  description: 'Sent when subject data is rejected or queried during verification.' },

  /* ── Data Capture ──────────────────────────────────────────────────────── */
  { eventCode: 'DATA_ENTRY_REMINDER',     module: 'Data Capture', eventLabel: 'Data Entry Reminder',     description: 'Sent to site coordinators when CRF data entry is overdue.' },

  /* ── Adverse Event ─────────────────────────────────────────────────────── */
  { eventCode: 'ADVERSE_EVENT',           module: 'Safety',       eventLabel: 'Adverse Event Alert',     description: 'Sent when an adverse event is recorded for a subject.' },
];

/* ── Recipient role options ──────────────────────────────────────────────── */
const RECIPIENT_OPTIONS = [
  { value: 'principal_investigator', label: 'Principal Investigator' },
  { value: 'site_coordinator',       label: 'Site Coordinator' },
  { value: 'study_nurse',            label: 'Study Nurse' },
  { value: 'data_manager',           label: 'Data Manager' },
  { value: 'sponsor',                label: 'Sponsor / CRO' },
  { value: 'invitee',                label: 'Invitee (personnel being invited)' },
  { value: 'subject',                label: 'Subject / Patient' },
  { value: 'custom',                 label: 'Custom Email Address' },
];

/* ── Module colours ──────────────────────────────────────────────────────── */
const MODULE_COLORS = {
  'User Account': { bg: '#e0f2fe', color: '#0369a1' },
  Personnel:      { bg: '#f0fdf4', color: '#16a34a' },
  'Study Status': { bg: '#f5f3ff', color: '#7c3aed' },
  Sites:          { bg: '#eff6ff', color: '#2563eb' },
  Queries:        { bg: '#fffbeb', color: '#d97706' },
  Consent:        { bg: '#ecfdf5', color: '#059669' },
  Verification:   { bg: '#ecfeff', color: '#0891b2' },
  'Data Capture': { bg: '#fff7ed', color: '#ea580c' },
  Safety:         { bg: '#fff1f2', color: '#e11d48' },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function mergeWithDefaults(apiData) {
  return DEFAULT_TRIGGERS.map((def) => {
    const found = apiData.find((r) => r.eventCode === def.eventCode);
    if (found) return { ...def, ...found };
    return { ...def, id: def.eventCode, templateId: null, templateName: null, templateCode: null, recipients: [], status: 'Active' };
  });
}

/* ── Edit Modal ──────────────────────────────────────────────────────────── */
function EditTriggerModal({ trigger, templates, onSave, onClose, saving }) {
  const [templateId,   setTemplateId]   = useState(trigger.templateId   ?? '');
  const [recipients,   setRecipients]   = useState(trigger.recipients   ?? []);
  const [customEmails, setCustomEmails] = useState(
    (trigger.recipients ?? []).filter((r) => r.includes('@')).join(', '),
  );

  const mc = MODULE_COLORS[trigger.module] ?? MODULE_COLORS.Study;

  const toggleRecipient = (val) => {
    setRecipients((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const handleSave = () => {
    const allRecipients = [...recipients.filter((r) => r !== 'custom')];
    if (recipients.includes('custom') && customEmails.trim()) {
      customEmails.split(/[,;\s]+/).filter(Boolean).forEach((e) => allRecipients.push(e.trim()));
    }
    onSave({ templateId: templateId || null, recipients: allRecipients });
  };

  return (
    <div className={css.overlay} onClick={onClose}>
      <div className={css.modal} onClick={(e) => e.stopPropagation()}>
        {/* Head */}
        <div className={css.modalHead}>
          <div className={css.modalTitleRow}>
            <span className={css.modalModuleTag} style={{ background: mc.bg, color: mc.color }}>
              {trigger.module}
            </span>
            <h3 className={css.modalTitle}>{trigger.eventLabel}</h3>
          </div>
          <button className={css.modalClose} onClick={onClose}><X size={15} /></button>
        </div>

        <div className={css.modalBody}>
          {/* Description */}
          <div className={css.infoBox}>
            <Info size={13} className={css.infoIcon} />
            <p className={css.infoText}>{trigger.description}</p>
          </div>

          {/* Template selector */}
          <div className={css.formField}>
            <label className={css.fieldLabel}>Email Template</label>
            <select
              className={css.fieldSelect}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">(No template — trigger disabled)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} [{t.code}]</option>
              ))}
            </select>
            {!templateId && (
              <p className={css.fieldHint}>Select an active template from Masters → Email Templates.</p>
            )}
          </div>

          {/* Recipients */}
          <div className={css.formField}>
            <label className={css.fieldLabel}>Notify</label>
            <div className={css.recipientGrid}>
              {RECIPIENT_OPTIONS.map((opt) => {
                const checked = recipients.includes(opt.value);
                return (
                  <label key={opt.value} className={`${css.recipientChk} ${checked ? css.recipientChkOn : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRecipient(opt.value)}
                      className={css.hiddenChk}
                    />
                    <span className={css.checkmark}>{checked ? <CheckCircle2 size={13} /> : <span className={css.emptyCheck} />}</span>
                    {opt.label}
                  </label>
                );
              })}
            </div>

            {recipients.includes('custom') && (
              <div className={css.customEmailRow}>
                <label className={css.fieldLabel}>Custom Email Addresses</label>
                <input
                  className={css.fieldInput}
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder="e.g. dm@example.com, pi@hospital.org"
                />
                <p className={css.fieldHint}>Separate multiple addresses with commas.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={css.modalFoot}>
          <button className={css.btnCancel} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={css.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Trigger'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Trigger row ─────────────────────────────────────────────────────────── */
function TriggerRow({ trigger, onEdit, onToggle, toggling, ro, canEdit }) {
  const mc       = MODULE_COLORS[trigger.module] ?? MODULE_COLORS.Study;
  const isActive = trigger.status === 'Active';
  const hasTemplate = !!trigger.templateId;

  return (
    <tr className={`${css.row} ${!isActive ? css.rowInactive : ''}`}>
      <td className={css.td}>
        <p className={css.eventLabel}>{trigger.eventLabel}</p>
        <p className={css.eventDesc}>{trigger.description}</p>
      </td>
      <td className={css.td}>
        <span className={css.moduleBadge} style={{ background: mc.bg, color: mc.color }}>
          {trigger.module}
        </span>
      </td>
      <td className={css.td}>
        {hasTemplate ? (
          <div className={css.templateCell}>
            <Mail size={13} className={css.templateIcon} />
            <div>
              <p className={css.templateName}>{trigger.templateName ?? '—'}</p>
              {trigger.templateCode && <p className={css.templateCode}>[{trigger.templateCode}]</p>}
            </div>
          </div>
        ) : (
          <span className={css.noTemplate}>No template assigned</span>
        )}
      </td>
      <td className={css.td}>
        {trigger.recipients?.length > 0 ? (
          <div className={css.recipientTags}>
            {trigger.recipients.slice(0, 3).map((r) => {
              const opt = RECIPIENT_OPTIONS.find((o) => o.value === r);
              return (
                <span key={r} className={css.recipientTag}>
                  {opt?.label ?? r}
                </span>
              );
            })}
            {trigger.recipients.length > 3 && (
              <span className={css.recipientTag}>+{trigger.recipients.length - 3} more</span>
            )}
          </div>
        ) : (
          <span className={css.noTemplate}>None set</span>
        )}
      </td>
      <td className={css.td}>
        {isActive && hasTemplate ? (
          <span className={css.statusActive}><CheckCircle2 size={11} /> Active</span>
        ) : isActive && !hasTemplate ? (
          <span className={css.statusWarn}><AlertCircle size={11} /> No Template</span>
        ) : (
          <span className={css.statusOff}>Disabled</span>
        )}
      </td>
      <td className={css.tdActions}>
        {canEdit && (
          <button
            className={css.actionBtn}
            title={ro?.isReadOnly ? ro.readOnlyMessage : 'Configure'}
            onClick={() => onEdit(trigger)}
            {...(ro?.disabledProps?.('Configure trigger') ?? {})}
          >
            <Pencil size={14} />
          </button>
        )}
        {canEdit && (
          <button
            className={`${css.actionBtn} ${css.toggleBtn}`}
            title={ro?.isReadOnly ? ro.readOnlyMessage : (isActive ? 'Disable trigger' : 'Enable trigger')}
            onClick={() => onToggle(trigger)}
            disabled={toggling === trigger.eventCode || !!ro?.isReadOnly}
            aria-disabled={toggling === trigger.eventCode || !!ro?.isReadOnly}
          >
            {isActive
              ? <ToggleRight size={18} className={css.toggleOn} />
              : <ToggleLeft  size={18} className={css.toggleOff} />
            }
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function MasterEmailTriggersPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();
  const { has }     = usePermissions();
  const canEdit     = has('email_templates', 'edit');

  const [triggers,   setTriggers]   = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [toggling,   setToggling]   = useState(null);
  const [collapsed,  setCollapsed]  = useState({});
  const [modFilter,  setModFilter]  = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [apiTriggers, apiTemplates] = await Promise.all([
        sponsorEmailTriggersClient.list(studyId),
        sponsorEmailTriggersClient.listTemplates(studyId),
      ]);
      setTriggers(mergeWithDefaults(apiTriggers));
      setTemplates(apiTemplates);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load email triggers.' }));
    } finally {
      setLoading(false);
    }
  }, [studyId, dispatch]);

  useEffect(() => { load(); }, [load]);

  /* ── Group by module ── */
  const grouped = useMemo(() => {
    const filtered = modFilter === 'All'
      ? triggers
      : triggers.filter((t) => t.module === modFilter);
    return filtered.reduce((acc, t) => {
      acc[t.module] = acc[t.module] ?? [];
      acc[t.module].push(t);
      return acc;
    }, {});
  }, [triggers, modFilter]);

  const modules = Object.keys(grouped);
  const allModules = [...new Set(DEFAULT_TRIGGERS.map((t) => t.module))];

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:    triggers.length,
    active:   triggers.filter((t) => t.status === 'Active' && t.templateId).length,
    noTpl:    triggers.filter((t) => t.status === 'Active' && !t.templateId).length,
    disabled: triggers.filter((t) => t.status !== 'Active').length,
  }), [triggers]);

  /* ── Save ── */
  const handleSave = async (payload) => {
    setSaving(true);
    try {
      const updated = await sponsorEmailTriggersClient.update(studyId, editing.eventCode, payload);
      setTriggers((prev) => prev.map((t) =>
        t.eventCode === editing.eventCode
          ? { ...t, ...updated, templateName: templates.find((tp) => tp.id === payload.templateId)?.name ?? null, templateCode: templates.find((tp) => tp.id === payload.templateId)?.code ?? null }
          : t,
      ));
      dispatch(addToast({ type: 'success', message: `Trigger "${editing.eventLabel}" updated.` }));
      setEditing(null);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to save trigger. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  /* ── Toggle ── */
  const handleToggle = async (trigger) => {
    const newStatus = trigger.status === 'Active' ? 'Inactive' : 'Active';
    setToggling(trigger.eventCode);
    try {
      await sponsorEmailTriggersClient.toggleStatus(studyId, trigger.eventCode, newStatus);
      setTriggers((prev) => prev.map((t) =>
        t.eventCode === trigger.eventCode ? { ...t, status: newStatus } : t,
      ));
      dispatch(addToast({
        type:    'success',
        message: `"${trigger.eventLabel}" trigger ${newStatus === 'Active' ? 'enabled' : 'disabled'}.`,
      }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to update trigger status.' }));
    } finally {
      setToggling(null);
    }
  };

  const toggleGroup = (mod) => setCollapsed((c) => ({ ...c, [mod]: !c[mod] }));

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Email Notification Triggers</h1>
          <p className={css.sub}>
            Configure which email template fires automatically for each study event.
          </p>
        </div>
        <button className={css.btnRefresh} onClick={load} disabled={loading} title="Refresh">
          <RefreshCw size={15} className={loading ? css.spin : ''} />
        </button>
      </div>

      {/* Stats bar */}
      <div className={css.statsBar}>
        <div className={css.stat}>
          <span className={css.statVal}>{stats.total}</span>
          <span className={css.statLabel}>Total Triggers</span>
        </div>
        <div className={css.statDivider} />
        <div className={css.stat}>
          <span className={`${css.statVal} ${css.statGreen}`}>{stats.active}</span>
          <span className={css.statLabel}>Active & Configured</span>
        </div>
        <div className={css.statDivider} />
        <div className={css.stat}>
          <span className={`${css.statVal} ${css.statAmber}`}>{stats.noTpl}</span>
          <span className={css.statLabel}>Needs Template</span>
        </div>
        <div className={css.statDivider} />
        <div className={css.stat}>
          <span className={`${css.statVal} ${css.statGrey}`}>{stats.disabled}</span>
          <span className={css.statLabel}>Disabled</span>
        </div>
      </div>

      {/* Module filter pills */}
      <div className={css.filterRow}>
        {['All', ...allModules].map((m) => (
          <button
            key={m}
            className={`${css.filterBtn} ${modFilter === m ? css.filterBtnActive : ''}`}
            onClick={() => setModFilter(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Info note */}
      <div className={css.infoNote}>
        <Info size={14} className={css.infoNoteIcon} />
        <span>
          Email templates are managed in <strong>Masters → Email Templates</strong>.
          Only <strong>Active</strong> templates are available to assign here.
          A trigger must have a template assigned to fire.
        </span>
      </div>

      {/* Grouped tables */}
      {loading ? (
        <div className={css.loadingWrap}>
          {[1,2,3].map((i) => <div key={i} className={css.skeleton} />)}
        </div>
      ) : modules.length === 0 ? (
        <div className={css.empty}>
          <Mail size={40} strokeWidth={1.25} className={css.emptyIcon} />
          <p className={css.emptyTitle}>No triggers found</p>
          <p className={css.emptySub}>No triggers match the selected module filter.</p>
        </div>
      ) : (
        <div className={css.groups}>
          {modules.map((mod) => {
            const rows    = grouped[mod];
            const mc      = MODULE_COLORS[mod] ?? MODULE_COLORS.Study;
            const isOpen  = !collapsed[mod];
            const active  = rows.filter((t) => t.status === 'Active' && t.templateId).length;

            return (
              <div key={mod} className={css.group}>
                {/* Group header */}
                <button className={css.groupHeader} onClick={() => toggleGroup(mod)}>
                  <span className={css.groupDot} style={{ background: mc.color }} />
                  <span className={css.groupTitle}>{mod}</span>
                  <span className={css.groupCount}>{active}/{rows.length} configured</span>
                  <span className={css.groupChevron}>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {isOpen && (
                  <div className={css.tableWrap}>
                    <table className={css.table}>
                      <thead>
                        <tr>
                          <th className={css.th} style={{ width: '30%' }}>Event</th>
                          <th className={css.th} style={{ width: '10%' }}>Module</th>
                          <th className={css.th} style={{ width: '22%' }}>Template</th>
                          <th className={css.th} style={{ width: '24%' }}>Recipients</th>
                          <th className={css.th} style={{ width: '8%' }}>Status</th>
                          <th className={css.thActions} style={{ width: '6%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((trigger) => (
                          <TriggerRow
                            key={trigger.eventCode}
                            trigger={trigger}
                            onEdit={setEditing}
                            onToggle={handleToggle}
                            toggling={toggling}
                            ro={ro}
                            canEdit={canEdit}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditTriggerModal
          trigger={editing}
          templates={templates}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
