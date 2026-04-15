/**
 * ActivityLogPage — /cro/activity-log
 *
 * Comprehensive audit trail for all CRO-level actions.
 * Features:
 *   - Date range, module, action type, status filters
 *   - Free-text search
 *   - Server-side pagination (50 records default)
 *   - Sortable columns
 *   - Row click → detail modal (fetches full record via GET /api/v1/activity-logs/:id)
 *   - CSV export via GET /api/v1/activity-logs/export
 *   - Default view: last 7 days, newest first
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  Filter, Download, X, ChevronDown,
  Eye, FileText, Clock, User as UserIcon,
  Monitor, AlertCircle, CheckCircle2, TriangleAlert,
} from 'lucide-react';
import { activityLogService } from '@/services/activityLogService';
import { useApi }             from '@/hooks/useApi';
import { addToast }           from '@/app/notificationSlice';
import DataTable              from '@/components/data-table/DataTable';
import styles from './ActivityLogPage.module.css';

/* ── Constants ───────────────────────────────────────────────────────────── */
const MODULES     = ['Auth', 'Study', 'Profile', 'Sponsor', 'Team', 'Masters'];
const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'];
const STATUSES    = ['SUCCESS', 'FAILURE', 'WARNING'];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function sevenDaysAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/* ── Status badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  if (status === 'SUCCESS') {
    return (
      <span className={`${styles.badge} ${styles.badgeSuccess}`}>
        <CheckCircle2 size={11} /> Success
      </span>
    );
  }
  if (status === 'WARNING') {
    return (
      <span className={`${styles.badge} ${styles.badgeWarning}`}>
        <TriangleAlert size={11} /> Warning
      </span>
    );
  }
  return (
    <span className={`${styles.badge} ${styles.badgeFailure}`}>
      <AlertCircle size={11} /> Failure
    </span>
  );
}

/* ── Action type badge ───────────────────────────────────────────────────── */
const ACTION_CLS = {
  CREATE: styles.aCreated,
  UPDATE: styles.aUpdated,
  DELETE: styles.aDeleted,
  EXPORT: styles.aExported,
  LOGIN:  styles.aLogin,
  LOGOUT: styles.aLogin,
};

function ActionBadge({ actionType }) {
  return (
    <span className={`${styles.actionBadge} ${ACTION_CLS[actionType] ?? ''}`}>
      {actionType}
    </span>
  );
}

