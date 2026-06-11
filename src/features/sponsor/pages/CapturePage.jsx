/**
 * CapturePage — /sponsor/:studyId/capture
 *
 * Data Capture landing page. Lists subjects with their CRF completion
 * progress per visit. Clicking "Enter Data" for a subject navigates to
 * CaptureFormPage with the appropriate formId and subjectId.
 *
 * Columns:
 *   Subject | Site | Screening Status | Enrollment Date | Actions
 *
 * Actions:
 *   Enter Data → /sponsor/:studyId/capture/form?formId=...&subjectId=...
 *   View History (read-only form)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Database, RefreshCw, Search, X, Filter,
  ClipboardList, FileText, UserCheck, AlertCircle,
  Clock, CheckCircle2, PauseCircle, XCircle, History, Trash2, ArrowRightLeft,
} from 'lucide-react';
import BarWidget from '@/features/sponsor/pages/dashboard/widgets/BarWidget';
import axiosClient  from '@/api/sponsorAxiosClient';
import { addToast } from '@/app/notificationSlice';
import { formatDateTime } from '@/utils/formatDate';
import SnapshotButton from '@/components/feedback/SnapshotButton';
import ActivityLogDrawer from '@/features/sponsor/components/activity/ActivityLogDrawer';
import TransferOwnershipModal from '@/components/subject/TransferOwnershipModal';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
import { usePermissions } from '@/features/auth/usePermissions';
import css from './CapturePage.module.css';

/* ── Status meta ─────────────────────────────────────────────────────────── */
// Covers BOTH vocabularies the BE returns:
//   screening_status  : Screening / Screen Failed / Eligible / Ineligible
//   enrollment_status : Pending / Enrolled / Withdrawn / Completed
// Plus the legacy `status` values (Active / On Hold) for back-compat.
const STATUS_META = {
  // Enrollment / lifecycle
  Enrolled:        { label: 'Enrolled',        cls: css.sEnrolled,   icon: <UserCheck size={11} /> },
  Pending:         { label: 'Pending',         cls: css.sScreening,  icon: <Clock size={11} /> },
  Active:          { label: 'Active',          cls: css.sActive,     icon: <CheckCircle2 size={11} /> },
  Completed:       { label: 'Completed',       cls: css.sCompleted,  icon: <CheckCircle2 size={11} /> },
  Withdrawn:       { label: 'Withdrawn',       cls: css.sWithdrawn,  icon: <XCircle size={11} /> },
  Discontinued:    { label: 'Discontinued',    cls: css.sWithdrawn,  icon: <XCircle size={11} /> },
  'On Hold':       { label: 'On Hold',         cls: css.sOnHold,     icon: <PauseCircle size={11} /> },
  // Screening pipeline
  Screening:       { label: 'Pending',         cls: css.sScreening,  icon: <Clock size={11} /> },
  Eligible:        { label: 'Eligible',        cls: css.sActive,     icon: <CheckCircle2 size={11} /> },
  Ineligible:      { label: 'Ineligible',      cls: css.sIneligible, icon: <AlertCircle size={11} /> },
  'Screen Failed': { label: 'Screen Failed',   cls: css.sIneligible, icon: <XCircle size={11} /> },
};

