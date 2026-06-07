import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Eye, MessageSquare, CheckCircle, AlertTriangle,
  RotateCcw, Download, Filter, Search, X as XIcon,
  RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown,
  MessageSquareWarning, FileText, Clock, ArrowRightLeft,
} from 'lucide-react';
import { sponsorQueryClient }   from '@/features/sponsor/api/sponsorQueryClient';
import sponsorAxiosClient       from '@/api/sponsorAxiosClient';
import TransferOwnershipModal   from '@/components/subject/TransferOwnershipModal';
import { addToast }             from '@/app/notificationSlice';
import { selectCurrentUser }    from '@/features/auth/authSlice';
import SearchableDropdown       from '@/components/form/SearchableDropdown';
import QueryDetailsModal        from '@/features/sponsor/components/query/QueryDetailsModal';
import RespondModal             from '@/features/sponsor/components/query/RespondModal';
import CloseReopenModal         from '@/features/sponsor/components/query/CloseReopenModal';
import EscalateModal            from '@/features/sponsor/components/query/EscalateModal';
import ConfirmDialog            from '@/components/feedback/ConfirmDialog';
import { useReadOnlyView }      from '@/features/workspace/hooks/useReadOnlyView';
import { formatDate }           from '@/utils/formatDate';
import PlatformDatePicker       from '@/components/form/PlatformDatePicker';
import SlaSettingsModal         from '@/features/sponsor/components/sla/SlaSettingsModal';
import SnapshotButton           from '@/components/feedback/SnapshotButton';
import StatCard                 from '@/components/feedback/StatCard';
import { usePermissions }       from '@/features/auth/usePermissions';
import styles from './QueriesPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

// Status quick-filter options — the new spec palette. `All` shows everything;
// `Overdue` is computed (slaRemaining < 0 OR status === 'Overdue').
const STATUS_OPTIONS   = ['All', 'Open', 'In Progress', 'Resolved', 'Closed', 'Overdue'];
const PRIORITY_OPTIONS = ['All', 'Critical', 'High', 'Medium', 'Low'];

