import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch }  from 'react-redux';
import {
  CheckCircle, Clock, AlertTriangle, XCircle, BarChart2,
  Search, X, RefreshCw, Download, Filter, ChevronUp, ChevronDown,
  ChevronsUpDown, Eye, Shield, FileText,
} from 'lucide-react';

import { addToast }                   from '@/app/notificationSlice';
import { sponsorVerificationClient }  from '../api/sponsorVerificationClient';
import sponsorAxiosClient             from '@/api/sponsorAxiosClient';
import siteAxiosClient                from '@/api/siteAxiosClient';

// Pick the right axios + workspace prefix based on which scope's token is
// live. Mirrors the same pattern in sponsorVerificationClient/sponsorSlaClient.
// Used by the per-page /forms lookup so the Verification page actually works
// when mounted at /site/verification too (router.jsx mounts the same component
// under both /sponsor/:studyId/verification and /site/verification).
function pickScopedAxios() {
  if (typeof window === 'undefined') {
    return { axios: sponsorAxiosClient, workspace: '/api/v1/sponsor/workspace' };
  }
  const hasSponsor = !!localStorage.getItem('sponsorAccessToken') || !!localStorage.getItem('sponsorViewToken');
  const hasSite    = !!localStorage.getItem('siteAccessToken');
  if (hasSite && !hasSponsor) {
    return { axios: siteAxiosClient, workspace: '/api/v1/site/workspace' };
  }
  return { axios: sponsorAxiosClient, workspace: '/api/v1/sponsor/workspace' };
}
import SubjectVerificationModal       from '../components/verification/SubjectVerificationModal';
import VerifyActionModal              from '../components/verification/VerifyActionModal';
import { useReadOnlyView }            from '@/features/workspace/hooks/useReadOnlyView';
import { formatDate }                 from '@/utils/formatDate';
import PlatformDatePicker             from '@/components/form/PlatformDatePicker';
import SearchableDropdown             from '@/components/form/SearchableDropdown';
import SlaSettingsModal               from '@/features/sponsor/components/sla/SlaSettingsModal';
import SnapshotButton                 from '@/components/feedback/SnapshotButton';
import StatCard                       from '@/components/feedback/StatCard';
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
// Single-select status filter options — mirrors the Query Manager ('All' + each).
const STATUS_OPTIONS = ['All', ...ALL_STATUSES];

// Map legacy/raw backend statuses onto the spec palette so the status filter
// chips (which use the display names) match rows that still carry old values.
const STATUS_DISPLAY = {
  Pending:     'Not Verified',
  'In Review': 'In Verification',
  Approved:    'Verified',
  Queried:     'Partially Verified',
};
const toDisplayStatus = (st) => STATUS_DISPLAY[st] ?? st ?? 'Not Verified';

