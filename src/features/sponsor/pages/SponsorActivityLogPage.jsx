/**
 * SponsorActivityLogPage — /sponsor/:studyId/activity-log
 *
 * Study-level audit trail. UI is intentionally identical to the CRO Activity
 * Log (it imports the same CSS module + mirrors its components) so both
 * workspaces present one consistent experience:
 *   - Filter card (date / module / action / status / severity / user)
 *   - DataTable with Severity column
 *   - Centered detail modal with a human-readable Field / Old / New change
 *     table (never raw JSON) + reason section + styled scrollbar
 *
 * Data comes from the tenant `activity_log` via /sponsor/workspace/activity-logs.
 * That endpoint doesn't filter server-side, so we load the recent set once and
 * do filtering + pagination on the client.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Filter, X, ChevronDown,
  Eye, FileText, Clock, User as UserIcon,
  Monitor, AlertCircle, CheckCircle2, TriangleAlert,
} from 'lucide-react';
import axiosClient from '@/api/sponsorAxiosClient';
import { addToast }  from '@/app/notificationSlice';
import DataTable     from '@/components/data-table/DataTable';
import ExportMenu    from '@/components/data-table/ExportMenu';
import { exportTable } from '@/utils/exportTable';
import { formatDateTime } from '@/utils/formatDate';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
// Reuse the CRO Activity Log stylesheet so the two pages are pixel-identical.
import styles from '@/features/cro/pages/activity-log/ActivityLogPage.module.css';

/* ── Constants ───────────────────────────────────────────────────────────── */
const MODULES = [
  'Subject', 'CRF Form', 'Consent', 'Query', 'Verification',
  'Site', 'Personnel', 'Site Role', 'Auth',
];
const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'LOGIN', 'LOGOUT', 'INVITE', 'FORM_SUBMITTED', 'DATA_UPDATED'];
const STATUSES    = ['SUCCESS', 'FAILURE', 'WARNING'];
const SEVERITIES  = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmtDate = (ts) => formatDateTime(ts) || '—';
function todayISO() { return new Date().toISOString().slice(0, 10); }
function sevenDaysAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// Friendly labels for raw resource_type values stored on the tenant log.
const MODULE_LABELS = {
  subject_form_data: 'CRF Form',
  subject:           'Subject',
  site_role:         'Site Role',
};
const moduleLabel = (m) => (m ? (MODULE_LABELS[m] ?? m) : '');

// Derive a severity / risk from the action so the Severity column is meaningful
// (the tenant log doesn't store one). Mirrors the backend writer's defaults.
const HIGH_RISK = new Set(['DELETE', 'REVOKE', 'LOCK', 'UNLOCK']);
function deriveSeverity(action, status) {
  if (status === 'FAILURE') return 'HIGH';
  if (HIGH_RISK.has(action)) return 'HIGH';
  if (action === 'UPDATE' || action === 'DATA_UPDATED' || action === 'FORM_SUBMITTED' || action === 'APPROVE') return 'MEDIUM';
  if (action === 'LOGIN' || action === 'LOGOUT' || action === 'VIEW') return 'LOW';
  return 'INFO';
}
function deriveRisk(action, status) {
  if (status === 'FAILURE' && action === 'LOGIN') return 'HIGH';
  if (HIGH_RISK.has(action)) return 'HIGH';
  if (action === 'UPDATE' || action === 'DELETE' || action === 'DATA_UPDATED') return 'MEDIUM';
  return 'LOW';
}

