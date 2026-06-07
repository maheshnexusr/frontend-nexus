import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectCurrentUser } from '@/features/auth/authSlice';
import {
  Eye, MessageSquare, CheckCircle, FileText, Filter, Search, X as XIcon,
  RefreshCw, RotateCcw, ChevronUp, ChevronDown, ChevronsUpDown,
  MessageSquareWarning, AlertTriangle, Clock, ArrowRightLeft,
} from 'lucide-react';
import { siteQueryClient } from '@/features/site/api/siteQueryClient';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import TransferOwnershipModal from '@/components/subject/TransferOwnershipModal';
import { addToast }         from '@/app/notificationSlice';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate }       from '@/utils/formatDate';
import PlatformDatePicker   from '@/components/form/PlatformDatePicker';
import RespondModal         from '@/features/sponsor/components/query/RespondModal';
import CloseReopenModal     from '@/features/sponsor/components/query/CloseReopenModal';
import QueryDetailsModal    from '@/features/sponsor/components/query/QueryDetailsModal';
import EscalateModal        from '@/features/sponsor/components/query/EscalateModal';
import SlaSettingsModal     from '@/features/sponsor/components/sla/SlaSettingsModal';
import { usePermissions }   from '@/features/auth/usePermissions';
import styles from '@/features/sponsor/pages/QueriesPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ['All', 'Raised', 'Answered', 'Resolved', 'Closed', 'Overdue'];
const PRIORITY_OPTIONS = ['All', 'Critical', 'High', 'Medium', 'Low'];