// Column order follows spec §VM list table:
//   Subject Details (Subject ID + Initials) · Site Details · Enrolment Date ·
//   Block / Page · CRF Completeness % · Age · Status · Actions.
// Verified By + Verified On stay as supplementary columns so existing
// reviewer info is still visible — not on the spec table but useful day-to-day.
const COLS = [
  { key: 'siteCode',         label: 'Site Details',     sortable: true  },
  { key: 'id',               label: 'Subject Details',  sortable: true  },
  { key: 'blockPage',        label: 'CRF Block / Page', sortable: true  },
  { key: 'completeness',     label: 'Verified %',       sortable: true  },
  { key: 'ageDays',          label: 'Aging',            sortable: true  },
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
  // All Verification Manager actions require a Verification Manager permission:
  // the discrete `verify` leaf (migration 035), with `edit` as the only fallback
  // for pre-split / site roles. NOTE: approve previously keyed off
  // data_capture.verify — a DIFFERENT module — which leaked the Approve buttons
  // to data-capture roles with no VM access. Reject previously keyed off edit
  // only. Both now match Verify so no permission → no VM action.
  const canVerify  = has('data_verification', 'verify') || has('data_verification', 'edit');
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
  // Default: all statuses selected (= show everything). Legacy seed of
  // ['Pending','In Review'] hid every new row, since those aren't in the chip
  // set and the backend status filter is an exact match.
  const [statusFilter, setStatusFilter] = useState('All');
  const [siteFilter,     setSiteFilter]     = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
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
      // Fetch the full queue for the study; status / site / date / completeness
      // filtering is done client-side (see `filtered`) so any combination works
      // instantly and isn't tripped up by the backend's exact-match status param.
      const [m, s, siteList] = await Promise.all([
        sponsorVerificationClient.getMetrics(studyId).catch(() => null),
        sponsorVerificationClient.list(studyId, {}),
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
  }, [studyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Resolve the study's form id once so a subject row can open the study form.
  // Scope-aware: on /site/verification this hits /api/v1/site/workspace/forms
  // with the site token; on /sponsor/:studyId/verification it stays on the
  // sponsor route. studyId is only present on the sponsor URL — the site URL
  // doesn't have one, but the site token is already pinned to its own study.
  useEffect(() => {
    let cancelled = false;
    const { axios, workspace } = pickScopedAxios();
    axios.get(`${workspace}/forms`)
      .then((res) => {
        if (cancelled) return;
        const items = res?.items ?? res ?? [];
        if (items.length) setStudyFormId(items[0].formId ?? items[0].form_id ?? null);
      })
      .catch(() => { /* leave null — the action falls back to a toast */ });
    return () => { cancelled = true; };
  }, [studyId]);

  // Open the study form for a subject so the verifier can review its data.
  // Scope-aware navigation: site mounts have no `studyId` segment so they
  // need /site/capture/form; sponsor mounts use /sponsor/:studyId/capture/form.
  const openStudyForm = (subject) => {
    if (!studyFormId || !subject?.id) {
      dispatch(addToast({ type: 'error', message: 'Cannot open the form — no study form found.' }));
      return;
    }
    const isSiteSession = typeof window !== 'undefined'
      && !!localStorage.getItem('siteAccessToken')
      && !localStorage.getItem('sponsorAccessToken')
      && !localStorage.getItem('sponsorViewToken');
    // Deep-link straight to the completed page when the row carries one.
    const pageQS = subject.pageId ? `&pageId=${encodeURIComponent(subject.pageId)}` : '';
    const path = isSiteSession
      ? `/site/capture/form?formId=${studyFormId}&subjectId=${subject.id}${pageQS}`
      : `/sponsor/${studyId}/capture/form?formId=${studyFormId}&subjectId=${subject.id}${pageQS}`;
    navigate(path);
  };

  // ── Filter + Sort + Search (client-side) ─────────────────────────────────

  const filtered = useMemo(() => {
    // The Verification Manager lists PAGE-level work-items (and legacy
    // subject/form-level rows). Per-field verification rows (fieldName set) are
    // detail records surfaced when drilling into a page, not table rows.
    let list = subjects.filter((s) => !s.fieldName);

    // Status filter — single-select like the Query Manager. 'All' = no filter.
    if (statusFilter !== 'All') {
      list = list.filter((s) => toDisplayStatus(s.status) === statusFilter);
    }
    // Site dropdown (match by code or id — depends on the option value).
    if (siteFilter) {
      list = list.filter((s) => s.siteCode === siteFilter || s.siteId === siteFilter);
    }
    // Date range — filter by the verification/eligible date the row carries
    // (verified date when present, else the row's eligibility date).
    const rowDate = (s) => (s.verificationDate || s.enrollmentDate || '').slice(0, 10);
    if (dateFrom) list = list.filter((s) => rowDate(s) && rowDate(s) >= dateFrom);
    if (dateTo)   list = list.filter((s) => rowDate(s) && rowDate(s) <= dateTo);

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
  }, [subjects, search, sort, statusFilter, siteFilter, dateFrom, dateTo]);

  // Metric cards are derived from the SAME page-level rows the table lists (one
  // row per page work-item), so "Total" equals the table's row count. The
  // backend metrics counted every data_verifications row (page + per-field),
  // which over-counted. Cards summarise the whole queue (unaffected by the
  // status/site/search filters, which segment the table itself).
  const cardCounts = useMemo(() => {
    const pageRows = subjects.filter((s) => !s.fieldName);
    const c = { total: pageRows.length, notVerified: 0, inVerification: 0, partiallyVerified: 0, verified: 0, overdue: 0 };
    for (const s of pageRows) {
      const st = s.status;
      if (st === 'Not Verified' || st === 'Pending')          c.notVerified++;
      else if (st === 'In Verification' || st === 'In Review') c.inVerification++;
      else if (st === 'Partially Verified')                   c.partiallyVerified++;
      else if (st === 'Verified' || st === 'Approved')        c.verified++;
      else if (st === 'Overdue')                              c.overdue++;
    }
    c.completionRate = c.total ? Math.round((c.verified / c.total) * 100) : 0;
    return c;
  }, [subjects]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Active (non-approved / non-rejected) subjects on page for checkbox
  const actionableOnPage = pageData.filter((s) => !['Approved'].includes(s.status));

  function toggleSort(key) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  }

  function selectStatus(st) {
    setStatusFilter(st);
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
      const { verified, processed } = await sponsorVerificationClient.bulkVerify(studyId, ids);
      if (processed === 0) {
        dispatch(addToast({ type: 'warning', message: 'No completed pages found for the selected subject(s). A page must be Marked Completed before it can be verified.' }));
      } else {
        dispatch(addToast({ type: 'success', message: `${verified} of ${processed} page(s) verified.` }));
      }
      loadData(true);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message ?? e?.message ?? 'Bulk verify failed.' }));
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

  // Spec §VM status cards (in spec order): Not Verified · In Verification ·
  // Partially Verified · Verified · Overdue. Approved / Rejected stay for
  // legacy data still tagged with those values. Overdue card is shown when
  // metrics.overdue > 0 so an empty queue stays clean.
  const METRIC_CARDS = [
    { label: 'Total',              value: cardCounts.total,             color: '#0f172a', icon: BarChart2 },
    { label: 'Not Verified',       value: cardCounts.notVerified,       color: '#475569', icon: Clock },
    { label: 'Partially Verified', value: cardCounts.partiallyVerified, color: '#b45309', icon: Shield },
    { label: 'Verified',           value: cardCounts.verified,          color: '#059669', icon: CheckCircle },
    ...(cardCounts.overdue > 0
      ? [{ label: 'Overdue', value: cardCounts.overdue, color: '#dc2626', icon: AlertTriangle }]
      : []),
    { label: 'Completion',         value: `${cardCounts.completionRate}%`, color: '#0891b2', icon: BarChart2 },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedCount = selected.size;

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Verification Manager</h1>
          <p  className={css.sub}>Review and verify subject CRF data against source documents.</p>
        </div>
        <div className={css.headerActions}>
          {canEditSla && (
            <button
              className={css.btnSecondary}
              onClick={() => setSlaOpen(true)}
              title="Configure SLA"
            >
              <Clock size={14} /> SLA Settings
            </button>
          )}
          <SnapshotButton leaf="data_verification" filename="verification" className={css.btnSecondary} />
          <button className={css.btnSecondary} onClick={() => handleExport('csv')}>
            <Download size={14} /> Export CSV
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

      {/* Spec §VM Overdue banner — surfaces the count of rows flipped to
          'Overdue' by the SLA scanner. Clicking the inline link adds the
          Overdue pill to the active status filter so the CRA jumps straight
          to the affected rows. */}
      {cardCounts.overdue > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#7f1d1d',
            margin: '0 0 12px',
            fontSize: 13,
          }}
        >
          <AlertTriangle size={16} style={{ flex: '0 0 auto' }} />
          <strong style={{ fontWeight: 700 }}>{cardCounts.overdue}</strong>
          <span>
            verification{cardCounts.overdue === 1 ? '' : 's'} {cardCounts.overdue === 1 ? 'is' : 'are'} <strong>Overdue</strong>.
            Action needed before the SLA breach escalates.
          </span>
          <button
            type="button"
            onClick={() => selectStatus('Overdue')}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid #b91c1c',
              color: '#7f1d1d',
              fontWeight: 600,
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            View overdue
          </button>
        </div>
      )}

      {/* Metrics — derived from the page-row list (cardCounts), so counts match
          the table. Rendered with the shared <StatCard> (same component the
          Query Manager uses). "In Verification" and "Avg. Days" intentionally removed. */}
      {cardCounts.total > 0 && (
        <div className={css.metricsBar}>
          {METRIC_CARDS.map(({ label, value, color, icon }) => (
            <StatCard key={label} icon={icon} label={label} value={value} accent={color} />
          ))}
        </div>
      )}

      {/* CRF Completeness % + Verification Completion % progress bars are
          temporarily removed — to be re-implemented later. The BE getMetrics
          endpoint still returns crf_completeness_pct / verification_completion_pct,
          and <ProgressTile> remains available, so this is a pure UI restore. */}

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          {/* Status pills */}
          <div className={css.filterWrap}>
            <Filter size={13} className={css.filterIcon} />
            {STATUS_OPTIONS.map((st) => {
              const meta = STATUS_META[st] ?? {};
              const active = statusFilter === st;
              return (
                <button
                  key={st}
                  className={`${css.filterBtn} ${active ? css.filterBtnActive : ''}`}
                  style={active && meta.bg ? { background: meta.bg, color: meta.color, borderColor: meta.border } : {}}
                  onClick={() => selectStatus(st)}
                >
                  {st}
                </button>
              );
            })}
          </div>

          {/* Site dropdown — same control as the Query Manager. */}
          <div className={css.siteFilter}>
            <SearchableDropdown
              options={[{ value: '', label: 'All Sites' }, ...sites]}
              value={siteFilter}
              onChange={(v) => { setSiteFilter(v ?? ''); setPage(1); }}
              placeholder="All Sites"
              searchPlaceholder="Search site…"
            />
          </div>

          {/* Date range */}
          <div className={css.dateRange}>
            <PlatformDatePicker
              className={css.dateInput}
              value={dateFrom}
              onChange={(iso) => { setDateFrom(iso); setPage(1); }}
              placeholder="From"
            />
            <span className={css.dateSep}>–</span>
            <PlatformDatePicker
              className={css.dateInput}
              value={dateTo}
              onChange={(iso) => { setDateTo(iso); setPage(1); }}
              placeholder="To"
            />
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
          {canVerify && (
            <button
              className={css.bulkVerify}
              onClick={handleBulkVerify}
              disabled={actionLoading || ro.isReadOnly}
              aria-disabled={actionLoading || ro.isReadOnly}
              title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
            >
              <CheckCircle size={13} /> Bulk Verify
            </button>
          )}
          <button className={css.bulkClear} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Count */}
      <p className={css.count}>
        {loading ? 'Loading…' : `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`}
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
                const dispStatus = toDisplayStatus(s.status);
                const meta    = STATUS_META[dispStatus] ?? STATUS_META[s.status] ?? {};
                const isSelectable = !['Approved'].includes(s.status);
                const isSel   = selected.has(s.id);
                const pct     = s.completeness ?? 0;
                return (
                  <tr key={s.verificationId || s.id} className={`${css.row} ${isSel ? css.rowSelected : ''}`}>
                    <td className={css.tdCheck}>
                      {isSelectable && (
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(s.id)}
                        />
                      )}
                    </td>
                    {/* Site Details — site code over site name */}
                    <td className={css.td} title={[s.siteCode, s.siteName].filter(Boolean).join(' — ')}>
                      {s.siteCode || s.siteName ? (
                        <>
                          <span className={css.siteCode}>{s.siteCode || '—'}</span>
                          {s.siteName && <span className={css.siteName}>{s.siteName}</span>}
                        </>
                      ) : '—'}
                    </td>
                    {/* Subject Details — Subject ID over Subject Name */}
                    <td className={css.td} title={[s.subjectNumber, s.subjectName, s.initials].filter(Boolean).join(' · ')}>
                      <span className={css.siteCode}>{s.subjectNumber || s.id || '—'}</span>
                      {(s.subjectName || s.initials) && (
                        <span className={css.siteName}>{s.subjectName || s.initials}</span>
                      )}
                    </td>
                    {/* CRF Block / Page — block name over page name */}
                    <td className={css.td} title={s.blockPage}>
                      {(s.blockName || s.pageName) ? (
                        <>
                          {s.blockName && <span className={css.siteCode}>{s.blockName}</span>}
                          {s.pageName && <span className={css.siteName}>{s.pageName}</span>}
                        </>
                      ) : <span className={css.queryNone}>—</span>}
                    </td>
                    {/* Verified % — full-width progress bar then the percentage */}
                    <td className={css.td}>
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 96 }}
                        title={Number.isFinite(s.verifiedFields) && Number.isFinite(s.totalFields)
                          ? `${s.verifiedFields}/${s.totalFields} fields verified on this page`
                          : 'Page verification progress'}
                      >
                        <div className={css.progressBarSmall} style={{ width: '100%', flex: 'none', minWidth: 0 }}>
                          <div
                            className={css.progressFillSmall}
                            style={{ width: `${pct}%`, background: progressColor(pct) }}
                          />
                        </div>
                        <span style={{ color: progressColor(pct), fontWeight: 600, fontSize: 12 }}>{pct}%</span>
                      </div>
                    </td>
                    {/* Aging */}
                    <td className={css.td}>
                      {Number.isFinite(s.ageDays) ? `${Math.round(s.ageDays)}d` : '—'}
                    </td>
                    <td className={css.td}>
                      <span
                        className={css.statusBadge}
                        style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
                      >
                        {dispStatus}
                      </span>
                    </td>
                    <td
                      className={css.td}
                      title={Array.isArray(s.verifiedByNames) && s.verifiedByNames.length > 1
                        ? `Verified by: ${s.verifiedByNames.join(', ')}`
                        : undefined}
                    >
                      {s.verifiedBy || '—'}
                    </td>
                    <td className={css.td}>{fmtDate(s.verificationDate)}</td>
                    {/* Actions — View & Verify (this page only) + Open Study Form.
                        Approve / Reject (thumbs) removed per spec. */}
                    <td className={css.tdActions}>
                      <button
                        className={css.actionBtn}
                        title="View & Verify"
                        onClick={() => setDetailSubject(s)}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        className={css.actionBtn}
                        title="Open Study Form"
                        onClick={() => openStudyForm(s)}
                      >
                        <FileText size={13} />
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
          subject={detailSubject}
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

// Spec §VM dashboard progress bar — clamps the percentage to [0, 100] so a
// stale BE value never overflows the track, and surfaces a small caption
// (e.g. "X of Y forms completed") so the bar is interpretable without a
// tooltip.
function ProgressTile({ label, value, caption, color }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 8,
          background: '#f1f5f9',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width .3s ease',
          }}
        />
      </div>
      {caption && (
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>{caption}</div>
      )}
    </div>
  );
}
