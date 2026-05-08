/**
 * CapturePage — /sponsor/:studyId/capture
 *
 * Data Capture landing page. Lists subjects with their CRF completion
 * progress per visit. Clicking "Enter Data" for a subject navigates to
 * CaptureFormPage with the appropriate formId and subjectId.
 *
 * Columns:
 *   Subject ID | Site | Status | Visits (completed/total) | Last Entry | Actions
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
  ClipboardList, ChevronRight, UserCheck, AlertCircle,
  Clock, CheckCircle2, PauseCircle, XCircle,
} from 'lucide-react';
import axiosClient  from '@/api/sponsorAxiosClient';
import { addToast } from '@/app/notificationSlice';
import css from './CapturePage.module.css';

/* ── Status meta ─────────────────────────────────────────────────────────── */
const STATUS_META = {
  Enrolled:   { label: 'Enrolled',   cls: css.sEnrolled,   icon: <UserCheck size={11} /> },
  Screening:  { label: 'Screening',  cls: css.sScreening,  icon: <Clock size={11} /> },
  Active:     { label: 'Active',     cls: css.sActive,     icon: <CheckCircle2 size={11} /> },
  Completed:  { label: 'Completed',  cls: css.sCompleted,  icon: <CheckCircle2 size={11} /> },
  Withdrawn:  { label: 'Withdrawn',  cls: css.sWithdrawn,  icon: <XCircle size={11} /> },
  'On Hold':  { label: 'On Hold',    cls: css.sOnHold,     icon: <PauseCircle size={11} /> },
  Ineligible: { label: 'Ineligible', cls: css.sIneligible, icon: <AlertCircle size={11} /> },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalize(raw) {
  return {
    id:             raw.subject_id   ?? raw.id,
    subjectCode:    raw.subject_code ?? raw.subjectCode ?? raw.subjectId ?? raw.id,
    siteName:       raw.site_name    ?? raw.siteName    ?? '—',
    siteId:         raw.site_id      ?? raw.siteId,
    status:         raw.status       ?? 'Enrolled',
    visitsTotal:    raw.visits_total    ?? raw.visitsTotal    ?? 0,
    visitsCompleted:raw.visits_completed?? raw.visitsCompleted ?? 0,
    lastEntryAt:    raw.last_entry_at   ?? raw.lastEntryAt,
    formId:         raw.form_id         ?? raw.formId,
    hasData:        raw.has_data        ?? raw.hasData ?? false,
  };
}

/* ── Skeleton row ────────────────────────────────────────────────────────── */
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

/* ── Progress bar ────────────────────────────────────────────────────────── */
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

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function CapturePage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();

  const [subjects,     setSubjects]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [query,        setQuery]        = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [siteFilter,   setSiteFilter]   = useState('');
  const [refreshing,   setRefreshing]   = useState(false);

  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 25;

  /* ── Load subjects ── */
  const loadSubjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await axiosClient.get(`/api/v1/sponsor/workspace/subjects`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setSubjects(arr.map(normalize));
    } catch {
      if (!silent) dispatch(addToast({ type: 'error', message: 'Failed to load subjects.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studyId, dispatch]);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  /* ── Derived site list for dropdown ── */
  const siteOptions = useMemo(() => {
    const seen = new Set();
    const opts  = [];
    subjects.forEach((s) => {
      if (s.siteId && !seen.has(s.siteId)) {
        seen.add(s.siteId);
        opts.push({ value: s.siteId, label: s.siteName });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [subjects]);

  /* ── Filter + search ── */
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return subjects.filter((s) => {
      const matchQ    = !q || s.subjectCode.toLowerCase().includes(q) || s.siteName.toLowerCase().includes(q);
      const matchStat = statusFilter === 'All' || s.status === statusFilter;
      const matchSite = !siteFilter  || s.siteId === siteFilter;
      return matchQ && matchStat && matchSite;
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
    const base = `/sponsor/${studyId}/capture/form`;
    const params = new URLSearchParams();
    if (subject.formId)      params.set('formId', subject.formId);
    if (subject.id)          params.set('subjectId', subject.id);
    navigate(`${base}?${params.toString()}`);
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
        <button
          className={css.btnRefresh}
          onClick={() => loadSubjects(true)}
          disabled={refreshing}
          title="Refresh"
        >
          <RefreshCw size={15} className={refreshing ? css.spin : ''} />
        </button>
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

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          <div className={css.searchWrapper}>
            <Search size={14} className={css.searchIcon} />
            <input
              className={css.searchInput}
              placeholder="Search by subject ID or site…"
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
              <th className={css.th}>Subject ID</th>
              <th className={css.th}>Site</th>
              <th className={css.th}>Status</th>
              <th className={css.th}>Visit Progress</th>
              <th className={css.th}>Last Entry</th>
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
                const meta = STATUS_META[subject.status] ?? STATUS_META.Enrolled;
                return (
                  <tr key={subject.id} className={css.row}>
                    <td className={css.td}>
                      <div className={css.subjectCell}>
                        <ClipboardList size={14} className={css.subjectIcon} />
                        <span className={css.subjectCode}>{subject.subjectCode}</span>
                      </div>
                    </td>
                    <td className={css.td}>
                      <span className={css.siteName}>{subject.siteName}</span>
                    </td>
                    <td className={css.td}>
                      <span className={`${css.statusBadge} ${meta.cls}`}>
                        {meta.icon}{meta.label}
                      </span>
                    </td>
                    <td className={css.td}>
                      <VisitProgress completed={subject.visitsCompleted} total={subject.visitsTotal} />
                    </td>
                    <td className={css.td}>
                      <span className={css.dateCell}>{fmtDate(subject.lastEntryAt)}</span>
                    </td>
                    <td className={css.tdActions}>
                      <button
                        className={css.btnEnterData}
                        onClick={() => openForm(subject)}
                        title="Enter / Edit CRF Data"
                      >
                        Enter Data <ChevronRight size={13} />
                      </button>
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
    </div>
  );
}