const PRIORITY_META = {
  Critical: { color: '#991b1b', bg: '#fee2e2', dot: '#991b1b' },
  High:     { color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  Medium:   { color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  Low:      { color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
};

// Status palette per Query Manager requirements:
//   Raised   #F59E0B  Answered #2563EB  Resolved #16A34A
const STATUS_META = {
  Raised:       { color: '#92400e', bg: '#fef3c7', accent: '#F59E0B' },
  Answered:     { color: '#1d4ed8', bg: '#dbeafe', accent: '#2563EB' },
  Resolved:     { color: '#166534', bg: '#dcfce7', accent: '#16A34A' },
  Open:         { color: '#92400e', bg: '#fef3c7', accent: '#F59E0B' },
  'In Progress':{ color: '#1d4ed8', bg: '#dbeafe', accent: '#2563EB' },
  Closed:       { color: '#475569', bg: '#f1f5f9', accent: '#94A3B8' }, // Gray — distinct from Resolved
  Overdue:      { color: '#dc2626', bg: '#fef2f2', accent: '#dc2626' },
};

// Closed is its OWN terminal status (the Close Query popup now sets 'Closed',
// not 'Resolved') — no longer folded into Resolved, so it matches the sponsor
// Query Manager. Only Open/In Progress legacy aliases are remapped.
const STATUS_DISPLAY = { Open: 'Raised', 'In Progress': 'Answered' };
const toDisplayStatus = (st) => STATUS_DISPLAY[st] ?? st ?? 'Raised';
// Terminal statuses — no further action (respond/close) is offered.
const isTerminalStatus = (display) => display === 'Resolved' || display === 'Closed';

const fmtDate = (iso) => formatDate(iso) || '—';

function fmtAging(days) {
  if (days == null || Number.isNaN(days)) return '—';
  if (days === 0) return 'Today';
  if (days < 7)  return `${days}d`;
  const wk = Math.floor(days / 7);
  const rem = days % 7;
  return rem ? `${wk}w ${rem}d` : `${wk}w`;
}

function SortIcon({ col, sortKey, sortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />;
  if (sortDir === 'asc')  return <ChevronUp    size={12} />;
  return                          <ChevronDown  size={12} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SiteQueriesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Permission-driven action visibility. The backend gates each route:
  //   /queries/:id/answer → query_manager.edit
  //   /queries/:id/close  → data_capture.close_query  (migration 026 split)
  // Without these checks the buttons would render and 403 on click.
  const { has } = usePermissions();
  // Granular QM actions — the discrete leaf is AUTHORITATIVE (no `|| edit`
  // fallback) so the role editor's toggles actually control button visibility.
  // A site role must be explicitly granted respond / escalate / reopen.
  const canRespond  = has('query_manager', 'respond');
  const canClose    = has('data_capture', 'close_query');
  const canEscalate = has('query_manager', 'escalate');
  const canReopen   = has('query_manager', 'reopen');
  // SLA Settings: panel is visible to anyone with query_manager.view; edit is
  // separately gated server-side AND client-side by `sla_settings`.
  const canEditSla  = has('query_manager', 'sla_settings');
  // Direct query reassignment is retired — instead the row offers a "Transfer
  // Subject Ownership" action (moves the subject + ALL its open queries to the
  // new PI). Gated by the subject-edit leaf, same as the Data Capture list.
  const canTransferOwnership = has('data_capture', 'subject_edit');
  const [slaOpen, setSlaOpen] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  // `queries` drives the table — refetched whenever a server-side filter
  // (status / priority / date) changes.
  // `allQueries` drives the stats cards at the top — fetched ONCE per
  // page-mount (and after every mutation) with no filters so the totals
  // never shift when the user changes the table filter.
  const [queries,    setQueries]    = useState([]);
  const [allQueries, setAllQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  // Study's first form id — used by the "Open Study Form" action when a query
  // row doesn't carry its own formId (single-form studies).
  const [studyFormId, setStudyFormId] = useState(null);

  // ── Modal targets — Respond / Close / Details. Resolved-only rows hide
  //    Respond + Close; Details is visible for every status (read-only view).
  const [respondTarget,  setRespond]  = useState(null);
  const [closeTarget,    setClose]    = useState(null);
  const [detailsTarget,  setDetails]  = useState(null);
  const [escalateTarget, setEscalate] = useState(null);
  const [reopenTarget,   setReopen]   = useState(null);
  const [transferQuery,  setTransferQuery] = useState(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [statusFilter,   setStatusFilter]   = useState('Raised');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [query,          setQuery]          = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [onlyMine,       setOnlyMine]       = useState(false);
  const currentUser                         = useSelector(selectCurrentUser);
  const meAssigneeKeys                      = useMemo(() => new Set(
    [currentUser?.id, currentUser?.email, currentUser?.username, currentUser?.fullName]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase()),
  ), [currentUser]);

  // ── Pagination & sort ─────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey,  setSortKey]  = useState('raisedDate');
  const [sortDir,  setSortDir]  = useState('desc');

  // ── Load ──────────────────────────────────────────────────────────────────
  // Filtered fetch — drives the table.
  const load = useCallback(() => {
    setLoading(true);
    siteQueryClient.list({
      status:   statusFilter,
      priority: priorityFilter,
      dateFrom,
      dateTo,
    })
      .then((qs) => setQueries(qs))
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load queries.' })))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, dateFrom, dateTo]);

  // Unfiltered fetch — drives the stats cards. Re-run after every mutation
  // (respond / close / escalate) via `loadAll` so the totals stay current.
  const loadAll = useCallback(() => {
    siteQueryClient.list({})
      .then((qs) => setAllQueries(qs))
      .catch(() => { /* leave existing stats — silent */ });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { setPage(1); }, [statusFilter, priorityFilter, query, dateFrom, dateTo, onlyMine]);

  // Resolve the study's primary form id once, so the per-row "Open Study
  // Form" action works on rows whose payload doesn't include a formId.
  useEffect(() => {
    let cancelled = false;
    siteWorkspaceClient.listForms()
      .then((res) => {
        if (cancelled) return;
        const items = res?.items ?? res ?? [];
        if (items.length) setStudyFormId(items[0].formId ?? items[0].form_id ?? null);
      })
      .catch(() => { /* leave null — the action falls back to a toast */ });
    return () => { cancelled = true; };
  }, []);

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
    navigate(`/site/capture/form?formId=${formId}&subjectId=${q.subjectId}${pageQS}`);
  };

  // ── Local filter & sort ───────────────────────────────────────────────────
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

  // Per-site sequential Query ID (1, 2, 3 …) — computed from the unfiltered
  // result set so the same query keeps the same number regardless of filter.
  // Sorted ASC by raised date so #1 is always the oldest.
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

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  // Always counts the FULL set of queries on this site, never the filtered
  // table view. So changing status/priority/date filters never shifts the
  // numbers in the cards above.
  const stats = useMemo(() => {
    const byDisplay = (label) => allQueries.filter((q) => toDisplayStatus(q.status) === label).length;
    return {
      total:    allQueries.length,
      raised:   byDisplay('Raised'),
      answered: byDisplay('Answered'),
      resolved: byDisplay('Resolved'),
      closed:   byDisplay('Closed'),
      overdue:  allQueries.filter((q) => q.status === 'Overdue' || (q.slaRemaining < 0 && !isTerminalStatus(toDisplayStatus(q.status)))).length,
    };
  }, [allQueries]);

  // ── Modal-driven Respond + Close (mirrors the sponsor QueryManager page). ──
  const handleRespond = async (data) => {
    try {
      await siteQueryClient.respond(respondTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Response sent.' }));
      setRespond(null);
      load();
      loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to send response.' }));
      throw new Error();
    }
  };

  const handleClose = async (data) => {
    try {
      await siteQueryClient.close(closeTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query closed.' }));
      setClose(null);
      load();
      loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to close query.' }));
      throw new Error();
    }
  };

  const handleEscalate = async (data) => {
    try {
      await siteQueryClient.escalate(escalateTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query escalated.' }));
      setEscalate(null);
      load();
      loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to escalate query.' }));
      throw new Error();
    }
  };

  // Transfer the SUBJECT'S ownership from a query row — moves the subject + ALL
  // its open queries (incl. this one) to the new PI, with an audit trail. The
  // sanctioned alternative to query-level reassignment.
  const handleTransferOwnership = async ({ newOwnerId, reason }) => {
    const q = transferQuery;
    if (!q?.subjectId) return;
    try {
      const res = await siteWorkspaceClient.transferSubjectOwnership(q.subjectId, {
        new_owner_id: newOwnerId,
        reason,
      });
      const moved = res?.queriesMoved ?? res?.queries_moved;
      dispatch(addToast({
        type: 'success',
        message: `Subject ownership transferred to ${res?.newOwnerName ?? res?.new_owner_name ?? 'the new PI'}.`
          + (moved ? ` ${moved} open quer${moved === 1 ? 'y' : 'ies'} moved.` : ''),
      }));
      setTransferQuery(null);
      load();
      loadAll();
    } catch (err) {
      dispatch(addToast({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to transfer ownership.',
      }));
    }
  };

  const handleReopen = async (data) => {
    try {
      await siteQueryClient.reopen(reopenTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query reopened.' }));
      setReopen(null);
      load();
      loadAll();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to reopen query.' }));
      throw new Error();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // Spec'd grid columns — paired fields share one cell (stacked vertically).
  const COLUMNS = [
    { key: 'id',                label: 'Query ID'                  },
    { key: 'siteId',            label: 'Site Details'              },
    { key: 'subjectId',         label: 'Subject Details'           },
    { key: 'pageName',          label: 'CRF Block / Page'          },
    { key: 'fieldName',         label: 'Field / Query Description' },
    { key: 'status',            label: 'Status / Priority'         },
    { key: 'daysOpen',          label: 'Aging'                     },
    { key: 'raisedBy',          label: 'Actioned By'               },
    { key: 'raisedDate',        label: 'Actioned Date'             },
    // Resolution column hidden for now (keep the cell below in sync if re-enabled).
    // { key: 'resolutionComment', label: 'Resolution'                },
  ];

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Query Manager</h1>
          <p className={styles.sub}>Review and respond to data queries raised on your site.</p>
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
          <button className={styles.btnRefresh} onClick={() => { load(); loadAll(); }} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Counts banner — uses shared Card primitive */}
      <div className={styles.statsBar}>
        {[
          { label: 'Total Queries', value: stats.total,    color: '#0f172a', bg: '#f1f5f9' },
          { label: 'Raised',        value: stats.raised,   color: '#F59E0B', bg: '#fef3c7' },
          { label: 'Answered',      value: stats.answered, color: '#2563EB', bg: '#dbeafe' },
          { label: 'Resolved',      value: stats.resolved, color: '#16A34A', bg: '#dcfce7' },
          { label: 'Closed',        value: stats.closed,   color: '#475569', bg: '#f1f5f9' },
          { label: 'Overdue',       value: stats.overdue,  color: '#dc2626', bg: '#fee2e2' },
        ].map(({ label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between gap-3 p-5 pt-5">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-2xl font-extrabold leading-none" style={{ color }}>{value}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
              </div>
              <span
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full text-base font-extrabold"
                style={{ background: bg, color }}
              >
                {label.charAt(0)}
              </span>
            </CardContent>
          </Card>
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
              title="Show every query for this site"
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

          <div className={styles.filterWrap}>
            <Filter size={13} className={styles.filterIcon} />
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className={styles.filterWrap}>
            {PRIORITY_OPTIONS.map((p) => {
              const active = priorityFilter === p;
              const meta   = PRIORITY_META[p];
              return (
                <button
                  key={p}
                  className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ''}`}
                  style={active && meta ? { background: meta.color, borderColor: meta.color, color: '#fff' } : {}}
                  onClick={() => setPriorityFilter(p)}
                >
                  {meta && <span className={styles.dot} style={{ background: meta.dot }} />}
                  {p}
                </button>
              );
            })}
          </div>

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

      <span className={styles.count}>
        {filtered.length} quer{filtered.length !== 1 ? 'ies' : 'y'}
        {queries.length !== filtered.length && ` (of ${queries.length})`}
      </span>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
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
                {Array.from({ length: COLUMNS.length + 1 }, (__, j) => (
                  <td key={j} className={styles.td}>
                    <div className={styles.skeleton} style={{ width: j === 5 ? '80%' : '55%' }} />
                  </td>
                ))}
              </tr>
            ))}

            {!loading && pageData.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className={styles.emptyCell}>
                  <div className={styles.empty}>
                    <MessageSquareWarning size={40} strokeWidth={1.25} className={styles.emptyIcon} />
                    <p className={styles.emptyTitle}>
                      {queries.length === 0 ? 'No queries found for your site.' : 'No queries match your filters.'}
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
              // closable) → Closed (final). Close advances one step.
              const isTerminal = isTerminalStatus(display);      // Resolved || Closed
              const isResolved = isTerminal;                     // used for "actioned by"
              const isActive   = !isTerminal;
              const canCloseStep  = isActive || display === 'Resolved'; // Close until final
              const canReopenStep = isTerminal;                   // Resolved + Closed
              const isOverdue  = q.slaRemaining < 0 && isActive;

              // Prefer the resolved full name from the backend join. Falls
              // back to the raw id only when the join missed (e.g. user was
              // deleted) so the cell never shows blank.
              const actionedBy   = isResolved
                ? (q.resolvedByName || q.respondedByName || q.raisedByName || q.resolvedBy || q.respondedBy || q.raisedBy)
                : display === 'Answered'
                  ? (q.respondedByName || q.raisedByName || q.respondedBy || q.raisedBy)
                  : (q.raisedByName || q.raisedBy);
              const actionedDate = isResolved ? (q.resolvedDate || q.responseDate || q.raisedDate)
                                  : display === 'Answered' ? (q.responseDate || q.raisedDate)
                                  : q.raisedDate;

              const sequenceLabel = sequenceById.get(q.id) ?? '—';

              return (
                <tr
                  key={q.id}
                  className={`${styles.row} ${isOverdue ? styles.rowOverdue : ''}`}
                  title={q.queryText ? `${q.fieldName || ''}: ${q.queryText}` : ''}
                >
                  {/* Sequential per-site Query ID (1, 2, 3 …). Raw id stays
                      on the cell's title for support/debugging. */}
                  <td className={styles.td}>
                    <code className={styles.qid} title={q.id}>{sequenceLabel}</code>
                  </td>

                  {/* Site — code (primary) + name (secondary). Both come from
                      the tenant JOIN; no raw site_id surfaces in the UI. */}
                  <td className={styles.td}>
                    <div className={styles.stack}>
                      <span className={styles.stackPrimary}>{q.siteCode || '—'}</span>
                      {q.siteName && <span className={styles.stackSecondary}>{q.siteName}</span>}
                    </div>
                  </td>

                  {/* Subject — number (SUB-…) on top, initials below. Subject id
                      is internal; coordinators identify subjects by number/initials. */}
                  <td className={styles.td}>
                    <div className={styles.subjectStack}>
                      <span className={styles.subjectNum}>{q.subjectNumber || '—'}</span>
                      <span className={styles.subjectInit}>{q.subjectInitials || q.subjectId || '—'}</span>
                    </div>
                  </td>

                  {/* Block + Page (Block grey, Page black per Query Manager spec). */}
                  <td className={styles.td}>
                    {(q.blockName || q.pageName) ? (
                      <>
                        {q.blockName && <span className={styles.blockName}>{q.blockName}</span>}
                        {q.blockName && q.pageName && <span className={styles.blockPageSep}> / </span>}
                        {q.pageName && <span className={styles.pageName}>{q.pageName}</span>}
                      </>
                    ) : (q.formName || '—')}
                  </td>

                  {/* Field Name + Query Description */}
                  <td className={styles.td} title={q.queryText || ''}>
                    <div className={styles.stack} style={{ maxWidth: 280 }}>
                      <span className={`${styles.stackPrimary} ${styles.fieldName}`}>{q.fieldLabel || q.fieldName || '—'}</span>
                      {q.queryText && (
                        <span className={styles.stackSecondary} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {q.queryText}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Query Status + Priority */}
                  <td className={styles.td}>
                    <div className={styles.stack} style={{ alignItems: 'flex-start', gap: 4 }}>
                      <span
                        className={styles.statusBadge}
                        style={{ color: '#fff', background: sm.accent, borderColor: sm.accent }}
                      >
                        {display}
                      </span>
                      <span className={styles.priorityBadge} style={{ color: pm.color, background: pm.bg }}>
                        <span className={styles.priorityDot} style={{ background: pm.dot }} />
                        {q.priority}
                      </span>
                    </div>
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
                    {isActive && canRespond && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionRespond}`}
                        title="Respond"
                        onClick={() => setRespond(q)}
                      >
                        <MessageSquare size={12} />
                      </button>
                    )}
                    {canCloseStep && canClose && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionClose}`}
                        title={display === 'Resolved' ? 'Close (finalise)' : 'Close'}
                        onClick={() => setClose(q)}
                      >
                        <CheckCircle size={12} />
                      </button>
                    )}
                    {isActive && canEscalate && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionEscalate}`}
                        title="Escalate"
                        onClick={() => setEscalate(q)}
                      >
                        <AlertTriangle size={12} />
                      </button>
                    )}
                    {isActive && canTransferOwnership && q.subjectId && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionReassign}`}
                        title="Transfer subject ownership"
                        onClick={() => setTransferQuery(q)}
                      >
                        <ArrowRightLeft size={12} />
                      </button>
                    )}
                    {canReopenStep && canReopen && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionReopen}`}
                        title="Reopen"
                        onClick={() => setReopen(q)}
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

      {/* Reuse the sponsor modals — they're presentational and call back into
          the parent for the API hit, so the site client wiring works fine. */}
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
      {detailsTarget && (
        <QueryDetailsModal
          query={detailsTarget}
          client={siteQueryClient}
          displayId={sequenceById.get(detailsTarget.id)}
          onClose={() => setDetails(null)}
          onAction={(action, q) => {
            setDetails(null);
            if (action === 'respond'  && canRespond)  setRespond(q);
            else if (action === 'close'    && canClose)    setClose(q);
            else if (action === 'escalate' && canEscalate) setEscalate(q);
            else if (action === 'reopen'   && canReopen)   setReopen(q);
          }}
        />
      )}
      {escalateTarget && (
        <EscalateModal
          query={escalateTarget}
          onConfirm={handleEscalate}
          onClose={() => setEscalate(null)}
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
      {transferQuery && (
        <TransferOwnershipModal
          subject={{
            id:              transferQuery.subjectId,
            subjectInitials: transferQuery.subjectInitials,
            subjectCode:     transferQuery.subjectNumber,
            siteId:          transferQuery.siteId,
            ownerId:         transferQuery.assignedTo,
            ownerName:       transferQuery.assignedToName,
          }}
          onConfirm={handleTransferOwnership}
          onClose={() => setTransferQuery(null)}
        />
      )}
      <SlaSettingsModal
        open={slaOpen}
        kind="query_manager"
        canEdit={canEditSla}
        onClose={() => setSlaOpen(false)}
      />
    </div>
  );
}