function StatusBadge({ value }) {
  if (!value) return <span className={css.na}>—</span>;
  const meta = STATUS_META[value] ?? { label: value, cls: css.sEnrolled, icon: null };
  return (
    <span className={`${css.statusBadge} ${meta.cls}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function normalize(raw) {
  return {
    id:                raw.subject_id        ?? raw.id,
    // Visible subject identifier is the initials; subject_number is the
    // formatted internal code (S001…) kept as a fallback for search + edge
    // cases where initials were never captured.
    subjectInitials:   raw.subject_initials  ?? raw.subjectInitials  ?? '',
    subjectCode:       raw.subject_number    ?? raw.subject_code     ?? raw.subjectCode    ?? raw.subjectNumber ?? '',
    // Study ID / Protocol Number captured at study creation — joined in from the
    // tenant studies table so the list can show it without a second study fetch.
    protocolNumber:    raw.protocol_number   ?? raw.protocolNumber   ?? '',
    siteCode:          raw.site_code         ?? raw.siteCode         ?? raw.site_number   ?? '',
    siteName:          raw.site_name         ?? raw.siteName         ?? '',
    siteId:            raw.site_id           ?? raw.siteId,
    // Unified subject status = the enrollment LIFECYCLE (Enrolled → Screening →
    // Completed), the single source of truth shown identically on the site +
    // sponsor portals. (Was previously split: sponsor showed screening_status,
    // site showed enrollment_status — they drifted. Option A: one field.)
    // Lifecycle 'Screening' was renamed to 'Pending'; canonicalize legacy rows.
    status:            ((raw.enrollment_status ?? raw.enrollmentStatus ?? raw.status) === 'Screening'
                         ? 'Pending'
                         : (raw.enrollment_status ?? raw.enrollmentStatus ?? raw.status ?? 'Enrolled')),
    enrolledAt:        raw.enrolled_at       ?? raw.enrolledAt       ?? '',
    // Real creation timestamp — enrolled_at often holds a date-only value at
    // UTC midnight (no meaningful time), so the Enrolled column shows createdAt.
    createdAt:         raw.created_at        ?? raw.createdAt        ?? '',
    formId:            raw.form_id           ?? raw.formId,
    hasData:           raw.has_data          ?? raw.hasData ?? false,
    // Responsible PI (subject owner). Falls back to created_by for legacy rows
    // backfilled at migration time.
    ownerId:           raw.owner_id          ?? raw.ownerId          ?? raw.created_by ?? raw.createdBy ?? '',
    ownerName:         raw.owner_name        ?? raw.ownerName        ?? raw.created_by_name ?? raw.createdByName ?? '',
    // Inclusion/Exclusion eligibility (auto-derived from form criteria).
    eligibilityStatus: raw.eligibility_status ?? raw.eligibilityStatus ?? '',
    eligibilityReason: raw.eligibility_reason ?? raw.eligibilityReason ?? '',
  };
}

// Eligibility badge — Included (green) / Excluded (red) / Pending Review (amber) /
// Screen Failed (grey-red).
const ELIG_STYLE = {
  'Included':        { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  'Excluded':        { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  'Pending Review':  { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  'Screen Failed':   { bg: '#fef2f2', color: '#9f1239', border: '#fecdd3' },
};
function EligibilityBadge({ status, reason }) {
  if (!status) return null;
  const st = ELIG_STYLE[status] || ELIG_STYLE['Pending Review'];
  return (
    <span title={reason || status} style={{
      display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}`,
    }}>
      {status}
    </span>
  );
}