const PRIORITY_META = {
  Critical: { color: '#991b1b', bg: '#fee2e2', dot: '#991b1b' },
  High:     { color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  Medium:   { color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  Low:      { color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
};
// Query status palette per spec:
//   Open         Yellow
//   In Progress  Blue
//   Resolved     Green
//   Closed       Gray
//   Overdue      Red
// `Raised` and `Answered` are legacy server values mapped onto Open / In
// Progress respectively so existing data renders with the spec palette.
const STATUS_META = {
  Open:          { color: '#92400e', bg: '#fef3c7', accent: '#F59E0B' }, // Yellow
  'In Progress': { color: '#1d4ed8', bg: '#dbeafe', accent: '#2563EB' }, // Blue
  Resolved:      { color: '#166534', bg: '#dcfce7', accent: '#16A34A' }, // Green
  Closed:        { color: '#475569', bg: '#f1f5f9', accent: '#94A3B8' }, // Gray
  Overdue:       { color: '#b91c1c', bg: '#fef2f2', accent: '#DC2626' }, // Red
  Raised:        { color: '#92400e', bg: '#fef3c7', accent: '#F59E0B' }, // alias → Open
  Answered:      { color: '#1d4ed8', bg: '#dbeafe', accent: '#2563EB' }, // alias → In Progress
};

// Map legacy / server alias statuses onto the spec's 4-state palette.
const STATUS_DISPLAY = { Raised: 'Open', Answered: 'In Progress' };
const toDisplayStatus = (st) => STATUS_DISPLAY[st] ?? st ?? 'Open';

// Spec: aging is always rendered as `<n>d`. We used to collapse multi-week
// values into "Nw Md" for compactness; reverted to plain days so the column
// is one consistent unit and easy to sort visually.
function fmtAging(days) {
  if (days == null || Number.isNaN(days)) return '—';
  if (days <= 0) return '0d';
  return `${days}d`;
}

const fmtDate = (iso) => formatDate(iso) || '—';

function SortIcon({ col, sortKey, sortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />;
  if (sortDir === 'asc')  return <ChevronUp    size={12} />;
  return                          <ChevronDown  size={12} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QueriesPage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();
  const currentUser = useSelector(selectCurrentUser);
  // Phase 2 — "My Queries" toggle (filters to queries assigned to me).
  const [onlyMine, setOnlyMine] = useState(false);

  // SLA Settings modal — open from the header. Visible to any role that can
  // VIEW queries; edits are gated server-side AND client-side by the discrete
  // `query_manager.sla_settings` permission.
  const { has } = usePermissions();
  const canEditSla = has('query_manager', 'sla_settings');
  const canEditQuery   = has('query_manager', 'edit');
  const canCreateQuery = has('query_manager', 'create');
  const canRaiseQuery  = has('data_capture',  'raise_query');
  const canCloseQuery  = has('data_capture',  'close_query');
  // Escalate uses the discrete query_manager.escalate leaf, with edit as the
  // fallback so existing edit-capable roles keep escalating (migration 034).
  const canEscalate    = has('query_manager', 'escalate') || canEditQuery;
  // Standalone query reassignment was removed: escalate handles handler-to-handler
  // hand-offs and ownership transfer handles owner-to-owner, so a dedicated
  // reassign action was redundant.
  const canTransferOwnership = has('data_capture', 'subject_edit');
  const [slaOpen,  setSlaOpen]  = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  // `queries` drives the table (re-fetched with server-side filters).
  // `allQueries` drives the stats cards above the table — fetched once with
  // no filters so the totals don't shift when the user changes table filters.
  const [queries,    setQueries]    = useState([]);
  const [allQueries, setAllQueries] = useState([]);
  const [siteOpts,  setSiteOpts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  // Study's form id — fallback for opening the form from a query whose row
  // doesn't carry one (single-form studies).
  const [studyFormId, setStudyFormId] = useState(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [statusFilter,   setStatusFilter]   = useState('Open');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [siteFilter,     setSiteFilter]     = useState('');
  const [query,          setQuery]          = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');

  // ── Pagination & sort ─────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey,  setSortKey]  = useState('raisedDate');
  const [sortDir,  setSortDir]  = useState('desc');

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState(new Set());

  // ── Modals ────────────────────────────────────────────────────────────────
  const [detailsTarget,  setDetails]   = useState(null);
  const [respondTarget,  setRespond]   = useState(null);
  const [closeTarget,    setClose]     = useState(null);
  const [reopenTarget,   setReopen]    = useState(null);
  const [escalateTarget, setEscalate]  = useState(null);
  const [transferQuery,  setTransferQuery] = useState(null);
  const [bulkCloseOpen,    setBulkClose]    = useState(false);
  // Phase 2 — additional bulk actions
  const [bulkEscalateOpen, setBulkEscalate] = useState(false);
  const [exporting,      setExporting] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    if (!studyId) return;
    setLoading(true);
    Promise.all([
      sponsorQueryClient.list(studyId, {
        status:   statusFilter,
        priority: priorityFilter,
        siteCode: siteFilter,
        dateFrom,
        dateTo,
      }),
      siteOpts.length ? Promise.resolve(null) : sponsorQueryClient.getSites(studyId),
    ])
    .then(([qs, sites]) => {
      setQueries(qs);
      if (sites) setSiteOpts(sites);
      setSelected(new Set());
    })
    .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load queries.' })))
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, statusFilter, priorityFilter, siteFilter, dateFrom, dateTo]);

  // Unfiltered fetch — drives the stats cards. Re-runs on studyId change and
  // is triggered manually after every mutation (respond / close / escalate /
  // reopen / bulk) so the totals stay current.
  const loadAll = useCallback(() => {
    if (!studyId) return;
    sponsorQueryClient.list(studyId, {})
      .then((qs) => setAllQueries(qs))
      .catch(() => { /* leave existing stats — silent */ });
  }, [studyId]);

  useEffect(() => { load(); },    [load]);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Resolve the study's form id once, so the "Open Form" action works even
  // for query rows that don't carry a form id.
  useEffect(() => {
    if (!studyId) return undefined;
    let cancelled = false;
    sponsorAxiosClient.get('/api/v1/sponsor/workspace/forms')
      .then((res) => {
        if (cancelled) return;
        const items = res?.items ?? res ?? [];
        if (items.length) setStudyFormId(items[0].formId ?? items[0].form_id ?? null);
      })
      .catch(() => { /* leave null — the action falls back to a toast */ });
    return () => { cancelled = true; };
  }, [studyId]);

  // Open the study form for a query's subject, so the Query Manager can review
  // the data the query was raised against.
  const openStudyForm = (q) => {
    const formId = q.formId || studyFormId;
    if (!formId || !q.subjectId) {
      dispatch(addToast({ type: 'error', message: 'Cannot open the form — no form or subject for this query.' }));
      return;
    }
    // Deep-link straight to the page the query was raised against (the form
    // runner reads ?pageId=… and jumps there). Falls back to page 1 for legacy
    // queries with no stored page_id.
    const pageQS = q.pageId ? `&pageId=${encodeURIComponent(q.pageId)}` : '';
    navigate(`/sponsor/${studyId}/capture/form?formId=${formId}&subjectId=${q.subjectId}${pageQS}`);
  };
  useEffect(() => { setPage(1); setSelected(new Set()); }, [statusFilter, priorityFilter, siteFilter, query, dateFrom, dateTo, onlyMine]);

  // ── Local filter & sort ───────────────────────────────────────────────────
  const meAssigneeKeys = useMemo(() => new Set(
    [currentUser?.id, currentUser?.email, currentUser?.username, currentUser?.fullName]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase()),
  ), [currentUser]);

  // Per-study sequential Query ID (1, 2, 3, …) computed from the unfiltered
  // result set so the same query keeps the same number regardless of the
  // active filter. Sorted ASC by raised date so #1 is always the oldest.
  // Shifts on delete; if you need an immutable number, surface it from the BE.
  const sequenceById = useMemo(() => {
    const sorted = [...queries].sort((a, b) => {
      const av = a.raisedDate ?? '';
      const bv = b.raisedDate ?? '';
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    const map = new Map();
    sorted.forEach((q, idx) => map.set(q.id, idx + 1));
    return map;
  }, [queries]);

  const filtered = useMemo(() => {
    let rows = queries;
    if (onlyMine) {
      // "My Queries" = queries the current user RAISED. The raiser is stored as
      // an id (raised_by) plus a snapshotted name (raised_by_name); match the
      // current user against both so it works whichever resolved.
      rows = rows.filter((q) =>
        [q.raisedBy, q.raisedByName]
          .some((v) => v && meAssigneeKeys.has(String(v).toLowerCase()))
      );
    }
    rows = rows.filter((q) => {
      if (!query) return true;
      const s = query.toLowerCase();
      return [q.id, q.queryText, q.fieldLabel, q.fieldName, q.subjectId, q.formName, q.raisedBy]
        .some((v) => (v ?? '').toLowerCase().includes(s));
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (sortKey === 'priority') {
          const ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          av = ORDER[av] ?? 2; bv = ORDER[bv] ?? 2;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        if (sortKey === 'daysOpen') return sortDir === 'asc' ? av - bv : bv - av;
        av = (av ?? '').toString().toLowerCase();
        bv = (bv ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [queries, query, sortKey, sortDir, onlyMine, meAssigneeKeys]);

  const pageData   = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // ── Stats — keyed to the new spec palette. ───────────────────────────────
  // Always counts the FULL set of queries for this study; never the filtered
  // table view. Changing status/priority/site/date filters never shifts these
  // numbers.
  const stats = useMemo(() => {
    const byDisplay = (label) => allQueries.filter((q) => toDisplayStatus(q.status) === label).length;
    return {
      total:      allQueries.length,
      open:       byDisplay('Open'),
      inProgress: byDisplay('In Progress'),
      resolved:   byDisplay('Resolved'),
      closed:     byDisplay('Closed'),
      overdue:    allQueries.filter((q) => q.status === 'Overdue'
        || (q.slaRemaining < 0 && toDisplayStatus(q.status) !== 'Resolved' && toDisplayStatus(q.status) !== 'Closed')).length,
    };
  }, [allQueries]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const activeOnPage = pageData.filter((q) => {
    const d = toDisplayStatus(q.status);
    return d !== 'Resolved' && d !== 'Closed';
  });
  const allActiveSelected = activeOnPage.length > 0 && activeOnPage.every((q) => selected.has(q.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allActiveSelected) activeOnPage.forEach((q) => next.delete(q.id));
      else                   activeOnPage.forEach((q) => next.add(q.id));
      return next;
    });
  };
  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDetailAction = (action, target) => {
    setDetails(null);
    if (action === 'respond')  setRespond(target);
    if (action === 'close')    setClose(target);
    if (action === 'reopen')   setReopen(target);
    if (action === 'escalate') setEscalate(target);
  };

  const handleRespond = async (data) => {
    try {
      await sponsorQueryClient.respond(studyId, respondTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query responded successfully. Email notification sent.' }));
      setRespond(null); load(); loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to respond to query. Please try again.' }));
      throw new Error();
    }
  };

  const handleClose = async (data) => {
    try {
      await sponsorQueryClient.close(studyId, closeTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query closed successfully.' }));
      setClose(null); load(); loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to close query. Please try again.' }));
      throw new Error();
    }
  };

  const handleReopen = async (data) => {
    try {
      await sponsorQueryClient.reopen(studyId, reopenTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query reopened successfully.' }));
      setReopen(null); load(); loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to reopen query. Please try again.' }));
      throw new Error();
    }
  };

  const handleEscalate = async (data) => {
    try {
      await sponsorQueryClient.escalate(studyId, escalateTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query escalated successfully.' }));
      setEscalate(null); load(); loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to escalate query. Please try again.' }));
      throw new Error();
    }
  };

  // Transfer the SUBJECT's ownership straight from a query row. This is the
  // sanctioned alternative to query-level reassignment: it moves the subject +
  // ALL its open queries (incl. this one) to the new PI, with an audit trail.
  const handleTransferOwnership = async ({ newOwnerId, reason }) => {
    const q = transferQuery;
    if (!q?.subjectId) return;
    try {
      const res = await sponsorAxiosClient.post(
        `/api/v1/sponsor/workspace/subjects/${q.subjectId}/transfer-ownership`,
        { new_owner_id: newOwnerId, reason }
      );
      const moved = res?.queriesMoved ?? res?.queries_moved;
      dispatch(addToast({
        type: 'success',
        message: `Subject ownership transferred to ${res?.newOwnerName ?? res?.new_owner_name ?? 'the new PI'}.`
          + (moved ? ` ${moved} open quer${moved === 1 ? 'y' : 'ies'} moved.` : ''),
      }));
      setTransferQuery(null);
      load(); loadAll();
    } catch (err) {
      dispatch(addToast({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to transfer ownership.',
      }));
    }
  };

  const handleBulkClose = async (data) => {
    try {
      const count = await sponsorQueryClient.bulkClose(studyId, [...selected], data);
      dispatch(addToast({ type: 'success', message: `Bulk action completed successfully for ${count} queries.` }));
      setBulkClose(false); load(); loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to close queries. Please try again.' }));
      throw new Error();
    }
  };

  const handleBulkEscalate = async (data) => {
    const ids = [...selected];
    try {
      const ok = await sponsorQueryClient.bulkEscalate(studyId, ids, data);
      dispatch(addToast({ type: 'success', message: `${ok} of ${ids.length} queries escalated.` }));
      setBulkEscalate(false);
      setSelected(new Set());
      load(); loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to escalate queries.' }));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const ids = [...selected];
      // "Export Selected" → only the ticked rows; if none selected, export the
      // current filtered list.
      await sponsorQueryClient.exportCSV(studyId, ids.length
        ? { ids }
        : { status: statusFilter, priority: priorityFilter, siteCode: siteFilter });
      dispatch(addToast({ type: 'success', message: 'Query exported successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export. Please try again.' }));
    } finally {
      setExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedCount = selected.size;

  const COLUMNS = [
    { key: 'id',                label: 'Query ID'         },
    { key: 'siteId',            label: 'Site Details'             },
    { key: 'subjectId',         label: 'Subject Details'          },
    { key: 'pageName',          label: 'CRF Block / Page'     },
    { key: 'fieldName',         label: 'Field'            },
    { key: 'status',            label: 'Status'           },
    
    { key: 'priority',          label: 'Priority'         },
    { key: 'daysOpen',          label: 'Aging'            },
    { key: 'raisedBy',          label: 'Actioned By'      },
    { key: 'raisedDate',        label: 'Actioned Date'    },
    // Resolution column hidden for now (keep the cell below in sync if re-enabled).
    // { key: 'resolutionComment', label: 'Resolution'       },
  ];

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Query Management</h1>
          <p className={styles.sub}>Track and resolve data queries for this study.</p>
        </div>
        <div className={styles.headerActions}>
          {canEditSla && (
            <button
              className={styles.btnSecondary}
              onClick={() => setSlaOpen(true)}
              title="Configure SLA"
            >
              <Clock size={13} /> SLA Settings
            </button>
          )}
          <SnapshotButton leaf="query_manager" filename="queries" className={styles.btnSecondary} />
          <button className={styles.btnSecondary} onClick={handleExport} disabled={exporting}>
            <Download size={13} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button className={styles.btnRefresh} onClick={() => { load(); loadAll(); }} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <SlaSettingsModal
        open={slaOpen}
        kind="query_manager"
        canEdit={canEditSla}
        onClose={() => setSlaOpen(false)}
      />

      {/* Counts banner — shared <StatCard> (same component the Verification
          Manager uses), so the card design lives in one place. */}
      <div className={styles.statsBar}>
        {[
          { label: 'Total Queries', value: stats.total,      color: '#0f172a', icon: MessageSquare       },
          { label: 'Open',          value: stats.open,       color: '#92400e', icon: Clock               },
          { label: 'In Progress',   value: stats.inProgress, color: '#1d4ed8', icon: RotateCcw           },
          { label: 'Resolved',      value: stats.resolved,   color: '#166534', icon: CheckCircle         },
          { label: 'Closed',        value: stats.closed,     color: '#475569', icon: MessageSquareWarning },
          { label: 'Overdue',       value: stats.overdue,    color: '#b91c1c', icon: AlertTriangle       },
        ].map(({ label, value, color, icon }) => (
          <StatCard key={label} icon={icon} label={label} value={value} accent={color} />
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* All Queries / My Queries toggle (Phase 2). */}
          <div className={styles.filterWrap}>
            <button
              type="button"
              className={`${styles.filterBtn} ${!onlyMine ? styles.filterBtnActive : ''}`}
              onClick={() => setOnlyMine(false)}
              title="Show every query in this study"
            >
              All Queries
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${onlyMine ? styles.filterBtnActive : ''}`}
              onClick={() => setOnlyMine(true)}
              title="Show only queries assigned to me"
              disabled={meAssigneeKeys.size === 0}
            >
              My Queries
            </button>
          </div>

          {/* Status pills */}
          <div className={styles.filterWrap}>
            <Filter size={13} className={styles.filterIcon} />
            {STATUS_OPTIONS.map((s) => {
              const meta   = STATUS_META[s] ?? {};
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ''}`}
                  style={active && meta.bg ? { background: meta.bg, color: meta.color, borderColor: meta.accent } : {}}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Priority pills */}
          <div className={styles.filterWrap}>
            {PRIORITY_OPTIONS.map((p) => {
              const active = priorityFilter === p;
              const meta   = PRIORITY_META[p];
              return (
                <button
                  key={p}
                  className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ''}`}
                  style={active && meta ? { background: meta.bg, color: meta.color, borderColor: meta.color } : {}}
                  onClick={() => setPriorityFilter(p)}
                >
                  {meta && <span className={styles.dot} style={{ background: meta.dot }} />}
                  {p}
                </button>
              );
            })}
          </div>

          {/* Site dropdown */}
          <div className={styles.siteFilter}>
            <SearchableDropdown
              options={[{ value: '', label: 'All Sites' }, ...siteOpts]}
              value={siteFilter}
              onChange={(v) => setSiteFilter(v ?? '')}
              placeholder="All Sites"
              searchPlaceholder="Search site…"
            />
          </div>

          {/* Date range */}
          <div className={styles.dateRange}>
            <PlatformDatePicker className={styles.dateInput} value={dateFrom} onChange={setDateFrom} placeholder="From" />
            <span className={styles.dateSep}>–</span>
            <PlatformDatePicker className={styles.dateInput} value={dateTo}   onChange={setDateTo}   placeholder="To" />
          </div>
        </div>

        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search ID, text, field, subject…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button className={styles.searchClear} onClick={() => setQuery('')}><XIcon size={12} /></button>}
        </div>
      </div>

      {/* Active-filter chips — quick-dismiss for every non-default filter the
          user has applied. Status / All-vs-My are intentionally NOT shown as
          chips since they're always-visible pills above. */}
      {(() => {
        const chips = [];
        if (priorityFilter && priorityFilter !== 'All') {
          chips.push({ key: 'priority', label: `Priority: ${priorityFilter}`, clear: () => setPriorityFilter('All') });
        }
        if (siteFilter) {
          const opt = siteOpts.find((o) => o.value === siteFilter);
          chips.push({ key: 'site', label: `Site: ${opt?.label ?? siteFilter}`, clear: () => setSiteFilter('') });
        }
        if (dateFrom) chips.push({ key: 'from',  label: `From: ${formatDate(dateFrom)}`, clear: () => setDateFrom('') });
        if (dateTo)   chips.push({ key: 'to',    label: `To: ${formatDate(dateTo)}`,     clear: () => setDateTo('')   });
        if (query)    chips.push({ key: 'query', label: `Search: "${query}"`,            clear: () => setQuery('')    });
        if (chips.length === 0) return null;
        return (
          <div className={styles.filterChips}>
            {chips.map((c) => (
              <span key={c.key} className={styles.filterChip}>
                {c.label}
                <button type="button" className={styles.filterChipClear} onClick={c.clear} aria-label={`Clear ${c.key} filter`}>
                  <XIcon size={11} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className={styles.filterChipsClearAll}
              onClick={() => {
                setPriorityFilter('All');
                setSiteFilter('');
                setDateFrom('');
                setDateTo('');
                setQuery('');
              }}
            >
              Clear all
            </button>
          </div>
        );
      })()}

      {/* Bulk bar */}
      {selectedCount > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedCount} query{selectedCount !== 1 ? 's' : ''} selected</span>
          {canEditQuery && (
            <button
              className={styles.bulkClose}
              onClick={() => setBulkClose(true)}
              {...ro.disabledProps('Bulk close queries')}
            >
              <CheckCircle size={13} /> Bulk Close
            </button>
          )}
          {/* Bulk Reassign removed — query ownership follows the subject. Use
              Data Capture → Transfer Ownership to move a subject (and its open
              queries) to a new PI. */}
          {canEscalate && (
            <button
              className={styles.bulkExport}
              onClick={() => setBulkEscalate(true)}
              {...ro.disabledProps('Bulk escalate queries')}
              title="Escalate selected queries"
            >
              <AlertTriangle size={13} /> Bulk Escalate
            </button>
          )}
          <button className={styles.bulkExport} onClick={handleExport}>
            <Download size={13} /> Export Selected
          </button>
          <button className={styles.bulkClear} onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* Count */}
      <span className={styles.count}>
        {filtered.length} quer{filtered.length !== 1 ? 'ies' : 'y'}
        {queries.length !== filtered.length && ` (of ${queries.length})`}
      </span>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCheck}>
                <input
                  type="checkbox"
                  checked={allActiveSelected}
                  onChange={toggleAll}
                  disabled={activeOnPage.length === 0}
                />
              </th>
              {COLUMNS.map(({ key, label }) => (
                <th key={key} className={styles.th} onClick={() => handleSort(key)}>
                  <span className={styles.thInner}>
                    {label} <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
              <th className={styles.thActions}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className={styles.row}>
                {/* checkbox + every visible column (Actions cell left empty) */}
                {Array.from({ length: COLUMNS.length + 1 }, (__, j) => (
                  <td key={j} className={styles.td}>
                    <div className={styles.skeleton} style={{ width: j === 5 ? '80%' : '55%' }} />
                  </td>
                ))}
              </tr>
            ))}

            {!loading && pageData.length === 0 && (
              <tr>
                {/* checkbox + visible columns + Actions */}
                <td colSpan={COLUMNS.length + 2} className={styles.emptyCell}>
                  <div className={styles.empty}>
                    <MessageSquareWarning size={40} strokeWidth={1.25} className={styles.emptyIcon} />
                    <p className={styles.emptyTitle}>
                      {queries.length === 0 ? 'No queries found for this study.' : 'No queries match your filters.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && pageData.map((q) => {
              const pm = PRIORITY_META[q.priority] ?? PRIORITY_META.Medium;
              const display = toDisplayStatus(q.status);
              const sm = STATUS_META[display] ?? STATUS_META.Raised;
              // Lifecycle: open/answered (active) → Resolved (reopenable +
              // closable) → Closed (final). Close advances one step; Reopen is
              // offered on the two terminal states.
              const isResolved = display === 'Resolved';
              const isClosed   = display === 'Closed';
              const isActive   = !isResolved && !isClosed;
              const canCloseStep = isActive || isResolved; // Close shows until final
              const canReopenStep = isResolved || isClosed;
              const isOverdue  = q.slaRemaining < 0 && isActive;

              // Actioned By / Date track the latest action in the lifecycle.
              // Prefer resolved names (now resolved across site/sponsor/CRO),
              // falling back to the raw id only when no name is available.
              const actionedBy   = isResolved ? (q.resolvedByName || q.respondedByName || q.raisedByName || q.resolvedBy || q.respondedBy || q.raisedBy)
                                  : display === 'Answered' ? (q.respondedByName || q.raisedByName || q.respondedBy || q.raisedBy)
                                  : (q.raisedByName || q.raisedBy);
              const actionedDate = isResolved ? (q.resolvedDate || q.responseDate || q.raisedDate)
                                  : display === 'Answered' ? (q.responseDate || q.raisedDate)
                                  : q.raisedDate;

              // Site column shows both the code and the name. Either may be
              // missing depending on what the backend joined in — fall back to
              // siteId only as a last resort.
              const siteCode = q.siteCode || '';
              const siteName = q.siteName || '';
              // Subjects are identified by initials in the UI; the raw
              // subject id is internal. Show initials, falling back to the id
              // only when initials were never captured.
              const subjectNumber = q.subjectNumber || '—';
              const subjectLabel = q.subjectInitials || q.subjectId || '—';
              const sequenceLabel = sequenceById.get(q.id) ?? '—';

              return (
                <tr
                  key={q.id}
                  className={`${styles.row} ${isOverdue ? styles.rowOverdue : ''} ${selected.has(q.id) ? styles.rowSelected : ''}`}
                >
                  <td className={styles.tdCheck}>
                    {isActive && (
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleRow(q.id)} />
                    )}
                  </td>
                  <td className={styles.td}>
                    {/* Sequential per-study Query ID — backed by sequenceById.
                        Hover the cell to see the underlying random id for
                        support/debugging. */}
                    <code className={styles.qid} title={q.id}>{sequenceLabel}</code>
                  </td>
                  <td className={styles.td} title={[siteCode, siteName].filter(Boolean).join(' — ')}>
                    {siteCode || siteName ? (
                      <>
                        <span className={styles.siteCode}>{siteCode || '—'}</span>
                        {siteName && (
                          <span className={styles.siteName}>{siteName}</span>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  {/* Subject Details — Subject ID over Subject Name/Initials,
                      rendered with the same stacked style as the Site cell and
                      the Verification Manager (sans-serif primary + grey
                      secondary). */}
                  <td className={styles.td} title={[subjectNumber, subjectLabel].filter((v) => v && v !== '—').join(' · ')}>
                    <span className={styles.siteCode}>{subjectNumber}</span>
                    {subjectLabel && subjectLabel !== '—' && (
                      <span className={styles.siteName}>{subjectLabel}</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {/* Block in grey, Page in black per spec. Either may be
                        empty depending on the form schema — show only what
                        the row carries. */}
                    {(q.blockName || q.pageName) ? (
                      <>
                        {q.blockName && <span className={styles.blockName}>{q.blockName}</span>}
                        {q.blockName && q.pageName && <span className={styles.blockPageSep}> / </span>}
                        {q.pageName && <span className={styles.pageName}>{q.pageName}</span>}
                      </>
                    ) : (q.formName || '—')}
                  </td>
                  <td className={styles.td}><span className={styles.fieldName}>{q.fieldLabel || q.fieldName || '—'}</span></td>
                  <td className={styles.td}>
                    <span
                      className={styles.statusBadge}
                      style={{ color: sm.color, background: sm.bg, borderColor: sm.accent }}
                    >
                      {display}
                    </span>
                    {/* Escalation is shown as a secondary badge so it's clear at
                        a glance — and to whom — without changing the assignee. */}
                    {q.isEscalated && (
                      <span
                        className={styles.statusBadge}
                        style={{ color: '#b45309', background: '#fef3c7', borderColor: '#fde68a', marginTop: 4, display: 'inline-block' }}
                        title={q.escalatedToName ? `Escalated to ${q.escalatedToName}` : 'Escalated'}
                      >
                        ⬆ Escalated{q.escalatedToName ? ` → ${q.escalatedToName}` : ''}
                      </span>
                    )}
                    {/* Reassignment: current owner is assignedTo; this notes the
                        previous owner so the handover is visible at a glance. */}
                    {q.isReassigned && q.previousAssignedToName && (
                      <span
                        className={styles.statusBadge}
                        style={{ color: '#475569', background: '#f1f5f9', borderColor: '#cbd5e1', marginTop: 4, display: 'inline-block' }}
                        title={`Reassigned from ${q.previousAssignedToName}${q.assignedToName ? ` to ${q.assignedToName}` : ''}`}
                      >
                        ↪ Reassigned · was {q.previousAssignedToName}
                      </span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.priorityBadge} style={{ color: pm.color, background: pm.bg }}>
                      <span className={styles.priorityDot} style={{ background: pm.dot }} />
                      {q.priority}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={isOverdue ? styles.overdueText : styles.daysText}>
                      {fmtAging(q.daysOpen)}
                    </span>
                  </td>
                  <td className={styles.td}>{actionedBy || '—'}</td>
                  <td className={styles.td}>{fmtDate(actionedDate)}</td>
                  {/* Resolution column hidden for now — re-enable with the COLUMNS entry above.
                  <td className={styles.td} title={q.resolutionComment || ''}>
                    {q.resolutionComment
                      ? (q.resolutionComment.length > 40 ? `${q.resolutionComment.slice(0, 40)}…` : q.resolutionComment)
                      : '—'}
                  </td>
                  */}
                  <td className={styles.tdActions}>
                    <button className={styles.actionBtn} title="View Details" onClick={() => setDetails(q)}>
                      <Eye size={12} />
                    </button>
                    <button className={styles.actionBtn} title="Open Study Form" onClick={() => openStudyForm(q)}>
                      <FileText size={12} />
                    </button>
                    {isActive && canEditQuery && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionRespond}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Respond'}
                        onClick={() => setRespond(q)}
                        {...ro.disabledProps('Respond to query')}
                      >
                        <MessageSquare size={12} />
                      </button>
                    )}
                    {/* Close advances the lifecycle: open/answered → Resolved,
                        then Resolved → Closed. Shown until the query is Closed. */}
                    {canCloseStep && (canCloseQuery || canEditQuery) && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionClose}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : (isResolved ? 'Close (finalise)' : 'Close')}
                        onClick={() => setClose(q)}
                        {...ro.disabledProps('Close query')}
                      >
                        <CheckCircle  size={12} />
                      </button>
                    )}
                    {isActive && canEscalate && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionEscalate}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Escalate'}
                        onClick={() => setEscalate(q)}
                        {...ro.disabledProps('Escalate query')}
                      >
                        <AlertTriangle size={12} />
                      </button>
                    )}
                    {/* Transfer the SUBJECT'S ownership — moves the subject + ALL
                        its open queries to the new PI. This is the only handoff for
                        a query: standalone query reassignment was removed (escalate
                        covers handler-to-handler, transfer covers owner-to-owner). */}
                    {isActive && canTransferOwnership && q.subjectId && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionReassign}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Transfer subject ownership'}
                        onClick={() => setTransferQuery(q)}
                        {...ro.disabledProps('Transfer subject ownership')}
                      >
                        <ArrowRightLeft size={12} />
                      </button>
                    )}
                    {canReopenStep && canEditQuery && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionReopen}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Reopen'}
                        onClick={() => setReopen(q)}
                        {...ro.disabledProps('Reopen query')}
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > pageSize && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
          <div className={styles.pageButtons}>
            <button className={styles.pageBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className={styles.pageEllipsis}>…</span>}
                  <button
                    className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                </span>
              ))}
            <button className={styles.pageBtn} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
          <select className={styles.pageSizeSelect} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {detailsTarget && (
        <QueryDetailsModal
          query={detailsTarget}
          displayId={sequenceById.get(detailsTarget.id)}
          onClose={() => setDetails(null)}
          onAction={handleDetailAction}
        />
      )}

      {respondTarget && (
        <RespondModal
          query={respondTarget}
          onConfirm={handleRespond}
          onClose={() => setRespond(null)}
        />
      )}

      {closeTarget && (
        <CloseReopenModal
          mode="close"
          query={closeTarget}
          onConfirm={handleClose}
          onClose={() => setClose(null)}
        />
      )}

      {reopenTarget && (
        <CloseReopenModal
          mode="reopen"
          query={reopenTarget}
          onConfirm={handleReopen}
          onClose={() => setReopen(null)}
        />
      )}

      {escalateTarget && (
        <EscalateModal
          studyId={studyId}
          query={escalateTarget}
          onConfirm={handleEscalate}
          onClose={() => setEscalate(null)}
        />
      )}

      {bulkCloseOpen && (
        <CloseReopenModal
          mode="close"
          query={null}
          onConfirm={handleBulkClose}
          onClose={() => setBulkClose(false)}
        />
      )}

      {bulkEscalateOpen && (
        <EscalateModal
          query={null}
          title={`Escalate ${selectedCount} quer${selectedCount !== 1 ? 'ies' : 'y'}`}
          onConfirm={handleBulkEscalate}
          onClose={() => setBulkEscalate(false)}
        />
      )}

      {transferQuery && (
        <TransferOwnershipModal
          subject={{
            id:              transferQuery.subjectId,
            subjectInitials: transferQuery.subjectInitials,
            subjectCode:     transferQuery.subjectNumber,
            siteId:          transferQuery.siteId,
            // Queries follow their subject's owner, so the current assignee is a
            // best-effort stand-in for the responsible PI (the backend remains
            // the source of truth + returns the real previous owner).
            ownerId:         transferQuery.assignedTo,
            ownerName:       transferQuery.assignedToName,
          }}
          onConfirm={handleTransferOwnership}
          onClose={() => setTransferQuery(null)}
        />
      )}
    </div>
  );
}