// Normalize a tenant activity row into the CRO `log` shape so the shared
// components render it. Folds metadata.changes (+ any status prev→new) into a
// single human-readable change list; never surfaces raw JSON.
function normalizeRow(raw) {
  const md = raw.metadata ?? {};
  const action = raw.actionType ?? raw.action ?? '';
  const status = raw.status ?? 'SUCCESS';

  const changes = [];
  if (Array.isArray(md.changes)) {
    for (const c of md.changes) {
      const prev = c.previous_value;
      const next = c.new_value;
      changes.push({
        label: c.field_label ?? c.field ?? 'Field',
        oldValue: prev,
        newValue: next,
        changeType: prev == null ? 'ADDED' : next == null ? 'REMOVED' : 'UPDATED',
      });
    }
  }
  // A standalone status transition (e.g. Submit / Reopen) with no field diff.
  if (!changes.length && (md.previous_value != null || md.new_value != null)) {
    changes.push({ label: 'Status', oldValue: md.previous_value, newValue: md.new_value, changeType: 'UPDATED' });
  }

  return {
    id: raw.id ?? raw.activity_id,
    timestamp: raw.timestamp ?? raw.created_at,
    userName: raw.userName ?? raw.actor_name ?? md.actor_name ?? '—',
    roleName: raw.roleName ?? null,
    actionType: action,
    module: moduleLabel(raw.module ?? raw.entityType ?? raw.resource_type),
    category: md.category ?? null,
    entityType: moduleLabel(raw.entityType ?? raw.resource_type) || '—',
    entityName: raw.entityName ?? md.subject_number ?? md.form_name ?? '—',
    subjectName: md.subject_number ?? md.subject_name ?? null,
    description: raw.description ?? md.description ?? null,
    reason: md.reason ?? null,
    severity: deriveSeverity(action, status),
    riskLevel: deriveRisk(action, status),
    status,
    ipAddress: raw.ipAddress ?? raw.ip_address ?? null,
    changes,
    deletedCounts: raw.deletedCounts ?? md.deleted_counts ?? null,
    failureReason: raw.failureReason ?? null,
  };
}

/* ── Status badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  if (status === 'SUCCESS') return <span className={`${styles.badge} ${styles.badgeSuccess}`}><CheckCircle2 size={11} /> Success</span>;
  if (status === 'WARNING') return <span className={`${styles.badge} ${styles.badgeWarning}`}><TriangleAlert size={11} /> Warning</span>;
  return <span className={`${styles.badge} ${styles.badgeFailure}`}><AlertCircle size={11} /> Failure</span>;
}

/* ── Action badge ────────────────────────────────────────────────────────── */
const ACTION_CLS = {
  CREATE: styles.aCreated, UPDATE: styles.aUpdated, DELETE: styles.aDeleted,
  EXPORT: styles.aExported, LOGIN: styles.aLogin, LOGOUT: styles.aLogin,
};
function ActionBadge({ actionType }) {
  return <span className={`${styles.actionBadge} ${ACTION_CLS[actionType] ?? ''}`}>{actionType}</span>;
}

/* ── Severity badge ──────────────────────────────────────────────────────── */
const SEVERITY_CLS = {
  CRITICAL: styles.sevCritical, HIGH: styles.sevHigh, MEDIUM: styles.sevMedium,
  LOW: styles.sevLow, INFO: styles.sevInfo,
};
function SeverityBadge({ severity }) {
  if (!severity) return <span className={styles.muted}>—</span>;
  return <span className={`${styles.sevBadge} ${SEVERITY_CLS[severity] ?? styles.sevInfo}`}>{severity}</span>;
}

