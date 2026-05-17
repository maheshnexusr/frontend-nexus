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
  Database, RefreshCw, Search, X, Filter, Plus,
  ClipboardList, FileText, Pencil, UserCheck, AlertCircle,
  Clock, CheckCircle2, PauseCircle, XCircle,
} from 'lucide-react';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { addToast } from '@/app/notificationSlice';
import css from '@/features/sponsor/pages/CapturePage.module.css';
import pageCss from './SiteCapturePage.module.css';

const STATUS_META = {
  Screening:    { label: 'Screening',    cls: css.sScreening,  icon: <Clock size={11} /> },
  Enrolled:     { label: 'Enrolled',     cls: css.sEnrolled,   icon: <UserCheck size={11} /> },
  Completed:    { label: 'Completed',    cls: css.sCompleted,  icon: <CheckCircle2 size={11} /> },
  Withdrawn:    { label: 'Withdrawn',    cls: css.sWithdrawn,  icon: <XCircle size={11} /> },
  Discontinued: { label: 'Discontinued', cls: css.sWithdrawn,  icon: <AlertCircle size={11} /> },
};

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalize(raw) {
  return {
    id:              raw.subject_id        ?? raw.id,
    subjectCode:     raw.subject_number    ?? raw.subjectNumber ?? raw.subject_code ?? raw.id,
    subjectName:     raw.subject_name      ?? raw.subjectName    ?? '',
    subjectInitials: raw.subject_initials  ?? raw.subjectInitials ?? '',
    status:          raw.enrollment_status ?? raw.enrollmentStatus ?? raw.status ?? 'Screening',
    enrolledAt:      raw.enrolled_at       ?? raw.enrolledAt,
    visitsTotal:     raw.visits_total      ?? raw.visitsTotal     ?? 0,
    visitsCompleted: raw.visits_completed  ?? raw.visitsCompleted ?? 0,
    lastEntryAt:     raw.last_activity_at  ?? raw.last_entry_at   ?? raw.lastEntryAt,
  };
}

function SkeletonRow() {
  return (
    <tr className={css.row}>
      {[1,2,3,4,5].map((i) => (
        <td key={i} className={css.td}>
          <div className={css.skeleton} style={{ width: i === 1 ? '80px' : i === 5 ? '80px' : '120px' }} />
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
    return subjects.filter((s) => {
      const matchQ = !q
        || String(s.subjectCode).toLowerCase().includes(q)
        || s.subjectName.toLowerCase().includes(q)
        || s.subjectInitials.toLowerCase().includes(q);
      const matchStat = statusFilter === 'All' || s.status === statusFilter;
      return matchQ && matchStat;
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
          <button
            className={pageCss.btnCreate}
            onClick={openCreate}
            title="Enroll a new subject at your site"
          >
            <Plus size={14} /> Create Subject
          </button>
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

          <div className={css.filterRow}>
            <Filter size={13} className={css.filterIcon} />
            {['All', 'Enrolled', 'Screening', 'Active', 'Completed', 'Withdrawn'].map((s) => (
              <button
                key={s}
                className={`${css.filterBtn} ${statusFilter === s ? css.filterBtnActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <span className={css.count}>{filtered.length} of {subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th className={css.th}>Subject ID</th>
              <th className={css.th}>Subject Name</th>
              <th className={css.th}>Initials</th>
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
                const meta = STATUS_META[subject.status] ?? STATUS_META.Screening;
                return (
                  <tr key={subject.id} className={css.row}>
                    <td className={css.td}>
                      <div className={css.subjectCell}>
                        <ClipboardList size={14} className={css.subjectIcon} />
                        <span className={css.subjectCode}>{subject.subjectCode}</span>
                      </div>
                    </td>
                    <td className={css.td}>
                      <span className={css.subjectName ?? ''}>{subject.subjectName || '—'}</span>
                    </td>
                    <td className={css.td}>{subject.subjectInitials || '—'}</td>
                    <td className={css.td}>
                      <span className={`${css.statusBadge} ${meta.cls}`}>
                        {meta.icon}{meta.label}
                      </span>
                    </td>
                    <td className={css.td}>
                      <span className={css.dateCell}>{fmtDate(subject.enrolledAt)}</span>
                    </td>
                    <td className={css.tdActions}>
                      <button
                        className={pageCss.iconBtn}
                        onClick={() => openEdit(subject)}
                        title="Edit subject"
                        aria-label="Edit subject"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={pageCss.iconBtn}
                        onClick={() => openForm(subject)}
                        title="Enter eCRF data"
                        aria-label="Enter eCRF data"
                      >
                        <FileText size={14} />
                      </button>
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

    </div>
  );
}
