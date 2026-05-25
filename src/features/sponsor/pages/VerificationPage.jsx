import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch }  from 'react-redux';
import {
  CheckCircle, Clock, AlertTriangle, XCircle, BarChart2,
  Search, X, RefreshCw, Download, Filter, ChevronUp, ChevronDown,
  ChevronsUpDown, Eye, Shield, ThumbsUp, ThumbsDown, FileText,
} from 'lucide-react';

import { addToast }                   from '@/app/notificationSlice';
import { sponsorVerificationClient }  from '../api/sponsorVerificationClient';
import sponsorAxiosClient             from '@/api/sponsorAxiosClient';
import SubjectVerificationModal       from '../components/verification/SubjectVerificationModal';
import VerifyActionModal              from '../components/verification/VerifyActionModal';
import { useReadOnlyView }            from '@/features/workspace/hooks/useReadOnlyView';
import { formatDate }                 from '@/utils/formatDate';
import PlatformDatePicker             from '@/components/form/PlatformDatePicker';
import SlaSettingsModal               from '@/features/sponsor/components/sla/SlaSettingsModal';
import SnapshotButton                 from '@/components/feedback/SnapshotButton';
import { usePermissions }             from '@/features/auth/usePermissions';
import css from './VerificationPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

// Verification status palette per spec:
//   Not Verified         Gray   ○
//   In Verification      Blue   ◔
//   Partially Verified   Amber  ◑  (spec doesn't list a colour, but logically between In Verification and Verified)
//   Verified             Green  ✔
//   Overdue              Red    ⚠
// Legacy server statuses (Pending / In Review / Approved / Rejected /
// Queried) map onto the new palette so existing data still renders.
const STATUS_META = {
  'Not Verified':       { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' }, // Gray
  'In Verification':    { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' }, // Blue
  'Partially Verified': { color: '#b45309', bg: '#fef3c7', border: '#fcd34d' }, // Amber
  Verified:             { color: '#15803d', bg: '#dcfce7', border: '#a7f3d0' }, // Green
  Overdue:              { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }, // Red
  // Legacy aliases
  Pending:    { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },   // → Not Verified
  'In Review':{ color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },   // → In Verification
  Approved:   { color: '#15803d', bg: '#dcfce7', border: '#a7f3d0' },   // → Verified
  Rejected:   { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },   // surfaces as a separate state today
  Queried:    { color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },   // → Partially Verified
};

const ALL_STATUSES = ['Not Verified', 'In Verification', 'Partially Verified', 'Verified', 'Overdue'];

const COLS = [
  { key: 'id',               label: 'Subject ID',       sortable: true  },
  { key: 'siteCode',         label: 'Site',             sortable: true  },
  { key: 'enrollmentDate',   label: 'Enrolled',         sortable: true  },
  { key: 'crfsCompleted',    label: 'CRFs',             sortable: true  },
  { key: 'completeness',     label: 'Completeness',     sortable: true  },
  { key: 'openQueries',      label: 'Queries',          sortable: true  },
  { key: 'status',           label: 'Status',           sortable: true  },
  { key: 'verifiedBy',       label: 'Verified By',      sortable: false },
  { key: 'verificationDate', label: 'Verified On',      sortable: true  },
];

const PAGE_SIZES = [20, 50, 100];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (str) => formatDate(str) || '—';

function progressColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

function SortIcon({ colKey, sort }) {
  if (sort.key !== colKey) return <ChevronsUpDown size={11} style={{ opacity: 0.35 }} />;
  return sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VerificationPage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();

  // SLA Settings modal — same pattern as QueriesPage but for the
  // data_verification leaf.
  const { has } = usePermissions();
  const canEditSla = has('data_verification', 'sla_settings');
  const [slaOpen,  setSlaOpen]  = useState(false);

  // Data
  const [metrics,   setMetrics]   = useState(null);
  const [subjects,  setSubjects]  = useState([]);
  const [sites,     setSites]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  // Study's form id — used to open the study form from a subject row.
  const [studyFormId, setStudyFormId] = useState(null);

  // Filters
  const [activeStatuses, setActiveStatuses] = useState(['Pending', 'In Review']);
  const [siteFilter,     setSiteFilter]     = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [minComplete,    setMinComplete]    = useState('');
  const [search,         setSearch]         = useState('');

  // Sort / Pagination
  const [sort,     setSort]     = useState({ key: 'enrollmentDate', dir: 'desc' });
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Modals
  const [detailSubject,   setDetailSubject]   = useState(null);
  const [actionTarget,    setActionTarget]    = useState(null); // { mode, subject } | { mode, bulk: count }
  const [actionLoading,   setActionLoading]   = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else        setRefreshing(true);
    try {
      const filters = {
        ...(activeStatuses.length < ALL_STATUSES.length ? { status: activeStatuses.join(',') } : {}),
        ...(siteFilter   ? { siteCode:    siteFilter }   : {}),
        ...(dateFrom     ? { dateFrom }                  : {}),
        ...(dateTo       ? { dateTo }                    : {}),
        ...(minComplete  ? { minComplete: Number(minComplete) } : {}),
      };
      // Each fetch is wrapped in `.catch` so the page survives even when the
      // backend hasn't implemented every endpoint yet. The list endpoint is
      // load-bearing — if it fails we surface the error; metrics + sites are
      // best-effort enrichment that falls back to safe defaults.
      const [m, s, siteList] = await Promise.all([
        sponsorVerificationClient.getMetrics(studyId).catch(() => null),
        sponsorVerificationClient.list(studyId, filters),
        sites.length
          ? Promise.resolve(sites)
          : sponsorVerificationClient.getSites(studyId).catch(() => []),
      ]);
      setMetrics(m);
      setSubjects(s);
      if (!sites.length) setSites(siteList);
      setSelected(new Set());
    } catch (e) {
      // Only fired if the LIST endpoint itself failed (the core data).
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to load verification data.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, activeStatuses, siteFilter, dateFrom, dateTo, minComplete]);

  useEffect(() => { loadData(); }, [loadData]);

  // Resolve the study's form id once so a subject row can open the study form.
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

  // Open the study form for a subject so the verifier can review its data.
  const openStudyForm = (subject) => {
    if (!studyFormId || !subject?.id) {
      dispatch(addToast({ type: 'error', message: 'Cannot open the form — no study form found.' }));
      return;
    }
    navigate(`/sponsor/${studyId}/capture/form?formId=${studyFormId}&subjectId=${subject.id}`);
  };

  // ── Filter + Sort + Search (client-side) ─────────────────────────────────

  const filtered = useMemo(() => {
    let list = subjects;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.siteCode.toLowerCase().includes(q) ||
          s.siteName.toLowerCase().includes(q) ||
          (s.verifiedBy ?? '').toLowerCase().includes(q),
      );
    }
    // sort
    return [...list].sort((a, b) => {
      let av = a[sort.key] ?? '';
      let bv = b[sort.key] ?? '';
      if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [subjects, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Active (non-approved / non-rejected) subjects on page for checkbox
  const actionableOnPage = pageData.filter((s) => !['Approved'].includes(s.status));

  function toggleSort(key) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  }

  function toggleStatus(st) {
    setActiveStatuses((prev) =>
      prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st],
    );
    setPage(1);
    setSelected(new Set());
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  const allOnPageSelected = actionableOnPage.length > 0 &&
    actionableOnPage.every((s) => selected.has(s.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) actionableOnPage.forEach((s) => next.delete(s.id));
      else                   actionableOnPage.forEach((s) => next.add(s.id));
      return next;
    });
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleActionConfirm({ rejectionReason, comment }) {
    const { mode, subject, bulk } = actionTarget;
    const ids = bulk ? [...selected] : [subject.id];
    try {
      if (mode === 'approve') {
        if (bulk) await sponsorVerificationClient.bulkApprove(studyId, ids);
        else      await sponsorVerificationClient.approveSubject(studyId, subject.id, { comment });
        dispatch(addToast({ type: 'success', message: bulk ? `${ids.length} subjects approved.` : `Subject ${subject.id} approved.` }));
      } else {
        if (bulk) {
          // bulk reject not exposed in client; fall back to sequential
          await Promise.all(ids.map((id) =>
            sponsorVerificationClient.rejectSubject(studyId, id, { rejectionReason, comment }),
          ));
        } else {
          await sponsorVerificationClient.rejectSubject(studyId, subject.id, { rejectionReason, comment });
        }
        dispatch(addToast({ type: 'success', message: bulk ? `${ids.length} subjects rejected.` : `Subject ${subject.id} rejected.` }));
      }
      setActionTarget(null);
      loadData(true);
    } catch (e) {
      throw e; // let modal surface the error
    }
  }

  async function handleBulkVerify() {
    const ids = [...selected];
    setActionLoading(true);
    try {
      await sponsorVerificationClient.bulkVerify(studyId, ids);
      dispatch(addToast({ type: 'success', message: `${ids.length} subjects marked as verified.` }));
      loadData(true);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Bulk verify failed.' }));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExport(format = 'csv') {
    try {
      await sponsorVerificationClient.exportReport(studyId, format);
      dispatch(addToast({ type: 'success', message: `${format.toUpperCase()} report downloaded.` }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Export failed.' }));
    }
  }

  // ── Pagination helpers ────────────────────────────────────────────────────

  function pageRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)   return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', cur - 1, cur, cur + 1, '…', total];
  }

  // ── Metrics bar ───────────────────────────────────────────────────────────

  const METRIC_CARDS = metrics ? [
    { label: 'Total',       value: metrics.totalSubjects,       color: '#0f172a', icon: BarChart2 },
    { label: 'Pending',     value: metrics.pendingVerification, color: '#d97706', icon: Clock },
    { label: 'In Review',   value: metrics.inReview,            color: '#2563eb', icon: Eye },
    { label: 'Verified',    value: metrics.verified,            color: '#059669', icon: CheckCircle },
    { label: 'Approved',    value: metrics.approved,            color: '#7c3aed', icon: Shield },
    { label: 'Rejected',    value: metrics.rejectedQueried,     color: '#dc2626', icon: XCircle },
    { label: 'Completion',  value: `${metrics.completionRate ?? 0}%`, color: '#0891b2', icon: BarChart2 },
  ] : [];

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedCount = selected.size;

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Data Verification</h1>
          <p  className={css.sub}>Review and verify subject CRF data against source documents.</p>
        </div>
        <div className={css.headerActions}>
          <button
            className={css.btnSecondary}
            onClick={() => setSlaOpen(true)}
            title={canEditSla ? 'Configure SLA' : 'View SLA settings'}
          >
            <Clock size={14} /> SLA Settings
          </button>
          <SnapshotButton leaf="data_verification" filename="verification" className={css.btnSecondary} />
          <button className={css.btnSecondary} onClick={() => handleExport('csv')}>
            <Download size={14} /> Export CSV
          </button>
          <button className={css.btnSecondary} onClick={() => handleExport('pdf')}>
            <Download size={14} /> Export PDF
          </button>
          <button
            className={css.btnRefresh}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'spin .7s linear infinite' } : {}} />
          </button>
        </div>
      </div>

      <SlaSettingsModal
        open={slaOpen}
        kind="data_verification"
        canEdit={canEditSla}
        onClose={() => setSlaOpen(false)}
      />

      {/* Metrics */}
      {metrics && (
        <div className={css.metricsBar}>
          {METRIC_CARDS.map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={css.metricCard}>
              <Icon size={16} style={{ color }} />
              <span className={css.metricValue} style={{ color }}>{value}</span>
              <span className={css.metricLabel}>{label}</span>
            </div>
          ))}
          {metrics.avgVerificationDays > 0 && (
            <div className={css.metricCard}>
              <Clock size={16} style={{ color: '#64748b' }} />
              <span className={css.metricValue} style={{ color: '#64748b' }}>{metrics.avgVerificationDays}d</span>
              <span className={css.metricLabel}>Avg. Days</span>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          {/* Status pills */}
          <div className={css.filterWrap}>
            <Filter size={13} className={css.filterIcon} />
            {ALL_STATUSES.map((st) => {
              const meta = STATUS_META[st] ?? {};
              const active = activeStatuses.includes(st);
              return (
                <button
                  key={st}
                  className={`${css.filterBtn} ${active ? css.filterBtnActive : ''}`}
                  style={active ? { background: meta.bg, color: meta.color, borderColor: meta.border } : {}}
                  onClick={() => toggleStatus(st)}
                >
                  {st}
                </button>
              );
            })}
          </div>

          {/* Site filter */}
          {sites.length > 0 && (
            <select
              className={`${css.selectFilter} ${css.siteFilter}`}
              value={siteFilter}
              onChange={(e) => { setSiteFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Sites</option>
              {sites.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}

          {/* Date range */}
          <div className={css.dateRange}>
            <PlatformDatePicker
              className={css.dateInput}
              value={dateFrom}
              onChange={(iso) => { setDateFrom(iso); setPage(1); }}
              placeholder="Enrolled from"
            />
            <span className={css.dateSep}>–</span>
            <PlatformDatePicker
              className={css.dateInput}
              value={dateTo}
              onChange={(iso) => { setDateTo(iso); setPage(1); }}
              placeholder="Enrolled to"
            />
          </div>

          {/* Completeness threshold */}
          <div className={css.completeWrap}>
            <span className={css.completeLabel}>≥</span>
            <input
              type="number"
              className={css.completeInput}
              placeholder="0"
              min={0}
              max={100}
              value={minComplete}
              onChange={(e) => { setMinComplete(e.target.value); setPage(1); }}
            />
            <span className={css.completeLabel}>%</span>
          </div>
        </div>

        {/* Search */}
        <div className={css.searchWrapper}>
          <Search size={14} className={css.searchIcon} />
          <input
            className={css.searchInput}
            placeholder="Search subject ID, site…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className={css.searchClear} onClick={() => { setSearch(''); setPage(1); }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selectedCount > 0 && (
        <div className={css.bulkBar}>
          <span className={css.bulkCount}>{selectedCount} selected</span>
          <button
            className={css.bulkVerify}
            onClick={handleBulkVerify}
            disabled={actionLoading || ro.isReadOnly}
            aria-disabled={actionLoading || ro.isReadOnly}
            title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
          >
            <CheckCircle size={13} /> Bulk Verify
          </button>
          <button
            className={css.bulkApprove}
            onClick={() => setActionTarget({ mode: 'approve', bulk: selectedCount })}
            disabled={actionLoading || ro.isReadOnly}
            aria-disabled={actionLoading || ro.isReadOnly}
            title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
          >
            <ThumbsUp size={13} /> Bulk Approve
          </button>
          <button
            className={css.bulkReject}
            onClick={() => setActionTarget({ mode: 'reject', bulk: selectedCount })}
            disabled={actionLoading || ro.isReadOnly}
            aria-disabled={actionLoading || ro.isReadOnly}
            title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
          >
            <ThumbsDown size={13} /> Bulk Reject
          </button>
          <button className={css.bulkClear} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Count */}
      <p className={css.count}>
        {loading ? 'Loading…' : `${filtered.length} subject${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* Table */}
      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th className={css.thCheck}>
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  disabled={actionableOnPage.length === 0}
                />
              </th>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? css.th : css.thPlain}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className={css.thInner}>
                    {col.label}
                    {col.sortable && <SortIcon colKey={col.key} sort={sort} />}
                  </span>
                </th>
              ))}
              <th className={css.thActions}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={css.row}>
                  <td className={css.tdCheck} />
                  {COLS.map((c) => (
                    <td key={c.key} className={css.td}>
                      <div className={css.skeleton} style={{ width: c.key === 'id' ? 80 : c.key === 'status' ? 70 : 60 }} />
                    </td>
                  ))}
                  <td className={css.tdActions} />
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 2} className={css.emptyCell}>
                  <div className={css.empty}>
                    <AlertTriangle size={28} className={css.emptyIcon} />
                    <p className={css.emptyTitle}>No subjects found</p>
                    <p className={css.emptySub}>Try adjusting the filters or search.</p>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((s) => {
                const meta    = STATUS_META[s.status] ?? {};
                const isSelectable = !['Approved'].includes(s.status);
                const isSel   = selected.has(s.id);
                const pct     = s.completeness ?? 0;
                return (
                  <tr key={s.id} className={`${css.row} ${isSel ? css.rowSelected : ''}`}>
                    <td className={css.tdCheck}>
                      {isSelectable && (
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(s.id)}
                        />
                      )}
                    </td>
                    <td className={css.td}>
                      <span className={css.subjectId}>{s.id}</span>
                    </td>
                    <td className={css.td}>
                      <span className={css.siteCode}>{s.siteCode}</span>
                      {s.siteName && <span className={css.siteName}> {s.siteName}</span>}
                    </td>
                    <td className={css.td}>{fmtDate(s.enrollmentDate)}</td>
                    <td className={css.td}>
                      {s.crfsCompleted ?? 0} / {s.crfsTotal ?? 0}
                    </td>
                    <td className={css.td}>
                      <div className={css.completenessCell}>
                        <div className={css.progressBarSmall}>
                          <div
                            className={css.progressFillSmall}
                            style={{ width: `${pct}%`, background: progressColor(pct) }}
                          />
                        </div>
                        <span style={{ color: progressColor(pct), fontWeight: 600 }}>{pct}%</span>
                      </div>
                    </td>
                    <td className={css.td}>
                      {s.openQueries > 0
                        ? <span className={css.queryBadge}>{s.openQueries}</span>
                        : <span className={css.queryNone}>—</span>}
                    </td>
                    <td className={css.td}>
                      <span
                        className={css.statusBadge}
                        style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className={css.td}>{s.verifiedBy || '—'}</td>
                    <td className={css.td}>{fmtDate(s.verificationDate)}</td>
                    <td className={css.tdActions}>
                      {/* View Details */}
                      <button
                        className={css.actionBtn}
                        title="View & Verify"
                        onClick={() => setDetailSubject(s)}
                      >
                        <Eye size={13} />
                      </button>
                      {/* Open the study form for this subject */}
                      <button
                        className={css.actionBtn}
                        title="Open Study Form"
                        onClick={() => openStudyForm(s)}
                      >
                        <FileText size={13} />
                      </button>
                      {/* Approve */}
                      {['Verified', 'In Review', 'Pending'].includes(s.status) && (
                        <button
                          className={`${css.actionBtn} ${css.actionApprove}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Approve'}
                          onClick={() => setActionTarget({ mode: 'approve', subject: s })}
                          {...ro.disabledProps('Approve verification')}
                        >
                          <ThumbsUp size={13} />
                        </button>
                      )}
                      {/* Reject */}
                      {['Verified', 'In Review', 'Pending'].includes(s.status) && (
                        <button
                          className={`${css.actionBtn} ${css.actionReject}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Reject'}
                          onClick={() => setActionTarget({ mode: 'reject', subject: s })}
                          {...ro.disabledProps('Reject verification')}
                        >
                          <ThumbsDown size={13} />
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
      {!loading && filtered.length > pageSize && (
        <div className={css.pagination}>
          <span className={css.pageInfo}>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className={css.pageButtons}>
            <button className={css.pageBtn} onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
            <button className={css.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={safePage === 1}>‹</button>
            {pageRange(safePage, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className={css.pageEllipsis}>…</span>
              ) : (
                <button
                  key={p}
                  className={`${css.pageBtn} ${p === safePage ? css.pageBtnActive : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
            <button className={css.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={safePage === totalPages}>›</button>
            <button className={css.pageBtn} onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
          </div>
          <select
            className={css.pageSizeSelect}
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      )}

      {/* Subject Verification Modal */}
      {detailSubject && (
        <SubjectVerificationModal
          studyId={studyId}
          subjectId={detailSubject.id}
          onClose={() => { setDetailSubject(null); loadData(true); }}
        />
      )}

      {/* Approve / Reject Modal */}
      {actionTarget && (
        <VerifyActionModal
          mode={actionTarget.mode}
          subject={actionTarget.subject ?? null}
          bulk={actionTarget.bulk ?? null}
          onConfirm={handleActionConfirm}
          onClose={() => setActionTarget(null)}
        />
      )}
    </div>
  );
}
