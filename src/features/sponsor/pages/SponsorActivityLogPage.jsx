/**
 * SponsorActivityLogPage — /sponsor/:studyId/activity-log
 *
 * Full audit trail for study-level actions:
 *   - Date range, module, action type, status filters
 *   - Free-text search
 *   - Sortable DataTable with pagination
 *   - Row click → detail slide-in panel
 *   - CSV export
 *   - Default view: last 7 days, newest first
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Filter, Download, X, ChevronDown,
  Eye, FileText, Clock, User as UserIcon,
  CheckCircle2, TriangleAlert, AlertCircle,
} from 'lucide-react';
import axiosClient from '@/api/sponsorAxiosClient';
import { addToast }  from '@/app/notificationSlice';
import DataTable     from '@/components/data-table/DataTable';
import ExportMenu    from '@/components/data-table/ExportMenu';
import { exportTable } from '@/utils/exportTable';
import { formatDateTime } from '@/utils/formatDate';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
import css from './SponsorActivityLogPage.module.css';

/* ── Constants ───────────────────────────────────────────────────────────── */
const MODULES = [
  'Dashboard', 'Data Capture', 'Consent', 'Queries',
  'Verification', 'Sites', 'Personnel', 'Roles', 'Reports', 'Masters', 'Auth',
];
const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'LOGIN', 'LOGOUT', 'INVITE'];
const STATUSES     = ['SUCCESS', 'FAILURE', 'WARNING'];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmtDate = (ts) => formatDateTime(ts) || '—';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function sevenDaysAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

const ACTIVITY_EXPORT_COLUMNS = [
  { header: 'Timestamp',   accessor: 'timestamp'   },
  { header: 'User',        accessor: 'userName'    },
  { header: 'Action',      accessor: 'actionType'  },
  { header: 'Module',      accessor: 'module'      },
  { header: 'Entity',      accessor: 'entityName'  },
  { header: 'Description', accessor: 'description' },
  { header: 'IP Address',  accessor: 'ipAddress'   },
  { header: 'Status',      accessor: 'status'      },
];

function buildExportRows(items) {
  return items.map((r) => ({
    timestamp:   fmtDate(r.timestamp),
    userName:    r.userName    ?? '',
    actionType:  r.actionType  ?? '',
    module:      r.module      ?? '',
    entityName:  r.entityName  ?? '',
    description: r.description ?? '',
    ipAddress:   r.ipAddress   ?? '',
    status:      r.status      ?? '',
  }));
}

/* ── Status badge ────────────────────────────────────────────────────────── */
function StatusPill({ status }) {
  if (status === 'SUCCESS') return <span className={`${css.badge} ${css.badgeSuccess}`}><CheckCircle2 size={11} /> Success</span>;
  if (status === 'WARNING') return <span className={`${css.badge} ${css.badgeWarning}`}><TriangleAlert size={11} /> Warning</span>;
  return <span className={`${css.badge} ${css.badgeFailure}`}><AlertCircle size={11} /> Failure</span>;
}

/* ── Action badge ────────────────────────────────────────────────────────── */
const ACTION_CLS = {
  CREATE: css.aCreate, UPDATE: css.aUpdate, DELETE: css.aDelete,
  EXPORT: css.aExport, VIEW: css.aView, LOGIN: css.aLogin, LOGOUT: css.aLogin,
  INVITE: css.aInvite,
};
function ActionPill({ type }) {
  return <span className={`${css.actionBadge} ${ACTION_CLS[type] ?? ''}`}>{type}</span>;
}

