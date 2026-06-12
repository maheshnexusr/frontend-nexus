/**
 * SiteCapturePage — /site/capture
 *
 * Site-personnel Data Capture landing page. Same shape as the sponsor-side
 * CapturePage (and reuses its CSS module), but talks to the site workspace
 * client and runs in single-site scope: the user only ever sees subjects at
 * their own site, so the Site column / site filter are dropped.
 *
 * "Enter Data" routes to /site/capture/form?formId=...&subjectId=... — the
 * form-fill page is built in a follow-up slice.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Database, RefreshCw, Search, X, Plus,
  ClipboardList, FileText, Pencil, UserCheck, AlertCircle, Trash2, ArrowRightLeft,
  Clock, CheckCircle2, PauseCircle, XCircle,
} from 'lucide-react';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { addToast } from '@/app/notificationSlice';
import { formatDateTime } from '@/utils/formatDate';
import { usePermissions } from '@/features/auth/usePermissions';
import TransferOwnershipModal from '@/components/subject/TransferOwnershipModal';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
import css from '@/features/sponsor/pages/CapturePage.module.css';
import pageCss from './SiteCapturePage.module.css';

const STATUS_META = {
  Pending:      { label: 'Pending',      cls: css.sScreening,  icon: <Clock size={11} /> },
  // Legacy alias: pre-rename rows may still arrive as 'Screening' until the
  // tenant lifecycle migration runs — render them as Pending too.
  Screening:    { label: 'Pending',      cls: css.sScreening,  icon: <Clock size={11} /> },
  Enrolled:     { label: 'Enrolled',     cls: css.sEnrolled,   icon: <UserCheck size={11} /> },
  Completed:    { label: 'Completed',    cls: css.sCompleted,  icon: <CheckCircle2 size={11} /> },
  Withdrawn:    { label: 'Withdrawn',    cls: css.sWithdrawn,  icon: <XCircle size={11} /> },
  Discontinued: { label: 'Discontinued', cls: css.sWithdrawn,  icon: <AlertCircle size={11} /> },
};

function normalize(raw) {
  return {
    id:              raw.subject_id        ?? raw.id,
    subjectCode:     raw.subject_number    ?? raw.subjectNumber ?? raw.subject_code ?? raw.id,
    subjectName:     raw.subject_name      ?? raw.subjectName    ?? '',
    subjectInitials: raw.subject_initials  ?? raw.subjectInitials ?? '',
    // Lifecycle 'Screening' was renamed to 'Pending'; canonicalize any legacy
    // value so display + filtering are consistent before the tenant migration.
    status:          ((raw.enrollment_status ?? raw.enrollmentStatus ?? raw.status) === 'Screening'
                       ? 'Pending'
                       : (raw.enrollment_status ?? raw.enrollmentStatus ?? raw.status ?? 'Pending')),
    enrolledAt:      raw.enrolled_at       ?? raw.enrolledAt,
    // Real creation timestamp (true wall-clock). enrolled_at often holds a
    // date-only enrollment date stored at UTC midnight, so it has no meaningful
    // time — the Enrolled column shows createdAt for an accurate timestamp.
    createdAt:       raw.created_at        ?? raw.createdAt,
    visitsTotal:     raw.visits_total      ?? raw.visitsTotal     ?? 0,
    visitsCompleted: raw.visits_completed  ?? raw.visitsCompleted ?? 0,
    lastEntryAt:     raw.last_activity_at  ?? raw.last_entry_at   ?? raw.lastEntryAt,
    siteId:          raw.site_id           ?? raw.siteId,
    // Responsible PI (subject owner); falls back to created_by for legacy rows.
    ownerId:         raw.owner_id          ?? raw.ownerId   ?? raw.created_by ?? raw.createdBy ?? '',
    ownerName:       raw.owner_name        ?? raw.ownerName ?? raw.created_by_name ?? raw.createdByName ?? '',
    eligibilityStatus: raw.eligibility_status ?? raw.eligibilityStatus ?? '',
    eligibilityReason: raw.eligibility_reason ?? raw.eligibilityReason ?? '',
  };
}

const ELIG_STYLE = {
  'Included':       { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  'Excluded':       { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  'Pending Review': { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  'Screen Failed':  { bg: '#fef2f2', color: '#9f1239', border: '#fecdd3' },
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

function SkeletonRow() {
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

function VisitProgress({ completed, total }) {
  if (total === 0) return <span className={css.na}>—</span>;
  const pct = Math.round((completed / total) * 100);
  const cls = pct >= 80 ? css.barGreen : pct >= 40 ? css.barAmber : css.barRed;
  return (
    <div className={css.visitCell}>
      <div className={css.visitBar}>
        <div className={`${css.visitFill} ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={css.visitLabel}>{completed}/{total}</span>
    </div>
  );
}

export default function SiteCapturePage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Subject creation is a discrete permission inside the Data Capture leaf
  // (migration 030 folded the standalone subjects leaf into data_capture).
  // Roles with `data_capture.subject_create` see the button; anyone else
  // just sees the list. Same permission gates the create form route —
  // direct URL hits are caught by useFieldCapabilities downstream.
  const { has } = usePermissions();
  const canCreateSubject = has('data_capture', 'subject_create');
  const canEditSubject   = has('data_capture', 'subject_edit');
  const canDeleteSubject = has('data_capture', 'subject_delete');
  const canOpenForm      = has('data_capture', 'subject_data_capture');
  // Ownership transfer reuses the subject_edit gate (it changes the responsible
  // PI + reassigns the subject's open queries — a write on the subject).
  const canTransferOwnership = canEditSubject;

  const [transferSubject, setTransferSubject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId,   setDeletingId]   = useState(null);
  const [subjects,     setSubjects]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [query,        setQuery]        = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [refreshing,   setRefreshing]   = useState(false);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const loadSubjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await siteWorkspaceClient.listSubjects();
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.subjects ?? res?.data ?? []);
      setSubjects(arr.map(normalize));
    } catch {
      if (!silent) dispatch(addToast({ type: 'error', message: 'Failed to load subjects.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return subjects
      .filter((s) => {
        const matchQ = !q
          || String(s.subjectCode).toLowerCase().includes(q)
          || s.subjectName.toLowerCase().includes(q)
          || s.subjectInitials.toLowerCase().includes(q);
        const matchStat = statusFilter === 'All' || s.status === statusFilter;
        return matchQ && matchStat;
      })
      // Most-recently created first (descending by real creation timestamp).
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
  }, [subjects, query, statusFilter]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => { setPage(1); }, [query, statusFilter]);

  const openForm = (subject) => {
    const params = new URLSearchParams();
    if (subject.id) params.set('subjectId', subject.id);
    navigate(`/site/capture/form?${params.toString()}`);
  };

  const openCreate = () => navigate('/site/capture/subjects/new');
  const openEdit   = (subject) => navigate(`/site/capture/subjects/${subject.id}/edit`);

  const confirmDelete = useCallback(async () => {
    const subject = deleteTarget;
    if (!subject) return;
    const label = subject.subjectCode || subject.subjectInitials || 'this subject';
    setDeletingId(subject.id);
    try {
      await siteWorkspaceClient.deleteSubject(subject.id);
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

  /* ── Transfer ownership (moves owner + open queries to a new PI) ── */
  const handleTransfer = useCallback(async ({ newOwnerId, reason }) => {
    const subject = transferSubject;
    if (!subject) return;
    try {
      const res = await siteWorkspaceClient.transferSubjectOwnership(subject.id, {
        new_owner_id: newOwnerId,
        reason,
      });
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

  const counts = useMemo(() => {
    const m = {};
    subjects.forEach((s) => { m[s.status] = (m[s.status] ?? 0) + 1; });
    return m;
  }, [subjects]);

  return (
    <div className={css.page}>
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Data Capture</h1>
          <p className={css.sub}>Browse subjects enrolled at your site and enter or review visit CRF data.</p>
        </div>
        <div className={pageCss.headerActions}>
          {canCreateSubject && (
            <button
              className={pageCss.btnCreate}
              onClick={openCreate}
              title="Enroll a new subject at your site"
            >
              <Plus size={14} /> Create Subject
            </button>
          )}
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

      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          <div className={css.searchWrapper}>
            <Search size={14} className={css.searchIcon} />
            <input
              className={css.searchInput}
              placeholder="Search by subject ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className={css.searchClear} onClick={() => setQuery('')}><X size={12} /></button>
            )}
          </div>

        </div>
        <span className={css.count}>{filtered.length} of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th className={css.th}>Subject ID</th>
              <th className={css.th}>Initials</th>
              <th className={css.th}>Responsible By</th>
              <th className={css.th}>Status</th>
              <th className={css.th}>Enrolled</th>
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
                      {subjects.length === 0 ? 'No subjects enrolled at your site yet' : 'No subjects match your filters'}
                    </p>
                    <p className={css.emptySub}>
                      {subjects.length === 0
                        ? 'Subjects will appear here once they are enrolled at this site.'
                        : 'Try adjusting your search or filter criteria.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((subject) => {
                const meta = STATUS_META[subject.status] ?? STATUS_META.Pending;
                return (
                  <tr key={subject.id} className={css.row}>
                    <td className={css.td}>
                      <div className={css.subjectCell}>
                        <ClipboardList size={14} className={css.subjectIcon} />
                        <div>
                          <span className={css.subjectCode}>{subject.subjectCode}</span>
                          {subject.eligibilityStatus && (
                            <div style={{ marginTop: 3 }}>
                              <EligibilityBadge status={subject.eligibilityStatus} reason={subject.eligibilityReason} />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={css.td}>{subject.subjectInitials || '—'}</td>
                    <td className={css.td}>
                      {subject.ownerName
                        ? <span className={css.subjectCode}>{subject.ownerName}</span>
                        : <span className={css.na}>—</span>}
                    </td>
                    <td className={css.td}>
                      <span className={`${css.statusBadge} ${meta.cls}`}>
                        {meta.icon}{meta.label}
                      </span>
                    </td>
                    <td className={css.td}>
                      <span className={css.dateCell}>{formatDateTime(subject.createdAt || subject.enrolledAt) || '—'}</span>
                    </td>
                    <td className={css.tdActions}>
                      {canEditSubject && (
                        <button
                          className={pageCss.iconBtn}
                          onClick={() => openEdit(subject)}
                          title="Edit subject"
                          aria-label="Edit subject"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canOpenForm && (
                        <button
                          className={pageCss.iconBtn}
                          onClick={() => openForm(subject)}
                          title="Open CRF"
                          aria-label="Open CRF"
                        >
                          <FileText size={14} />
                        </button>
                      )}
                      {/* {canTransferOwnership && (
                        <button
                          className={pageCss.iconBtn}
                          onClick={() => setTransferSubject(subject)}
                          title={`Transfer ownership${subject.ownerName ? ` (PI: ${subject.ownerName})` : ''}`}
                          aria-label="Transfer subject ownership"
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                      )} */}
                      {canDeleteSubject && (
                        <button
                          className={pageCss.iconBtn}
                          onClick={() => setDeleteTarget(subject)}
                          disabled={deletingId === subject.id}
                          title="Delete subject and all its data"
                          aria-label="Delete subject"
                        >
                          <Trash2 size={14} />
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
