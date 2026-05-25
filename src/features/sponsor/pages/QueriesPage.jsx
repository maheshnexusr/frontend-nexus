import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Eye, MessageSquare, CheckCircle, AlertTriangle,
  RotateCcw, Download, Filter, Search, X as XIcon,
  RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown,
  MessageSquareWarning, FileText, Clock,
} from 'lucide-react';
import { sponsorQueryClient }   from '@/features/sponsor/api/sponsorQueryClient';
import sponsorAxiosClient       from '@/api/sponsorAxiosClient';
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
import { usePermissions }       from '@/features/auth/usePermissions';
import styles from './QueriesPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

// Status quick-filter options — the new spec palette. `All` shows everything;
// `Overdue` is computed (slaRemaining < 0 OR status === 'Overdue').
const STATUS_OPTIONS   = ['All', 'Open', 'In Progress', 'Resolved', 'Closed', 'Overdue'];
const PRIORITY_OPTIONS = ['All', 'High', 'Medium', 'Low'];

const PRIORITY_META = {
  High:   { color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  Medium: { color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  Low:    { color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
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
  const [slaOpen,  setSlaOpen]  = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  const [queries,   setQueries]   = useState([]);
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
  const [bulkCloseOpen,    setBulkClose]    = useState(false);
  // Phase 2 — additional bulk actions
  const [bulkReassignOpen, setBulkReassign] = useState(false);
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

  useEffect(() => { load(); }, [load]);

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
    navigate(`/sponsor/${studyId}/capture/form?formId=${formId}&subjectId=${q.subjectId}`);
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
      rows = rows.filter((q) => meAssigneeKeys.has(String(q.assignedTo ?? '').toLowerCase()));
    }
    rows = rows.filter((q) => {
      if (!query) return true;
      const s = query.toLowerCase();
      return [q.id, q.queryText, q.fieldName, q.subjectId, q.formName, q.raisedBy]
        .some((v) => (v ?? '').toLowerCase().includes(s));
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (sortKey === 'priority') {
          const ORDER = { High: 0, Medium: 1, Low: 2 };
          av = ORDER[av] ?? 1; bv = ORDER[bv] ?? 1;
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
  const stats = useMemo(() => {
    const byDisplay = (label) => queries.filter((q) => toDisplayStatus(q.status) === label).length;
    return {
      total:      queries.length,
      open:       byDisplay('Open'),
      inProgress: byDisplay('In Progress'),
      resolved:   byDisplay('Resolved'),
      closed:     byDisplay('Closed'),
      overdue:    queries.filter((q) => q.status === 'Overdue'
        || (q.slaRemaining < 0 && toDisplayStatus(q.status) !== 'Resolved' && toDisplayStatus(q.status) !== 'Closed')).length,
    };
  }, [queries]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const activeOnPage = pageData.filter((q) => toDisplayStatus(q.status) !== 'Resolved');
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
      setRespond(null); load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to respond to query. Please try again.' }));
      throw new Error();
    }
  };

  const handleClose = async (data) => {
    try {
      await sponsorQueryClient.close(studyId, closeTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query closed successfully.' }));
      setClose(null); load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to close query. Please try again.' }));
      throw new Error();
    }
  };

  const handleReopen = async (data) => {
    try {
      await sponsorQueryClient.reopen(studyId, reopenTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query reopened successfully.' }));
      setReopen(null); load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to reopen query. Please try again.' }));
      throw new Error();
    }
  };

  const handleEscalate = async (data) => {
    try {
      await sponsorQueryClient.escalate(studyId, escalateTarget.id, data);
      dispatch(addToast({ type: 'success', message: 'Query escalated successfully.' }));
      setEscalate(null); load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to escalate query. Please try again.' }));
      throw new Error();
    }
  };

  const handleBulkClose = async (data) => {
    try {
      const count = await sponsorQueryClient.bulkClose(studyId, [...selected], data);
      dispatch(addToast({ type: 'success', message: `Bulk action completed successfully for ${count} queries.` }));
      setBulkClose(false); load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to close queries. Please try again.' }));
      throw new Error();
    }
  };

  // Phase 2 — Bulk Reassign / Bulk Escalate.
  // Each loops over selected IDs and hits the per-query endpoint (no
  // dedicated bulk API yet — falls back gracefully and is replaced with a
  // single batched endpoint when the backend ships).
  const handleBulkReassign = async (data) => {
    const ids = [...selected];
    let ok = 0;
    for (const id of ids) {
      try {
        await sponsorQueryClient.reassign?.(studyId, id, data)
          ?? await sponsorQueryClient.respond(studyId, id, { responseText: '', assignedTo: data.assignedTo });
        ok += 1;
      } catch { /* keep going */ }
    }
    if (ok > 0) {
      dispatch(addToast({ type: 'success', message: `${ok} of ${ids.length} queries reassigned to ${data.assignedTo}.` }));
      setBulkReassign(false);
      setSelected(new Set());
      load();
    } else {
      dispatch(addToast({ type: 'error', message: 'Failed to reassign queries.' }));
    }
  };

  const handleBulkEscalate = async (data) => {
    const ids = [...selected];
    let ok = 0;
    for (const id of ids) {
      try {
        await sponsorQueryClient.escalate(studyId, id, data);
        ok += 1;
      } catch { /* keep going */ }
    }
    if (ok > 0) {
      dispatch(addToast({ type: 'success', message: `${ok} of ${ids.length} queries escalated.` }));
      setBulkEscalate(false);
      setSelected(new Set());
      load();
    } else {
      dispatch(addToast({ type: 'error', message: 'Failed to escalate queries.' }));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await sponsorQueryClient.exportCSV(studyId, { status: statusFilter, priority: priorityFilter, siteCode: siteFilter });
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
    { key: 'siteId',            label: 'Site'             },
    { key: 'subjectId',         label: 'Subject'          },
    { key: 'pageName',          label: 'Block / Page'     },
    { key: 'fieldName',         label: 'Field'            },
    { key: 'queryText',         label: 'Query Description'},
    { key: 'status',            label: 'Status'           },
    { key: 'priority',          label: 'Priority'         },
    { key: 'daysOpen',          label: 'Aging'            },
    { key: 'raisedBy',          label: 'Actioned By'      },
    { key: 'raisedDate',        label: 'Actioned Date'    },
    { key: 'resolutionComment', label: 'Resolution'       },
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
          <button
            className={styles.btnSecondary}
            onClick={() => setSlaOpen(true)}
            title={canEditSla ? 'Configure SLA' : 'View SLA settings'}
          >
            <Clock size={13} /> SLA Settings
          </button>
          <SnapshotButton leaf="query_manager" filename="queries" className={styles.btnSecondary} />
          <button className={styles.btnSecondary} onClick={handleExport} disabled={exporting}>
            <Download size={13} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button className={styles.btnRefresh} onClick={load} title="Refresh">
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

      {/* Counts banner — new spec palette. */}
      <div className={styles.statsBar}>
        {[
          { label: 'Total Queries', value: stats.total,      color: '#0f172a', bg: '#f1f5f9' },
          { label: 'Open',          value: stats.open,       color: '#92400e', bg: '#fef3c7' },
          { label: 'In Progress',   value: stats.inProgress, color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'Resolved',      value: stats.resolved,   color: '#166534', bg: '#dcfce7' },
          { label: 'Closed',        value: stats.closed,     color: '#475569', bg: '#f1f5f9' },
          { label: 'Overdue',       value: stats.overdue,    color: '#b91c1c', bg: '#fef2f2' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statText}>
              <span className={styles.statValue} style={{ color }}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
            <span
              className={styles.statBadge}
              style={{ background: bg, color }}
            >
              {label.charAt(0)}
            </span>
          </div>
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

          {/* Priority pills */}
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
          <button
            className={styles.bulkClose}
            onClick={() => setBulkClose(true)}
            {...ro.disabledProps('Bulk close queries')}
          >
            <CheckCircle size={13} /> Bulk Close
          </button>
          <button
            className={styles.bulkExport}
            onClick={() => setBulkReassign(true)}
            {...ro.disabledProps('Bulk reassign queries')}
            title="Reassign selected queries to a different user"
          >
            <MessageSquare size={13} /> Bulk Reassign
          </button>
          <button
            className={styles.bulkExport}
            onClick={() => setBulkEscalate(true)}
            {...ro.disabledProps('Bulk escalate queries')}
            title="Escalate selected queries"
          >
            <AlertTriangle size={13} /> Bulk Escalate
          </button>
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
                {Array.from({ length: 13 }, (__, j) => (
                  <td key={j} className={styles.td}>
                    <div className={styles.skeleton} style={{ width: j === 5 ? '80%' : '55%' }} />
                  </td>
                ))}
              </tr>
            ))}

            {!loading && pageData.length === 0 && (
              <tr>
                <td colSpan={14} className={styles.emptyCell}>
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
              const isResolved = display === 'Resolved';
              const isActive   = !isResolved;
              const isOverdue  = q.slaRemaining < 0 && isActive;

              // Actioned By / Date track the latest action in the lifecycle.
              const actionedBy   = isResolved ? (q.resolvedBy || q.respondedBy || q.raisedBy)
                                  : display === 'Answered' ? (q.respondedBy || q.raisedBy)
                                  : q.raisedBy;
              const actionedDate = isResolved ? (q.resolvedDate || q.responseDate || q.raisedDate)
                                  : display === 'Answered' ? (q.responseDate || q.raisedDate)
                                  : q.raisedDate;

              // Site column shows both the code and the name. Either may be
              // missing depending on what the backend joined in — fall back to
              // siteId only as a last resort.
              const siteCode = q.siteCode || '';
              const siteName = q.siteName || '';
              const subjectLabel = q.subjectId
                ? `${q.subjectId}${q.subjectInitials ? ` (${q.subjectInitials})` : ''}`
                : '—';
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
                  <td className={styles.td}><span className={styles.pill}>{subjectLabel}</span></td>
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
                  <td className={styles.td}><span className={styles.fieldName}>{q.fieldName || '—'}</span></td>
                  <td className={styles.td}>
                    <span className={styles.queryText} title={q.queryText}>
                      {q.queryText?.length > 50 ? `${q.queryText.slice(0, 50)}…` : (q.queryText || '—')}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span
                      className={styles.statusBadge}
                      style={{ color: '#fff', background: sm.accent, borderColor: sm.accent }}
                    >
                      {display}
                    </span>
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
                  <td className={styles.td} title={q.resolutionComment || ''}>
                    {q.resolutionComment
                      ? (q.resolutionComment.length > 40 ? `${q.resolutionComment.slice(0, 40)}…` : q.resolutionComment)
                      : '—'}
                  </td>
                  <td className={styles.tdActions}>
                    <button className={styles.actionBtn} title="View Details" onClick={() => setDetails(q)}>
                      <Eye size={12} />
                    </button>
                    <button className={styles.actionBtn} title="Open Study Form" onClick={() => openStudyForm(q)}>
                      <FileText size={12} />
                    </button>
                    {isActive && (
                      <>
                        <button
                          className={`${styles.actionBtn} ${styles.actionRespond}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Respond'}
                          onClick={() => setRespond(q)}
                          {...ro.disabledProps('Respond to query')}
                        >
                          <MessageSquare size={12} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionClose}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Close'}
                          onClick={() => setClose(q)}
                          {...ro.disabledProps('Close query')}
                        >
                          <CheckCircle  size={12} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionEscalate}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Escalate'}
                          onClick={() => setEscalate(q)}
                          {...ro.disabledProps('Escalate query')}
                        >
                          <AlertTriangle size={12} />
                        </button>
                      </>
                    )}
                    {!isActive && (
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
          studyId={studyId}
          query={detailsTarget}
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

      {bulkReassignOpen && (
        <BulkSimplePrompt
          title={`Reassign ${selectedCount} quer${selectedCount !== 1 ? 'ies' : 'y'}`}
          fieldLabel="Assign to (email or username) *"
          placeholder="user@org.com"
          submitLabel="Reassign"
          onSubmit={(value) => handleBulkReassign({ assignedTo: value })}
          onClose={() => setBulkReassign(false)}
        />
      )}

      {bulkEscalateOpen && (
        <BulkSimplePrompt
          title={`Escalate ${selectedCount} quer${selectedCount !== 1 ? 'ies' : 'y'}`}
          fieldLabel="Escalation reason *"
          placeholder="Reason for escalation…"
          submitLabel="Escalate"
          isTextarea
          onSubmit={(value) => handleBulkEscalate({ escalationReason: value })}
          onClose={() => setBulkEscalate(false)}
        />
      )}
    </div>
  );
}

/* ── Tiny inline prompt used by Bulk Reassign / Bulk Escalate ──────────── */
function BulkSimplePrompt({ title, fieldLabel, placeholder, submitLabel, isTextarea, onSubmit, onClose }) {
  const [value, setValue] = useState('');
  const Input = isTextarea ? 'textarea' : 'input';
  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: 16,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 18px 40px rgba(15,23,42,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a' }}>{title}</div>
        <div style={{ padding: '16px 18px' }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            {fieldLabel}
          </label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={isTextarea ? 3 : undefined}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: 10, fontSize: 13, color: '#0f172a',
              border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
              resize: isTextarea ? 'vertical' : 'none',
            }}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9', background: '#fafbff', borderRadius: '0 0 12px 12px' }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 14px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button
            type="button"
            onClick={() => onSubmit(value.trim())}
            disabled={!value.trim()}
            style={{
              padding: '6px 14px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600,
              cursor: value.trim() ? 'pointer' : 'not-allowed', opacity: value.trim() ? 1 : 0.55,
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