/* ── Skeleton row ────────────────────────────────────────────────────────── */
function SkeletonRow() {
  // 6 columns: Subject, Site, Responsible PI, Screening Status, Enrollment Date, Actions.
  return (
    <tr className={css.row}>
      {[1,2,3,4,5,6].map((i) => (
        <td key={i} className={css.td}>
          <div className={css.skeleton} style={{ width: i === 1 ? '80px' : i === 6 ? '80px' : '120px' }} />
        </td>
      ))}
    </tr>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function CapturePage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();

  // Activity-log drill-in. The icon shows only for roles with the data_capture
  // activity_log permission. Subject CRUD was folded into data_capture in
  // migration 030, so the audit gate collapsed to a single leaf as well.
  const { has } = usePermissions();
  const canViewSubjectActivity = has('data_capture', 'activity_log');
  const canOpenForm            = has('data_capture', 'subject_data_capture');
  const canDeleteSubject       = has('data_capture', 'subject_delete');
  const canTransferOwnership   = has('data_capture', 'subject_edit');
  const [activitySubject, setActivitySubject] = useState(null);
  const [transferSubject, setTransferSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [subjects,     setSubjects]     = useState([]);
  const [crfBySite,    setCrfBySite]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [query,        setQuery]        = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [siteFilter,   setSiteFilter]   = useState('');
  const [refreshing,   setRefreshing]   = useState(false);
  const [studyFormId,  setStudyFormId]  = useState(null);

  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 25;

  /* ── Load subjects ── */
  const loadSubjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await axiosClient.get(`/api/v1/sponsor/workspace/subjects`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.subjects ?? res?.data ?? []);
      setSubjects(arr.map(normalize));
    } catch {
      if (!silent) dispatch(addToast({ type: 'error', message: 'Failed to load subjects.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studyId, dispatch]);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  /* ── CRF completion % by site (completeness graph) ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/api/v1/sponsor/workspace/crf-completion-by-site');
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        if (!cancelled) {
          setCrfBySite(items.map((r) => ({
            site: r.siteCode || r.site_code || r.siteName || r.site_name || '—',
            completion: r.completion ?? 0,
          })));
        }
      } catch { /* non-fatal — graph just stays empty */ }
    })();
    return () => { cancelled = true; };
  }, [studyId]);

  /* ── Delete subject (hard delete + all its data) ── */
  const confirmDelete = useCallback(async () => {
    const subject = deleteTarget;
    if (!subject) return;
    const label = subject.subjectCode || subject.subjectInitials || 'this subject';
    setDeletingId(subject.id);
    try {
      await axiosClient.delete(`/api/v1/sponsor/workspace/subjects/${subject.id}`);
      dispatch(addToast({ type: 'success', message: `Subject ${label} deleted.` }));
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    } catch (err) {
      dispatch(addToast({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to delete subject.',
      }));
    } finally {
      setDeletingId(null);
    }
  }, [dispatch, deleteTarget]);

  /* ── Transfer subject ownership (moves owner + open queries to a new PI) ── */
  const handleTransfer = useCallback(async ({ newOwnerId, reason }) => {
    const subject = transferSubject;
    if (!subject) return;
    try {
      const res = await axiosClient.post(
        `/api/v1/sponsor/workspace/subjects/${subject.id}/transfer-ownership`,
        { new_owner_id: newOwnerId, reason }
      );
      const moved = res?.queriesMoved ?? res?.queries_moved;
      dispatch(addToast({
        type: 'success',
        message: `Ownership transferred to ${res?.newOwnerName ?? res?.new_owner_name ?? 'the new PI'}.`
          + (moved ? ` ${moved} open quer${moved === 1 ? 'y' : 'ies'} moved.` : ''),
      }));
      setTransferSubject(null);
      loadSubjects(true);
    } catch (err) {
      dispatch(addToast({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to transfer ownership.',
      }));
    }
  }, [transferSubject, dispatch, loadSubjects]);

  /* ── Resolve the study's form (per-study eCRF). Picks the first form
        returned by the sponsor forms endpoint and caches its id. ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get(`/api/v1/sponsor/workspace/forms`);
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        if (!cancelled && items.length > 0) {
          setStudyFormId(items[0].formId ?? items[0].form_id ?? null);
        }
      } catch {
        if (!cancelled) {
          dispatch(addToast({
            type: 'error',
            message: 'Failed to load study form. Publish a form first.',
          }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [dispatch]);

  /* ── Derived site list for dropdown ── */
  const siteOptions = useMemo(() => {
    const seen = new Set();
    const opts  = [];
    subjects.forEach((s) => {
      if (s.siteId && !seen.has(s.siteId)) {
        seen.add(s.siteId);
        const label = [s.siteCode, s.siteName].filter(Boolean).join(' — ') || s.siteId;
        opts.push({ value: s.siteId, label });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [subjects]);

  /* ── Filter + search ── */
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return subjects
      .filter((s) => {
        // Match against every human-readable identifier so a study coordinator
        // can search by initials, the formatted code, the site code, or the
        // site name interchangeably.
        const matchQ    = !q || [s.subjectInitials, s.subjectCode, s.siteCode, s.siteName]
          .some((v) => (v ?? '').toLowerCase().includes(q));
        // Status quick-filter matches the screening pipeline (the column the
        // table renders). Falls back to the legacy single status field for
        // older subject rows that don't carry a screening_status yet.
        const matchStat = statusFilter === 'All' || s.status === statusFilter;
        const matchSite = !siteFilter  || s.siteId === siteFilter;
        return matchQ && matchStat && matchSite;
      })
      // Most-recently created first (descending by real creation timestamp).
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
  }, [subjects, query, statusFilter, siteFilter]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => { setPage(1); }, [query, statusFilter, siteFilter]);

  /* ── Navigation ── */
  const openForm = (subject) => {
    const formId = subject.formId || studyFormId;
    if (!formId) {
      dispatch(addToast({
        type: 'error',
        message: 'No form is published for this study yet.',
      }));
      return;
    }
    const params = new URLSearchParams({
      formId,
      ...(subject.id ? { subjectId: subject.id } : {}),
    });
    navigate(`/sponsor/${studyId}/capture/form?${params.toString()}`);
  };

  /* ── Status counts for summary ── */
  const counts = useMemo(() => {
    const m = {};
    subjects.forEach((s) => { m[s.status] = (m[s.status] ?? 0) + 1; });
    return m;
  }, [subjects]);

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Data Capture</h1>
          <p className={css.sub}>Browse enrolled subjects and enter or review visit CRF data.</p>
        </div>
        <div className={css.headerActions}>
          <SnapshotButton leaf="data_capture" filename="data_capture" />
          <button
            className={css.btnRefresh}
            onClick={() => loadSubjects(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? css.spin : ''} />
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {subjects.length > 0 && (
        <div className={css.kpiRow}>
          <div className={css.kpi}>
            <span className={css.kpiVal}>{subjects.length}</span>
            <span className={css.kpiLabel}>Total Subjects</span>
          </div>
          {Object.entries(STATUS_META).map(([status, meta]) => {
            const n = counts[status] ?? 0;
            if (n === 0) return null;
            return (
              <div key={status} className={css.kpi}>
                <span className={css.kpiVal}>{n}</span>
                <span className={css.kpiLabel}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* CRF completeness by site */}
      {crfBySite.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <BarWidget
            title="CRF Completion % by Site"
            data={crfBySite}
            valueKey="completion"
            labelKey="site"
            color="#059669"
            unit="%"
            domainMax={100}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          <div className={css.searchWrapper}>
            <Search size={14} className={css.searchIcon} />
            <input
              className={css.searchInput}
              placeholder="Search by subject initials, code or site…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className={css.searchClear} onClick={() => setQuery('')}><X size={12} /></button>
            )}
          </div>

          <div className={css.filterRow}>
            <Filter size={13} className={css.filterIcon} />
            {/* Pills filter by the enrollment lifecycle (the unified status). */}
            {['All', 'Enrolled', 'Pending', 'Completed'].map((s) => (
              <button
                key={s}
                className={`${css.filterBtn} ${statusFilter === s ? css.filterBtnActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {siteOptions.length > 0 && (
            <select className={css.siteSelect} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
              <option value="">All Sites</option>
              {siteOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>
        <span className={css.count}>{filtered.length} of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th className={css.th}>Subject</th>
              <th className={css.th}>Site</th>
              <th className={css.th}>Responsible PI</th>
              <th className={css.th}>Status</th>
              <th className={css.th}>Enrollment Date</th>
              <th className={css.thActions}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={6} className={css.emptyCell}>
                  <div className={css.empty}>
                    <Database size={40} strokeWidth={1.25} className={css.emptyIcon} />
                    <p className={css.emptyTitle}>
                      {subjects.length === 0 ? 'No subjects enrolled yet' : 'No subjects match your filters'}
                    </p>
                    <p className={css.emptySub}>
                      {subjects.length === 0
                        ? 'Subjects will appear here once they are enrolled in this study.'
                        : 'Try adjusting your search or filter criteria.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((subject) => {
                return (
                  <tr key={subject.id} className={css.row}>
                    <td className={css.td}>
                      <div className={css.subjectCell}>
                        <ClipboardList size={14} className={css.subjectIcon} />
                        {/* Primary visible identifier is initials per study
                            convention; the formatted subject_number (S001…)
                            shows underneath when both exist. */}
                        <div>
                          <span className={css.subjectCode}>
                            {subject.subjectInitials || subject.subjectCode || '—'}
                          </span>
                          {subject.subjectInitials && subject.subjectCode && (
                            <div className={css.subjectSubLabel}>{subject.subjectCode}</div>
                          )}
                          {subject.eligibilityStatus && (
                            <div style={{ marginTop: 3 }}>
                              <EligibilityBadge status={subject.eligibilityStatus} reason={subject.eligibilityReason} />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={css.td}>
                      {/* Site cell stacks code (primary) + name (secondary).
                          Either may be missing depending on what was captured. */}
                      <span className={css.siteCode}>{subject.siteCode || '—'}</span>
                      {subject.siteName && (
                        <div className={css.siteName}>{subject.siteName}</div>
                      )}
                    </td>
                    {/* Responsible PI (subject owner). */}
                    <td className={css.td}>
                      {subject.ownerName
                        ? <span className={css.siteCode}>{subject.ownerName}</span>
                        : <span className={css.na}>—</span>}
                    </td>
                    {/* Screening pipeline (Screening / Eligible / Screen Failed / Ineligible). */}
                    <td className={css.td}>
                      <StatusBadge value={subject.status} />
                    </td>
                    <td className={css.td}>
                      <span className={css.dateCell}>{formatDateTime(subject.createdAt || subject.enrolledAt) || '—'}</span>
                    </td>
                    <td className={css.tdActions}>
                      {canViewSubjectActivity && (
                        <button
                          type="button"
                          className={css.iconBtn}
                          onClick={() => setActivitySubject(subject)}
                          title="View activity log for this subject"
                          aria-label="View activity log"
                        >
                          <History size={16} />
                        </button>
                      )}
                      {canOpenForm && (
                        <button
                          type="button"
                          className={css.iconBtn}
                          onClick={() => openForm(subject)}
                          title="Navigate to CRF"
                          aria-label="Navigate to CRF"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      {/* {canTransferOwnership && (
                        <button
                          type="button"
                          className={css.iconBtn}
                          onClick={() => setTransferSubject(subject)}
                          title={`Transfer ownership${subject.ownerName ? ` (PI: ${subject.ownerName})` : ''}`}
                          aria-label="Transfer subject ownership"
                        >
                          <ArrowRightLeft size={16} />
                        </button>
                      )} */}
                      {canDeleteSubject && (
                        <button
                          type="button"
                          className={css.iconBtn}
                          onClick={() => setDeleteTarget(subject)}
                          disabled={deletingId === subject.id}
                          title="Delete subject and all its data"
                          aria-label="Delete subject"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className={css.pagination}>
          <button
            className={css.pageBtn}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span className={css.pageInfo}>Page {page} of {totalPages}</span>
          <button
            className={css.pageBtn}
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      <ActivityLogDrawer
        open={Boolean(activitySubject)}
        resourceType="subject"
        resourceId={activitySubject?.id}
        resourceLabel={activitySubject ? `${activitySubject.subjectCode} — ${activitySubject.siteName}` : ''}
        onClose={() => setActivitySubject(null)}
      />

      {transferSubject && (
        <TransferOwnershipModal
          subject={transferSubject}
          onConfirm={handleTransfer}
          onClose={() => setTransferSubject(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        variant="danger"
        title="Delete subject"
        message={deleteTarget
          ? `Delete ${deleteTarget.subjectCode || deleteTarget.subjectInitials || 'this subject'} and ALL of its data (forms, queries, verifications)? This cannot be undone.`
          : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