/* ── Detail Modal ────────────────────────────────────────────────────────── */
function DetailModal({ logId, onClose }) {
  const { data: log, loading } = useApi(activityLogService.getById, {
    immediate:     true,
    immediateArgs: [logId],
  });

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.mHead}>
          <div className={styles.mTitleWrap}>
            <FileText size={15} className={styles.mTitleIcon} />
            <span className={styles.mTitle}>Activity Detail</span>
          </div>
          <button className={styles.mClose} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.mBody}>
          {loading && (
            <p className={styles.mLoading}>Loading…</p>
          )}

          {!loading && log && (
            <>
              {/* Info grid */}
              <div className={styles.detailGrid}>
                {[
                  { label: 'Timestamp',   value: fmtDate(log.timestamp),        icon: <Clock size={12} /> },
                  { label: 'User',        value: log.userName ?? '—',            icon: <UserIcon size={12} /> },
                  { label: 'Action',      value: <ActionBadge actionType={log.actionType} /> },
                  { label: 'Module',      value: log.module },
                  { label: 'Entity Type', value: log.entityType ?? '—' },
                  { label: 'Entity Name', value: log.entityName ?? '—' },
                  { label: 'Status',      value: <StatusBadge status={log.status} /> },
                  { label: 'IP Address',  value: log.ipAddress || '—' },
                  ...(log.userAgent ? [{ label: 'User Agent', value: log.userAgent, icon: <Monitor size={12} /> }] : []),
                ].map(({ label, value, icon }) => (
                  <div key={label} className={styles.dRow}>
                    <span className={styles.dLabel}>{label}</span>
                    <span className={styles.dValue}>
                      {icon && <span className={styles.dIcon}>{icon}</span>}
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Description */}
              {log.description && (
                <div className={styles.mSection}>
                  <p className={styles.mSectionLabel}>Description</p>
                  <p className={styles.mDesc}>{log.description}</p>
                </div>
              )}

              {/* Failure reason */}
              {log.failureReason && (
                <div className={styles.mSection}>
                  <p className={styles.mSectionLabel}>Failure Reason</p>
                  <p className={`${styles.mDesc} ${styles.mDescDanger}`}>{log.failureReason}</p>
                </div>
              )}

              {/* Before / After */}
              {(log.beforeValue || log.afterValue) && (
                <div className={styles.mSection}>
                  <p className={styles.mSectionLabel}>Changes</p>
                  <div className={styles.diffRow}>
                    <div className={styles.diffCol}>
                      <p className={styles.diffLabel}>Before</p>
                      <pre className={`${styles.diffBox} ${styles.diffBefore}`}>
                        {log.beforeValue ? JSON.stringify(log.beforeValue, null, 2) : '—'}
                      </pre>
                    </div>
                    <div className={styles.diffCol}>
                      <p className={styles.diffLabel}>After</p>
                      <pre className={`${styles.diffBox} ${styles.diffAfter}`}>
                        {log.afterValue ? JSON.stringify(log.afterValue, null, 2) : '—'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.mFoot}>
          <button className={styles.mCloseBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ActivityLogPage() {
  const dispatch = useDispatch();

  /* ── Filters ── */
  const [dateFrom,    setDateFrom]    = useState(sevenDaysAgoISO);
  const [dateTo,      setDateTo]      = useState(todayISO);
  const [modFilter,   setModFilter]   = useState('');
  const [actFilter,   setActFilter]   = useState('');
  const [statFilter,  setStatFilter]  = useState('');
  const [search,      setSearch]      = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  /* ── Pagination / sort ── */
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(50);

  /* ── Detail modal ── */
  const [detailId,  setDetailId]  = useState(null);
  const [exporting, setExporting] = useState(false);

  /* ── List API ── */
  const {
    data:    listData,
    loading,
    execute: fetchLogs,
  } = useApi(activityLogService.list);

  const items = listData?.items      ?? [];
  const total = listData?.pagination?.total ?? 0;

  /* ── Fetch on filter / page change ── */
  const buildParams = useCallback(() => ({
    page,
    pageSize,
    search:     search     || undefined,
    module:     modFilter  || undefined,
    actionType: actFilter  || undefined,
    status:     statFilter || undefined,
    dateFrom:   dateFrom   || undefined,
    dateTo:     dateTo     || undefined,
  }), [page, pageSize, search, modFilter, actFilter, statFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs(buildParams()).catch(() => {
      dispatch(addToast({ type: 'error', message: 'Failed to load activity logs.' }));
    });
  }, [buildParams]);                        // eslint-disable-line react-hooks/exhaustive-deps

  /* Reset to page 1 when any filter changes */
  useEffect(() => { setPage(1); }, [search, modFilter, actFilter, statFilter, dateFrom, dateTo]);

  /* ── Clear filters ── */
  const hasActiveFilters = modFilter || actFilter || statFilter ||
    dateFrom !== sevenDaysAgoISO() || dateTo !== todayISO();

  const clearFilters = () => {
    setDateFrom(sevenDaysAgoISO());
    setDateTo(todayISO());
    setModFilter(''); setActFilter(''); setStatFilter('');
  };

  /* ── Export ── */
  const handleExport = async () => {
    setExporting(true);
    try {
      await activityLogService.export({
        search:     search     || undefined,
        module:     modFilter  || undefined,
        actionType: actFilter  || undefined,
        status:     statFilter || undefined,
        dateFrom:   dateFrom   || undefined,
        dateTo:     dateTo     || undefined,
      });
      dispatch(addToast({ type: 'success', message: 'Activity log exported successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export activity log. Please try again.' }));
    } finally {
      setExporting(false);
    }
  };

  /* ── Columns ── */
  const columns = useMemo(() => [
    {
      key: 'timestamp', label: 'Timestamp', sortable: true, width: '155px',
      render: (v) => <span className={styles.tsCell}>{fmtDate(v)}</span>,
    },
    {
      key: 'userName', label: 'User', width: '150px',
      render: (v) => <span className={styles.userName}>{v ?? '—'}</span>,
    },
    {
      key: 'actionType', label: 'Action', sortable: true, width: '110px',
      render: (v) => <ActionBadge actionType={v} />,
    },
    {
      key: 'module', label: 'Module', sortable: true, width: '110px',
      render: (v) => <span className={styles.moduleChip}>{v}</span>,
    },
    {
      key: 'entityName', label: 'Entity',
      render: (v) => <span className={styles.entityCell} title={v}>{v ?? '—'}</span>,
    },
    {
      key: 'description', label: 'Details',
      render: (v) => <span className={styles.detailsCell} title={v}>{v ?? '—'}</span>,
    },
    {
      key: 'ipAddress', label: 'IP Address', width: '115px',
      render: (v) => <span className={styles.ipCell}>{v || '—'}</span>,
    },
    {
      key: 'status', label: 'Status', sortable: true, width: '95px',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: '_view', label: '', width: '44px',
      render: (_, row) => (
        <button
          className={styles.viewBtn}
          onClick={(e) => { e.stopPropagation(); setDetailId(row.id); }}
          title="View details"
        >
          <Eye size={13} />
        </button>
      ),
    },
  ], []);

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Activity Log</h1>
          <p className={styles.sub}>Audit trail of all user actions and system events.</p>
        </div>

        <button className={styles.exportBtn} disabled={exporting} onClick={handleExport}>
          <Download size={14} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* ── Filter card ── */}
      <div className={styles.filterCard}>
        <button className={styles.filterToggle} onClick={() => setFiltersOpen((v) => !v)}>
          <Filter size={13} />
          <span>Filters</span>
          {hasActiveFilters && <span className={styles.filterDot} />}
          <ChevronDown size={12} className={`${styles.filterArrow} ${filtersOpen ? styles.filterArrowOpen : ''}`} />
        </button>

        {filtersOpen && (
          <div className={styles.filterGrid}>
            <div className={styles.fg}>
              <label className={styles.flabel}>Date From</label>
              <input type="date" className={styles.finput} value={dateFrom}
                max={dateTo || todayISO()} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className={styles.fg}>
              <label className={styles.flabel}>Date To</label>
              <input type="date" className={styles.finput} value={dateTo}
                min={dateFrom} max={todayISO()} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className={styles.fg}>
              <label className={styles.flabel}>Module</label>
              <select className={styles.fselect} value={modFilter} onChange={(e) => setModFilter(e.target.value)}>
                <option value="">All Modules</option>
                {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className={styles.fg}>
              <label className={styles.flabel}>Action Type</label>
              <select className={styles.fselect} value={actFilter} onChange={(e) => setActFilter(e.target.value)}>
                <option value="">All Actions</option>
                {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className={styles.fg}>
              <label className={styles.flabel}>Status</label>
              <select className={styles.fselect} value={statFilter} onChange={(e) => setStatFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <div className={styles.fg}>
                <label className={styles.flabel}>&nbsp;</label>
                <button className={styles.clearBtn} onClick={clearFilters}>
                  <X size={12} /> Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
        onSearch={setSearch}
        searchPlaceholder="Search by user, action, entity, IP…"
        emptyStateMessage="No activity logs found for the selected criteria."
      />

      {/* ── Detail modal ── */}
      {detailId && (
        <DetailModal logId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
