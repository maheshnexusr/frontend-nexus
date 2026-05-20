import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import {
  Eye, MessageSquare, Download, Filter, Search, X as XIcon,
  RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown,
  MessageSquareWarning,
} from 'lucide-react';
import { siteQueryClient } from '@/features/site/api/siteQueryClient';
import { addToast }         from '@/app/notificationSlice';
import { Card, CardContent } from '@/components/ui/card';
import styles from '@/features/sponsor/pages/QueriesPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ['All', 'Raised', 'Answered', 'Resolved', 'Overdue'];
const PRIORITY_OPTIONS = ['All', 'High', 'Medium', 'Low'];

const PRIORITY_META = {
  High:   { color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  Medium: { color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  Low:    { color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
};

// Status palette per Query Manager requirements:
//   Raised   #F59E0B  Answered #2563EB  Resolved #16A34A
const STATUS_META = {
  Raised:       { color: '#92400e', bg: '#fef3c7', accent: '#F59E0B' },
  Answered:     { color: '#1d4ed8', bg: '#dbeafe', accent: '#2563EB' },
  Resolved:     { color: '#166534', bg: '#dcfce7', accent: '#16A34A' },
  Open:         { color: '#92400e', bg: '#fef3c7', accent: '#F59E0B' },
  'In Progress':{ color: '#1d4ed8', bg: '#dbeafe', accent: '#2563EB' },
  Closed:       { color: '#166534', bg: '#dcfce7', accent: '#16A34A' },
  Overdue:      { color: '#dc2626', bg: '#fef2f2', accent: '#dc2626' },
};

const STATUS_DISPLAY = { Open: 'Raised', 'In Progress': 'Answered', Closed: 'Resolved' };
const toDisplayStatus = (st) => STATUS_DISPLAY[st] ?? st ?? 'Raised';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

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

  // ── Data ─────────────────────────────────────────────────────────────────
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter, priorityFilter, query, dateFrom, dateTo, onlyMine]);

  // ── Local filter & sort ───────────────────────────────────────────────────
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

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byDisplay = (label) => queries.filter((q) => toDisplayStatus(q.status) === label).length;
    return {
      total:    queries.length,
      raised:   byDisplay('Raised'),
      answered: byDisplay('Answered'),
      resolved: byDisplay('Resolved'),
      overdue:  queries.filter((q) => q.status === 'Overdue' || (q.slaRemaining < 0 && toDisplayStatus(q.status) !== 'Resolved')).length,
    };
  }, [queries]);

  // ── Respond (inline placeholder — opens browser prompt for now) ──────────
  const handleRespond = async (q) => {
    const answer = window.prompt(`Respond to query ${q.id}:\n${q.queryText}`);
    if (answer == null || !answer.trim()) return;
    try {
      await siteQueryClient.respond(q.id, { responseText: answer.trim(), statusUpdate: 'Answered' });
      dispatch(addToast({ type: 'success', message: 'Response sent.' }));
      load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to send response.' }));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // Spec'd grid columns — paired fields share one cell (stacked vertically).
  const COLUMNS = [
    { key: 'id',                label: 'Query ID'                  },
    { key: 'siteId',            label: 'Site'                      },
    { key: 'subjectId',         label: 'Subject'                   },
    { key: 'pageName',          label: 'Block / Page'              },
    { key: 'fieldName',         label: 'Field / Query Description' },
    { key: 'status',            label: 'Status / Priority'         },
    { key: 'daysOpen',          label: 'Aging'                     },
    { key: 'raisedBy',          label: 'Actioned By'               },
    { key: 'raisedDate',        label: 'Actioned Date'             },
    { key: 'resolutionComment', label: 'Resolution'                },
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
          <button className={styles.btnRefresh} onClick={load} title="Refresh">
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
            <input type="date" className={styles.dateInput} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
            <span className={styles.dateSep}>–</span>
            <input type="date" className={styles.dateInput} value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   title="To"   />
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
              const isResolved = display === 'Resolved';
              const isActive   = !isResolved;
              const isOverdue  = q.slaRemaining < 0 && isActive;

              const actionedBy   = isResolved ? (q.resolvedBy || q.respondedBy || q.raisedBy)
                                  : display === 'Answered' ? (q.respondedBy || q.raisedBy)
                                  : q.raisedBy;
              const actionedDate = isResolved ? (q.resolvedDate || q.responseDate || q.raisedDate)
                                  : display === 'Answered' ? (q.responseDate || q.raisedDate)
                                  : q.raisedDate;

              return (
                <tr
                  key={q.id}
                  className={`${styles.row} ${isOverdue ? styles.rowOverdue : ''}`}
                  title={q.queryText ? `${q.fieldName || ''}: ${q.queryText}` : ''}
                >
                  <td className={styles.td}><code className={styles.qid}>{q.id}</code></td>

                  {/* Site ID + Site Name */}
                  <td className={styles.td}>
                    <div className={styles.stack}>
                      <span className={styles.stackPrimary}>{q.siteId || '—'}</span>
                      {q.siteName && <span className={styles.stackSecondary}>{q.siteName}</span>}
                    </div>
                  </td>

                  {/* Subject ID + Subject Initials */}
                  <td className={styles.td}>
                    <div className={styles.stack}>
                      <span className={styles.stackPrimary}>{q.subjectId || '—'}</span>
                      {q.subjectInitials && (
                        <span className={styles.stackSecondary}>{q.subjectInitials}</span>
                      )}
                    </div>
                  </td>

                  {/* Block + Page */}
                  <td className={styles.td}>
                    <div className={styles.stack}>
                      <span className={styles.stackPrimary}>{q.blockName || q.formName || '—'}</span>
                      {(q.pageName || (q.formName && q.blockName)) && (
                        <span className={styles.stackSecondary}>
                          {q.pageName || q.formName || ''}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Field Name + Query Description */}
                  <td className={styles.td} title={q.queryText || ''}>
                    <div className={styles.stack} style={{ maxWidth: 280 }}>
                      <span className={`${styles.stackPrimary} ${styles.fieldName}`}>{q.fieldName || '—'}</span>
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
                  <td className={styles.td} title={q.resolutionComment || ''}>
                    {q.resolutionComment
                      ? (q.resolutionComment.length > 40 ? `${q.resolutionComment.slice(0, 40)}…` : q.resolutionComment)
                      : '—'}
                  </td>
                  <td className={styles.tdActions}>
                    <button className={styles.actionBtn} title="View Details" onClick={() => dispatch(addToast({ type: 'info', message: `Query ${q.id} — full details view coming soon.` }))}>
                      <Eye size={12} />
                    </button>
                    {isActive && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionRespond}`}
                        title="Respond"
                        onClick={() => handleRespond(q)}
                      >
                        <MessageSquare size={12} />
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
    </div>
  );
}
