import { useState, useMemo, useEffect } from 'react';
import { ArrowRightLeft, Info, UserCheck } from 'lucide-react';
import Modal              from '@/components/feedback/Modal';
import FormField          from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { useStudyAssignees } from '@/features/cro/components/study-form/runtime/useStudyAssignees';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import siteAxiosClient    from '@/api/siteAxiosClient';
import styles from './TransferOwnershipModal.module.css';

// Fetch the subject's AUTHORITATIVE current owner (responsible PI). Callers that
// only hold query data (the Queries pages) pass the query's assignee as a proxy
// for the owner, but a query can be reassigned/escalated away from the owner —
// so that proxy both hides the real target and offers the real owner, producing
// a 400 ("already owned by that PI"). We always re-read the truth from the
// subject record, picking the endpoint by live scope (sponsor wins over site,
// and a CRO impersonator holds sponsorViewToken — same rule as useStudyAssignees).
async function fetchSubjectOwner(subjectId) {
  try {
    let res = null;
    if (localStorage.getItem('sponsorAccessToken') || localStorage.getItem('sponsorViewToken')) {
      res = await sponsorAxiosClient.get(`/api/v1/sponsor/workspace/subjects/${subjectId}`);
    } else if (localStorage.getItem('siteAccessToken')) {
      res = await siteAxiosClient.get(`/api/v1/site/workspace/subjects/${subjectId}`);
    }
    const s = res?.subject ?? res ?? null;
    if (!s) return null;
    return { id: s.owner_id ?? s.ownerId ?? '', name: s.owner_name ?? s.ownerName ?? '' };
  } catch {
    return null; // fall back to the caller-supplied proxy
  }
}

/**
 * TransferOwnershipModal — move a subject's responsible PI (ownership) to
 * another person. Used identically on the site and sponsor capture pages; the
 * useStudyAssignees hook auto-detects the live scope (site vs sponsor) so the
 * picker is populated from the right endpoint.
 *
 * On confirm we call `onConfirm({ newOwnerId, reason })`. The parent owns the
 * API call + toast so this stays presentational.
 *
 * The candidate list is every ACTIVE person attached to the subject's site
 * (minus the current owner). We deliberately do NOT hardcode a "PI" role here
 * — the platform is permission-driven and study roles are configurable, so the
 * backend validates the target is an active member of the study; the UI just
 * narrows by site + active status.
 */
export default function TransferOwnershipModal({ subject, onConfirm, onClose }) {
  const { items: assignees, loading } = useStudyAssignees();
  const [form, setForm]   = useState({ newOwnerId: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Seed from the caller-supplied owner (correct for capture-page callers), then
  // overwrite with the authoritative owner fetched from the subject record so a
  // reassigned-query proxy can't corrupt the candidate list.
  const [owner, setOwner] = useState({
    id:   subject?.ownerId   ?? subject?.owner_id   ?? subject?.createdBy ?? '',
    name: subject?.ownerName ?? subject?.owner_name ?? '',
  });
  const subjectId        = subject?.id ?? subject?.subjectId ?? subject?.subject_id ?? '';
  const currentOwnerId   = owner.id;
  const currentOwnerName = owner.name;
  const subjectSiteId    = subject?.siteId    ?? subject?.site_id    ?? '';

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    fetchSubjectOwner(subjectId).then((real) => {
      if (!cancelled && real && real.id) setOwner(real);
    });
    return () => { cancelled = true; };
  }, [subjectId]);

  // Candidates: active, attached to the subject's site, not the current owner.
  const ownerOpts = useMemo(() => {
    const onSite = (p) => {
      if (!subjectSiteId) return true;
      const ids = Array.isArray(p.siteIds) ? p.siteIds : [];
      return ids.includes(subjectSiteId) || p.siteId === subjectSiteId;
    };
    return assignees
      .filter((p) => (p.status ?? 'Active') === 'Active')
      .filter((p) => p.id && p.id !== currentOwnerId)
      .filter(onSite)
      .map((p) => ({
        value: p.id,
        label: `${p.fullName}${p.role ? ` — ${p.role}` : ''}`,
      }));
  }, [assignees, subjectSiteId, currentOwnerId]);

  const noCandidates = !loading && ownerOpts.length === 0;

  // Drop a stale selection if it falls out of the candidate list.
  useEffect(() => {
    if (form.newOwnerId && !ownerOpts.some((o) => o.value === form.newOwnerId)) {
      setForm((p) => ({ ...p, newOwnerId: '' }));
    }
  }, [ownerOpts, form.newOwnerId]);

  const set = (key) => (val) => {
    const v = val?.target ? val.target.value : val;
    setForm((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleConfirm = async () => {
    const errs = {};
    if (!form.newOwnerId)       errs.newOwnerId = 'Select the new responsible person.';
    if (!form.reason.trim())    errs.reason     = 'Transfer reason is required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onConfirm({ newOwnerId: form.newOwnerId, reason: form.reason.trim() });
    } finally {
      setSaving(false);
    }
  };

  const subjectLabel = subject?.subjectInitials || subject?.subjectCode
    || subject?.subjectNumber || subject?.subject_number || '—';

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} disabled={saving} type="button">
        Cancel
      </button>
      <button
        className={styles.btnTransfer}
        onClick={handleConfirm}
        disabled={saving || noCandidates}
        type="button"
      >
        <ArrowRightLeft size={13} />
        {saving ? 'Transferring…' : 'Transfer Ownership'}
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Transfer Subject Ownership" size="sm" footer={footer}>
      <div className={styles.body}>
        <div className={styles.snippet}>
          <span className={styles.snippetId}>{subjectLabel}</span>
          <span className={styles.snippetText}>
            Current responsible PI:&nbsp;
            <strong>{currentOwnerName || '— (unassigned)'}</strong>
          </span>
        </div>

        {noCandidates ? (
          <div className={styles.notice} style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' }}>
            <Info size={13} className={styles.noticeIcon} />
            No other active person is attached to this subject's site. Add a
            responsible person to the site before transferring ownership.
          </div>
        ) : (
          <FormField label="New Responsible PI" name="newOwnerId" required error={errors.newOwnerId}>
            <SearchableDropdown
              options={ownerOpts}
              value={form.newOwnerId}
              onChange={set('newOwnerId')}
              placeholder={loading ? 'Loading people…' : 'Select the new responsible person…'}
              searchPlaceholder="Search people…"
            />
          </FormField>
        )}

        <FormField label="Transfer Reason" name="reason" required error={errors.reason}>
          <textarea
            id="reason"
            className={`${styles.textarea} ${errors.reason ? styles.inputError : ''}`}
            value={form.reason}
            onChange={set('reason')}
            placeholder="Why is responsibility for this subject being reassigned?"
            rows={4}
          />
        </FormField>

        <div className={styles.notice}>
          <UserCheck size={13} className={styles.noticeIcon} />
          All open queries and future data-entry responsibility for this subject
          move to the new PI. The previous PI loses edit access unless granted by
          study permissions. This action is recorded in the audit trail.
        </div>
      </div>
    </Modal>
  );
}