/* ── Detail Panel ────────────────────────────────────────────────────────── */
function DetailPanel({ log, onClose }) {
  return (
    <div className={css.backdrop} onClick={onClose}>
      <div className={css.panel} onClick={(e) => e.stopPropagation()}>
        <div className={css.panelHead}>
          <div className={css.panelTitleRow}>
            <FileText size={15} className={css.panelIcon} />
            <span className={css.panelTitle}>Activity Detail</span>
          </div>
          <button className={css.panelClose} onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>

        <div className={css.panelBody}>
          <div className={css.detailGrid}>
            {[
              { label: 'Timestamp',   value: fmtDate(log.timestamp), icon: <Clock size={12} /> },
              { label: 'User',        value: log.userName ?? '—',     icon: <UserIcon size={12} /> },
              { label: 'Action',      value: <ActionPill type={log.actionType} /> },
              { label: 'Module',      value: log.module ?? '—' },
              { label: 'Entity Type', value: log.entityType ?? '—' },
              { label: 'Entity Name', value: log.entityName ?? '—' },
              { label: 'Status',      value: <StatusPill status={log.status} /> },
              { label: 'IP Address',  value: log.ipAddress || '—' },
            ].map(({ label, value, icon }) => (
              <div key={label} className={css.dRow}>
                <span className={css.dLabel}>{label}</span>
                <span className={css.dValue}>{icon && <span className={css.dIcon}>{icon}</span>}{value}</span>
              </div>
            ))}
          </div>

          {log.description && (
            <div className={css.section}>
              <p className={css.sectionLabel}>Description</p>
              <p className={css.sectionText}>{log.description}</p>
            </div>
          )}

          {log.failureReason && (
            <div className={css.section}>
              <p className={css.sectionLabel}>Failure Reason</p>
              <p className={`${css.sectionText} ${css.sectionDanger}`}>{log.failureReason}</p>
            </div>
          )}

          {(log.beforeValue || log.afterValue) && (
            <div className={css.section}>
              <p className={css.sectionLabel}>Changes</p>
              <div className={css.diffRow}>
                <div className={css.diffCol}>
                  <p className={css.diffLabel}>Before</p>
                  <pre className={`${css.diffBox} ${css.diffBefore}`}>
                    {log.beforeValue ? JSON.stringify(log.beforeValue, null, 2) : '—'}
                  </pre>
                </div>
                <div className={css.diffCol}>
                  <p className={css.diffLabel}>After</p>
                  <pre className={`${css.diffBox} ${css.diffAfter}`}>
                    {log.afterValue ? JSON.stringify(log.afterValue, null, 2) : '—'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={css.panelFoot}>
          <button className={css.btnClose} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function SponsorActivityLogPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();

  const [dateFrom,    setDateFrom]    = useState(sevenDaysAgoISO);
  const [dateTo,      setDateTo]      = useState(todayISO);
  const [modFilter,   setModFilter]   = useState('');
  const [actFilter,   setActFilter]   = useState('');
  const [statFilter,  setStatFilter]  = useState('');
  const [userFilter,  setUserFilter]  = useState('');
  const [search,      setSearch]      = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const [page,      setPage]      = useState(1);
  const [pageSize,  setPageSize]  = useState(50);
  const [detailLog, setDetailLog] = useState(null);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback(() => ({
    page, pageSize,
    search:     search     || undefined,
    module:     modFilter  || undefined,
    actionType: actFilter  || undefined,
    status:     statFilter || undefined,
    user:       userFilter || undefined,
    dateFrom:   dateFrom   || undefined,
    dateTo:     dateTo     || undefined,
  }), [page, pageSize, search, modFilter, actFilter, statFilter, userFilter, dateFrom, dateTo]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res    = await axiosClient.get(`/api/v1/sponsor/workspace/activity-logs`, { params });
      const arr    = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setItems(arr);
      setTotal(res?.pagination?.total ?? res?.total ?? arr.length);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load activity logs.' }));
    } finally {
      setLoading(false);
    }
  }, [studyId, buildParams, dispatch]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [search, modFilter, actFilter, statFilter, userFilter, dateFrom, dateTo]);

  const hasActiveFilters = modFilter || actFilter || statFilter || userFilter ||
    dateFrom !== sevenDaysAgoISO() || dateTo !== todayISO();

  const clearFilters = () => {
    setDateFrom(sevenDaysAgoISO()); setDateTo(todayISO());
    setModFilter(''); setActFilter(''); setStatFilter(''); setUserFilter('');
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const filename = `ActivityLog_Study${studyId}_${new Date().toISOString().slice(0, 10)}`;
      exportTable(format, {
        columns:  ACTIVITY_EXPORT_COLUMNS,
        rows:     buildExportRows(items),
        filename,
        sheetName: 'Activity Log',
        title:     'Activity Log',
      });
      dispatch(addToast({ type: 'success', message: 'Activity log exported successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export Activity Log. Please try again.' }));
    } finally {
      setExporting(false);
    }
  };

  /* ── Filtered rows (client-side search if API doesn't filter) ── */
  const visibleItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((r) =>
      [r.userName, r.actionType, r.module, r.entityName, r.description, r.ipAddress]
        .some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [items, search]);

  /* ── Columns ── */
  const columns = useMemo(() => [
    {
      key: 'timestamp', label: 'Timestamp', sortable: true, width: '155px',
      render: (v) => <span className={css.tsCell}>{fmtDate(v)}</span>,
    },
    {
      key: 'userName', label: 'User', width: '140px',
      render: (v) => <span className={css.userName}>{v ?? '—'}</span>,
    },
    {
      key: 'actionType', label: 'Action', sortable: true, width: '110px',
      render: (v) => <ActionPill type={v} />,
    },
    {
      key: 'module', label: 'Module', sortable: true, width: '120px',
      render: (v) => <span className={css.moduleChip}>{v ?? '—'}</span>,
    },
    {
      key: 'entityName', label: 'Entity',
      render: (v) => <span className={css.cellTrunc} title={v}>{v ?? '—'}</span>,
    },
    {
      key: 'description', label: 'Details',
      render: (v) => <span className={css.cellTrunc} title={v}>{v ?? '—'}</span>,
    },
    {
      key: 'ipAddress', label: 'IP Address', width: '115px',
      render: (v) => <span className={css.ipCell}>{v || '—'}</span>,
    },
    {
      key: 'status', label: 'Status', sortable: true, width: '95px',
      render: (v) => <StatusPill status={v} />,
    },
    {
      key: '_view', label: '', width: '44px',
      render: (_, row) => (
        <button
          className={css.viewBtn}
          onClick={(e) => { e.stopPropagation(); setDetailLog(row); }}
          title="View details"
        >
          <Eye size={13} />
        </button>
      ),
    },
  ], []);

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Activity Log</h1>
          <p className={css.sub}>Full audit trail of all study-level user actions and system events.</p>
        </div>
        <ExportMenu
          disabled={exporting || items.length === 0}
          label={exporting ? 'Exporting…' : 'Export'}
          onExport={handleExport}
        />
      </div>

      {/* Filter card */}
      <div className={css.filterCard}>
        <button className={css.filterToggle} onClick={() => setFiltersOpen((v) => !v)}>
          <Filter size={13} />
          <span>Filters</span>
          {hasActiveFilters && <span className={css.filterDot} />}
          <ChevronDown size={12} className={`${css.filterArrow} ${filtersOpen ? css.filterArrowOpen : ''}`} />
        </button>

        {filtersOpen && (
          <div className={css.filterGrid}>
            <div className={css.fg}>
              <label className={css.flabel}>Date From</label>
              <PlatformDatePicker className={css.finput} value={dateFrom}
                max={dateTo || todayISO()} onChange={setDateFrom} />
            </div>
            <div className={css.fg}>
              <label className={css.flabel}>Date To</label>
              <PlatformDatePicker className={css.finput} value={dateTo}
                min={dateFrom} max={todayISO()} onChange={setDateTo} />
            </div>
            <div className={css.fg}>
              <label className={css.flabel}>Module</label>
              <select className={css.fselect} value={modFilter} onChange={(e) => setModFilter(e.target.value)}>
                <option value="">All Modules</option>
                {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className={css.fg}>
              <label className={css.flabel}>Action Type</label>
              <select className={css.fselect} value={actFilter} onChange={(e) => setActFilter(e.target.value)}>
                <option value="">All Actions</option>
                {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className={css.fg}>
              <label className={css.flabel}>Status</label>
              <select className={css.fselect} value={statFilter} onChange={(e) => setStatFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={css.fg}>
              <label className={css.flabel}>User</label>
              <input
                type="text"
                className={css.finput}
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Filter by user name or email…"
              />
            </div>
            {hasActiveFilters && (
              <div className={css.fg}>
                <label className={css.flabel}>&nbsp;</label>
                <button className={css.clearBtn} onClick={clearFilters}><X size={12} /> Clear</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={visibleItems}
        loading={loading}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
        onSearch={setSearch}
        searchPlaceholder="Search by user, action, module, entity, IP…"
        emptyStateMessage="No activity logs found for the selected criteria."
      />

      {/* Detail panel */}
      {detailLog && <DetailPanel log={detailLog} onClose={() => setDetailLog(null)} />}
    </div>
  );
}
