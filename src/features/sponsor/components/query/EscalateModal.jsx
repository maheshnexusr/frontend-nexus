import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { sponsorPersonnelClient } from '@/features/sponsor/api/sponsorPersonnelClient';
import styles from './EscalateModal.module.css';

const PRIORITY_ORDER  = ['Low', 'Medium', 'High', 'Critical'];
const PRIORITY_COLORS = { Low: '#3b82f6', Medium: '#f59e0b', High: '#dc2626', Critical: '#991b1b' };

export default function EscalateModal({ query, onConfirm, onClose, title = 'Escalate Query' }) {
  const [form, setForm] = useState({
    escalationReason: '',
    escalateTo:       '',
    newPriority:      nextPriority(query?.priority),
  });
  const [errors,    setErrors]  = useState({});
  const [saving,    setSaving]   = useState(false);

  // Role + Site are FILTERS to find the right person — not the escalation
  // target itself. We always escalate to a named person (clear accountability);
  // Site defaults to the query's own site, Role to "all". Both lists are built
  // from the real assignees, so nothing has to be pre-defined/seeded.
  const [siteFilter, setSiteFilter] = useState(query?.siteId ?? '');
  const [roleFilter, setRoleFilter] = useState('');

  // ONLY query handlers — people whose role grants a query_manager management
  // permission (create/delete/reassign/escalate/reopen). The backend filters
  // these out of the raw assignee list, so a PI/responder is never offered.
  const [assignees, setAssignees] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  useEffect(() => {
    let cancelled = false;
    sponsorPersonnelClient.escalationTargets().then((items) => {
      if (!cancelled) { setAssignees(items); setLoadingTargets(false); }
    });
    return () => { cancelled = true; };
  }, []);
  const active = useMemo(
    () => assignees.filter((p) => (p.status ?? 'Active') === 'Active'),
    [assignees]
  );
  // No eligible handlers assigned at all (vs. just filtered out) — drives the
  // guidance banner + disables submit, per the chosen "show empty + guidance".
  const noTargets = !loadingTargets && active.length === 0;

  // Site options — every distinct site among the assignees, plus the query's
  // own site (selectable even if nobody's on it yet) and an "All sites /
  // study-level" escape hatch for CRO/sponsor people who aren't site-bound.
  const siteOpts = useMemo(() => {
    const map = new Map();
    if (query?.siteId) map.set(query.siteId, query.siteName || query.siteId);
    active.forEach((p) => {
      const ids = Array.isArray(p.siteIds) && p.siteIds.length ? p.siteIds : (p.siteId ? [p.siteId] : []);
      ids.forEach((id) => { if (id && !map.has(id)) map.set(id, p.siteName || id); });
    });
    return [
      { value: '', label: 'All sites / study-level' },
      ...[...map.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [active, query]);

  // Role options — derived from the people actually assigned (data-driven, no
  // hardcoded role list → honours the no-role-name-hardcoding rule).
  const roleOpts = useMemo(() => {
    const roles = [...new Set(active.map((p) => p.role).filter(Boolean))].sort();
    return [{ value: '', label: 'All roles' }, ...roles.map((r) => ({ value: r, label: r }))];
  }, [active]);

  // People matching the Site + Role filters. Site rule: a specific site shows
  // its own personnel PLUS study-level people (CRO/sponsor team, no site) so
  // they stay reachable; "All sites" shows everyone.
  const userOpts = useMemo(() => {
    const onSite = (p) => {
      if (!siteFilter) return true;
      const ids = Array.isArray(p.siteIds) ? p.siteIds : [];
      const studyLevel = ids.length === 0 && !p.siteId; // CRO / sponsor team
      return studyLevel || ids.includes(siteFilter) || p.siteId === siteFilter;
    };
    const onRole = (p) => !roleFilter || p.role === roleFilter;
    return active
      .filter((p) => onSite(p) && onRole(p))
      .map((p) => ({
        value: p.id,
        label: `${p.fullName}${p.role ? ` — ${p.role}` : ''}${p.siteName ? ` · ${p.siteName}` : ''}`,
      }));
  }, [active, siteFilter, roleFilter]);

  // If the selected person falls out of the filtered list, clear the selection
  // so we never submit someone who's no longer visible.
  useEffect(() => {
    if (form.escalateTo && !userOpts.some((o) => o.value === form.escalateTo)) {
      setForm((p) => ({ ...p, escalateTo: '' }));
    }
  }, [userOpts, form.escalateTo]);

  function nextPriority(current) {
    const idx = PRIORITY_ORDER.indexOf(current ?? 'Medium');
    return idx < PRIORITY_ORDER.length - 1 ? PRIORITY_ORDER[idx + 1] : current ?? 'High';
  }

  const set = (key) => (val) => {
    const v = val?.target ? val.target.value : val;
    setForm((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleConfirm = async () => {
    const errs = {};
    if (!form.escalationReason.trim()) errs.escalationReason = 'Escalation reason is required.';
    if (!form.escalateTo)              errs.escalateTo       = 'Please select a user to escalate to.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try { await onConfirm(form); } finally { setSaving(false); }
  };

  const footer = (
    <>
      <button className={styles.btnCancel}  onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button
        className={styles.btnEscalate}
        onClick={handleConfirm}
        disabled={saving || noTargets}
        type="button"
        title={noTargets ? 'No eligible escalation handler is assigned to this study.' : undefined}
      >
        <AlertTriangle size={13} />
        {saving ? 'Escalating…' : 'Escalate Query'}
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={title} size="sm" footer={footer}>
      <div className={styles.body}>

        {query && (
          <div className={styles.snippet}>
            {/* Identify by field (e.g. "Date of Birth"), not the internal id. */}
            <span className={styles.snippetId}>{query.fieldLabel || query.fieldName || '—'}</span>
            <span className={styles.snippetText}>{query.queryText}</span>
          </div>
        )}

        <FormField label="Escalation Reason" name="escalationReason" required error={errors.escalationReason}>
          <textarea
            id="escalationReason"
            className={`${styles.textarea} ${errors.escalationReason ? styles.inputError : ''}`}
            value={form.escalationReason}
            onChange={set('escalationReason')}
            placeholder="Explain why this query needs to be escalated…"
            rows={4}
          />
        </FormField>

        {noTargets ? (
          /* Per the chosen "show empty + guidance": no one with a query-handling
             role is assigned, so escalation has no valid target. Don't offer the
             PI/responder — point to the fix instead. */
          <div className={styles.notice} style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' }}>
            <AlertTriangle size={13} className={styles.noticeIcon} />
            No escalation handler is assigned to this study. Assign someone to a
            query-handling role (Query Manager, Data Manager, CRA, or a CRO
            reviewer) before escalating — a PI/responder can’t be an escalation
            target.
          </div>
        ) : (
          <>
            {/* Narrow the people list: pick a Site (defaults to the query's site)
                then a Role. Both are just filters — you still escalate to a named
                person below. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormField label="Site" name="siteFilter">
                <SearchableDropdown
                  options={siteOpts}
                  value={siteFilter}
                  onChange={(val) => setSiteFilter(val ?? '')}
                  placeholder="Filter by site…"
                  searchPlaceholder="Search sites…"
                />
              </FormField>
              <FormField label="Role" name="roleFilter">
                <SearchableDropdown
                  options={roleOpts}
                  value={roleFilter}
                  onChange={(val) => setRoleFilter(val ?? '')}
                  placeholder="Filter by role…"
                  searchPlaceholder="Search roles…"
                />
              </FormField>
            </div>

            <FormField label="Escalate To" name="escalateTo" required error={errors.escalateTo}>
              <SearchableDropdown
                options={userOpts}
                value={form.escalateTo}
                onChange={set('escalateTo')}
                placeholder={userOpts.length ? 'Select a person…' : 'No matching people — widen the filters'}
                searchPlaceholder="Search people…"
              />
            </FormField>
          </>
        )}

        <FormField label="Priority After Escalation" name="newPriority">
          <div className={styles.priorityOptions}>
            {PRIORITY_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.priorityBtn} ${form.newPriority === p ? styles.priorityBtnActive : ''}`}
                style={form.newPriority === p ? { background: PRIORITY_COLORS[p], color: '#fff', borderColor: PRIORITY_COLORS[p] } : {}}
                onClick={() => setForm((prev) => ({ ...prev, newPriority: p }))}
              >
                {p}
              </button>
            ))}
          </div>
          <p className={styles.priorityHint}>
            Current priority: <strong style={{ color: PRIORITY_COLORS[query?.priority] }}>{query?.priority ?? 'Medium'}</strong>
          </p>
        </FormField>

        <div className={styles.notice}>
          <Info size={13} className={styles.noticeIcon} />
          The escalated user will see this query in their list with full details. (Email notifications are coming soon.)
        </div>

      </div>
    </Modal>
  );
}