/* ── Human-readable changes table ───────────────────────────────────────── */
const renderCell = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(', ');
  return String(v);
};
function ChangesTable({ log }) {
  const rows = Array.isArray(log.changes) ? log.changes : [];
  if (!rows.length) return null;
  return (
    <div className={styles.mSection}>
      <p className={styles.mSectionLabel}>Changes</p>
      <table className={styles.changeTable}>
        <thead><tr><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={styles.changeField}>{r.label}</td>
              <td className={styles.changeOld}>{renderCell(r.oldValue)}</td>
              <td className={styles.changeNew}>{renderCell(r.newValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Detail Modal (centered — identical to CRO) ─────────────────────────── */
function DetailModal({ log, onClose }) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.mHead}>
          <div className={styles.mTitleWrap}>
            <FileText size={15} className={styles.mTitleIcon} />
            <span className={styles.mTitle}>Activity Detail</span>
          </div>
          <button className={styles.mClose} onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>

        <div className={styles.mBody}>
          <div className={styles.detailGrid}>
            {[
              { label: 'Timestamp',   value: fmtDate(log.timestamp), icon: <Clock size={12} /> },
              { label: 'User',        value: log.userName ?? '—',     icon: <UserIcon size={12} /> },
              ...(log.roleName ? [{ label: 'Role', value: log.roleName }] : []),
              { label: 'Action',      value: <ActionBadge actionType={log.actionType} /> },
              { label: 'Module',      value: log.module || '—' },
              ...(log.category ? [{ label: 'Category', value: log.category }] : []),
              { label: 'Entity Type', value: log.entityType ?? '—' },
              { label: 'Entity Name', value: log.entityName ?? '—' },
              ...(log.subjectName ? [{ label: 'Subject', value: log.subjectName }] : []),
              { label: 'Severity',    value: <SeverityBadge severity={log.severity} /> },
              ...(log.riskLevel ? [{ label: 'Risk Level', value: log.riskLevel }] : []),
              { label: 'Status',      value: <StatusBadge status={log.status} /> },
              { label: 'IP Address',  value: log.ipAddress || '—', icon: <Monitor size={12} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className={styles.dRow}>
                <span className={styles.dLabel}>{label}</span>
                <span className={styles.dValue}>{icon && <span className={styles.dIcon}>{icon}</span>}{value}</span>
              </div>
            ))}
          </div>

          {log.reason && (
            <div className={styles.mSection}>
              <p className={styles.mSectionLabel}>Reason for Change</p>
              <p className={styles.mDesc}>{log.reason}</p>
            </div>
          )}

          {log.deletedCounts && (
            <div className={styles.mSection}>
              <p className={styles.mSectionLabel}>Deleted Records</p>
              <p className={styles.mDesc}>
                {Object.entries(log.deletedCounts)
                  .filter(([, n]) => Number(n) > 0)
                  .map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`)
                  .join(' · ') || 'No child records'}
              </p>
            </div>
          )}

          {/* Human-readable Field / Old / New changes — never raw JSON */}
          <ChangesTable log={log} />

          {log.failureReason && (
            <div className={styles.mSection}>
              <p className={styles.mSectionLabel}>Failure Reason</p>
              <p className={`${styles.mDesc} ${styles.mDescDanger}`}>{log.failureReason}</p>
            </div>
          )}
        </div>

        <div className={styles.mFoot}>
          <button className={styles.mCloseBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_EXPORT_COLUMNS = [
  { header: 'Timestamp',   accessor: 'timestamp'   },
  { header: 'User',        accessor: 'userName'    },
  { header: 'Action',      accessor: 'actionType'  },
  { header: 'Module',      accessor: 'module'      },
  { header: 'Entity',      accessor: 'entityName'  },
  { header: 'Severity',    accessor: 'severity'    },
  { header: 'Description', accessor: 'description' },
  { header: 'IP Address',  accessor: 'ipAddress'   },
  { header: 'Status',      accessor: 'status'      },
];
function buildExportRows(items) {
  return items.map((r) => ({
    timestamp:   fmtDate(r.timestamp),
    userName:    r.userName    ?? '—',
    actionType:  r.actionType  ?? '—',
    module:      r.module       || '—',
    entityName:  r.entityName  ?? '—',
    severity:    r.severity    ?? '—',
    description: r.description ?? '—',
    ipAddress:   r.ipAddress   ?? '—',
    status:      r.status      ?? '—',
  }));
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function SponsorActivityLogPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();

  /* Filters */
  const [dateFrom,    setDateFrom]    = useState(sevenDaysAgoISO);
  const [dateTo,      setDateTo]      = useState(todayISO);
  const [modFilter,   setModFilter]   = useState('');
  const [actFilter,   setActFilter]   = useState('');
  const [statFilter,  setStatFilter]  = useState('');
  const [sevFilter,   setSevFilter]   = useState('');
  const [userFilter,  setUserFilter]  = useState('');
  const [search,      setSearch]      = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  /* Data + pagination (client-side: endpoint doesn't filter) */
  const [allItems, setAllItems] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [detailLog, setDetailLog] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get(`/api/v1/sponsor/workspace/activity-logs`, {
        params: { page: 1, pageSize: 1000 },
      });
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setAllItems(arr.map(normalizeRow));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load activity logs.' }));
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [studyId, dispatch]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [search, modFilter, actFilter, statFilter, sevFilter, userFilter, dateFrom, dateTo]);

  /* Client-side filtering */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((r) => {
      if (modFilter && r.module !== modFilter) return false;
      if (actFilter && r.actionType !== actFilter) return false;
      if (statFilter && r.status !== statFilter) return false;
      if (sevFilter && r.severity !== sevFilter) return false;
      if (userFilter && !(r.userName ?? '').toLowerCase().includes(userFilter.toLowerCase())) return false;
      if (dateFrom || dateTo) {
        const day = r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 10) : '';
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
      }
      if (q) {
        const hay = [r.userName, r.actionType, r.module, r.entityName, r.description, r.ipAddress]
          .map((v) => (v ?? '').toString().toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, search, modFilter, actFilter, statFilter, sevFilter, userFilter, dateFrom, dateTo]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const hasActiveFilters = modFilter || actFilter || statFilter || sevFilter || userFilter ||
    dateFrom !== sevenDaysAgoISO() || dateTo !== todayISO();

  const clearFilters = () => {
    setDateFrom(sevenDaysAgoISO()); setDateTo(todayISO());
    setModFilter(''); setActFilter(''); setStatFilter(''); setSevFilter(''); setUserFilter('');
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const filename = `ActivityLog_Study${studyId}_${new Date().toISOString().slice(0, 10)}`;
      exportTable(format, {
        columns:  ACTIVITY_EXPORT_COLUMNS,
        rows:     buildExportRows(filtered),
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

  /* Columns — identical to CRO */
  const columns = useMemo(() => [
    { key: 'timestamp', label: 'Timestamp', sortable: true, width: '155px', render: (v) => <span className={styles.tsCell}>{fmtDate(v)}</span> },
    { key: 'userName', label: 'User', width: '150px', render: (v) => <span className={styles.userName}>{v ?? '—'}</span> },
    { key: 'actionType', label: 'Action', sortable: true, width: '110px', render: (v) => <ActionBadge actionType={v} /> },
    { key: 'module', label: 'Module', sortable: true, width: '120px', render: (v) => <span className={styles.moduleChip}>{v || '—'}</span> },
    { key: 'ipAddress', label: 'IP Address', width: '115px', render: (v) => <span className={styles.ipCell}>{v || '—'}</span> },
    { key: 'severity', label: 'Severity', sortable: true, width: '95px', render: (v) => <SeverityBadge severity={v} /> },
    { key: 'status', label: 'Status', sortable: true, width: '95px', render: (v) => <StatusBadge status={v} /> },
    {
      key: '_view', label: '', width: '44px',
      render: (_, row) => (
        <button className={styles.viewBtn} onClick={(e) => { e.stopPropagation(); setDetailLog(row); }} title="View details">
          <Eye size={13} />
        </button>
      ),
    },
  ], []);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Activity Log</h1>
          <p className={styles.sub}>Full audit trail of all study-level user actions and system events.</p>
        </div>
        <ExportMenu
          disabled={exporting || filtered.length === 0}
          label={exporting ? 'Exporting…' : 'Export'}
          onExport={handleExport}
        />
      </div>

      {/* Filter card */}
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
              <PlatformDatePicker className={styles.finput} value={dateFrom} max={dateTo || todayISO()} onChange={setDateFrom} />
            </div>
            <div className={styles.fg}>
              <label className={styles.flabel}>Date To</label>
              <PlatformDatePicker className={styles.finput} value={dateTo} min={dateFrom} max={todayISO()} onChange={setDateTo} />
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
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.fg}>
              <label className={styles.flabel}>Severity</label>
              <select className={styles.fselect} value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}>
                <option value="">All Severities</option>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.fg}>
              <label className={styles.flabel}>User</label>
              <input type="text" className={styles.finput} value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)} placeholder="Filter by user name or email…" />
            </div>
            {hasActiveFilters && (
              <div className={styles.fg}>
                <label className={styles.flabel}>&nbsp;</label>
                <button className={styles.clearBtn} onClick={clearFilters}><X size={12} /> Clear</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={paged}
        loading={loading}
        totalCount={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
        onSearch={setSearch}
        searchPlaceholder="Search by user, action, module, entity, IP…"
        emptyStateMessage="No activity logs found for the selected criteria."
      />

      {/* Detail modal */}
      {detailLog && <DetailModal log={detailLog} onClose={() => setDetailLog(null)} />}
    </div>
  );
}
