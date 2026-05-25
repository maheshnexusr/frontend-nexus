/**
 * ReportsPage — /sponsor/:studyId/reports
 *
 * Lists available report types (enrollment, data completeness, queries, sites,
 * audit) and previously generated reports. Users can generate new reports,
 * download existing ones, or delete stale ones.
 *
 * Report generation is async — status polls every few seconds until done.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Download, RefreshCw, Trash2, FileText,
  BarChart2, Users, MapPin, ShieldCheck,
  ClipboardList, Clock, CheckCircle2, AlertCircle,
  Plus, X, Filter,
} from 'lucide-react';
import axiosClient  from '@/api/sponsorAxiosClient';
import { addToast } from '@/app/notificationSlice';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
import { formatDateTime } from '@/utils/formatDate';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
import { usePermissions } from '@/features/auth/usePermissions';
import css from './ReportsPage.module.css';

/**
 * Map a report row's `reportType` to the action key on the `reports` permission
 * leaf that gates its Download button. The five spec'd download permissions
 * cover the five named reports; anything outside that list falls back to the
 * blanket `reports.export` permission so unknown / future report types stay
 * gateable by the existing role catalogue.
 */
const REPORT_DOWNLOAD_ACTION = {
  enrollment:        'download_enrollment',
  data_completeness: 'download_data_completeness',
  query_summary:     'download_queries',
  site_performance:  'download_sites',
  audit_trail:       'download_audit',
};

/* ── Report type catalogue ───────────────────────────────────────────────── */
const REPORT_TYPES = [
  {
    type:        'enrollment',
    label:       'Enrollment Report',
    description: 'Subject enrollment by site, over time — includes screening, enrolled, completed, withdrawn.',
    icon:        Users,
    iconColor:   '#2563eb',
    iconBg:      '#eff6ff',
  },
  {
    type:        'data_completeness',
    label:       'Data Completeness',
    description: 'CRF completion rates per subject, site, and visit — highlights missing or incomplete data.',
    icon:        ClipboardList,
    iconColor:   '#059669',
    iconBg:      '#ecfdf5',
  },
  {
    type:        'query_summary',
    label:       'Query Summary',
    description: 'Open, resolved, and overdue queries by site, data manager, and query type.',
    icon:        BarChart2,
    iconColor:   '#d97706',
    iconBg:      '#fffbeb',
  },
  {
    type:        'site_performance',
    label:       'Site Performance',
    description: 'Per-site KPIs: enrollment rate, query rate, protocol deviations, data entry timeliness.',
    icon:        MapPin,
    iconColor:   '#7c3aed',
    iconBg:      '#f5f3ff',
  },
  {
    type:        'data_verification',
    label:       'Data Verification',
    description: 'Verification and approval status by subject, site, and reviewer.',
    icon:        ShieldCheck,
    iconColor:   '#0ea5e9',
    iconBg:      '#f0f9ff',
  },
  {
    type:        'audit_trail',
    label:       'Audit Trail Report',
    description: 'Full audit export of all create, update, delete, and login events with timestamps and IPs.',
    icon:        FileText,
    iconColor:   '#64748b',
    iconBg:      '#f1f5f9',
  },
];

/* ── Status meta ─────────────────────────────────────────────────────────── */
const STATUS_META = {
  Pending:    { label: 'Pending',    cls: css.sPending,    icon: <Clock size={11} /> },
  Generating: { label: 'Generating', cls: css.sGenerating, icon: <RefreshCw size={11} className={css.spin} /> },
  Ready:      { label: 'Ready',      cls: css.sReady,      icon: <CheckCircle2 size={11} /> },
  Failed:     { label: 'Failed',     cls: css.sFailed,     icon: <AlertCircle size={11} /> },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmtDate = (ts) => formatDateTime(ts) || '—';

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ── Generate Report dialog ──────────────────────────────────────────────── */
function GenerateDialog({ reportType, studyId, onClose, onGenerated, dispatch }) {
  const rt    = REPORT_TYPES.find((r) => r.type === reportType);
  const Icon  = rt?.icon ?? FileText;

  const today = new Date().toISOString().slice(0, 10);
  const ago90 = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();

  const [dateFrom, setDateFrom] = useState(ago90);
  const [dateTo,   setDateTo]   = useState(today);
  const [format,   setFormat]   = useState('xlsx');
  const [saving,   setSaving]   = useState(false);

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const res = await axiosClient.post(`/api/v1/sponsor/workspace/reports`, {
        reportType, dateFrom, dateTo, format,
      });
      const item = res?.item ?? res;
      onGenerated(item);
      dispatch(addToast({ type: 'success', message: `${rt?.label} report is being generated.` }));
      onClose();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to queue report generation. Please try again.' }));
      setSaving(false);
    }
  };

  return (
    <div className={css.dialogOverlay} onClick={onClose}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={css.dialogHead}>
          <div className={css.dialogTitleRow}>
            <div className={css.dialogIconWrap} style={{ background: rt?.iconBg }}>
              <Icon size={16} style={{ color: rt?.iconColor }} />
            </div>
            <div>
              <p className={css.dialogTitle}>Generate {rt?.label}</p>
              <p className={css.dialogSub}>{rt?.description}</p>
            </div>
          </div>
          <button className={css.dialogClose} onClick={onClose}><X size={15} /></button>
        </div>

        <div className={css.dialogBody}>
          <div className={css.dGrid}>
            <div className={css.df}>
              <label className={css.dlabel}>Date From</label>
              <PlatformDatePicker className={css.dinput} value={dateFrom}
                max={dateTo} onChange={setDateFrom} />
            </div>
            <div className={css.df}>
              <label className={css.dlabel}>Date To</label>
              <PlatformDatePicker className={css.dinput} value={dateTo}
                min={dateFrom} max={today} onChange={setDateTo} />
            </div>
            <div className={css.df}>
              <label className={css.dlabel}>Format</label>
              <select className={css.dselect} value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
            </div>
          </div>
        </div>

        <div className={css.dialogFoot}>
          <button className={css.btnCancel} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={css.btnGenerate} onClick={handleGenerate} disabled={saving}>
            {saving ? 'Queuing…' : 'Generate Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ReportsPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const { has }     = usePermissions();
  // Per-report download gate. Each report type has its own permission key on
  // the `reports` leaf; if a role lacks the specific download for a report,
  // we also accept the blanket `reports.export` as a fallback so legacy roles
  // that only got the blanket permission continue to work.
  const canDownload = (reportType) => {
    const action = REPORT_DOWNLOAD_ACTION[reportType];
    if (action && has('reports', action)) return true;
    return has('reports', 'export');
  };

  const [tab,          setTab]          = useState('catalogue');
  const [reports,      setReports]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [typeFilter,   setTypeFilter]   = useState('');
  const [statFilter,   setStatFilter]   = useState('');
  const [generateType, setGenerateType] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);

  const loadReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await axiosClient.get(`/api/v1/sponsor/workspace/reports`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setReports(arr.map((r) => ({
        id:         r.report_id ?? r.id,
        reportType: r.report_type ?? r.reportType,
        label:      REPORT_TYPES.find((t) => t.type === (r.report_type ?? r.reportType))?.label ?? r.reportType,
        status:     r.status ?? 'Pending',
        format:     r.format ?? 'xlsx',
        dateFrom:   r.date_from ?? r.dateFrom,
        dateTo:     r.date_to   ?? r.dateTo,
        fileSize:   r.file_size ?? r.fileSize,
        createdBy:  r.created_by ?? r.createdBy ?? '—',
        createdAt:  r.created_at ?? r.createdAt,
        downloadUrl:r.download_url ?? r.downloadUrl,
      })));
    } catch {
      if (!silent) dispatch(addToast({ type: 'error', message: 'Failed to load reports.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studyId, dispatch]);

  useEffect(() => { loadReports(); }, [loadReports]);

  /* Auto-refresh while any report is Pending or Generating */
  useEffect(() => {
    const hasInProgress = reports.some((r) => r.status === 'Pending' || r.status === 'Generating');
    if (!hasInProgress) return;
    const t = setTimeout(() => loadReports(true), 5000);
    return () => clearTimeout(t);
  }, [reports, loadReports]);

  const handleDownload = async (report) => {
    if (report.downloadUrl) {
      window.open(report.downloadUrl, '_blank');
      return;
    }
    try {
      await axiosClient.get(`/api/v1/sponsor/workspace/reports/${report.id}/download`, { responseType: 'blob' });
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to download report. Please try again.' }));
    }
  };

  const handleDelete = async () => {
    try {
      await axiosClient.delete(`/api/v1/sponsor/workspace/reports/${deleteTarget.id}`);
      dispatch(addToast({ type: 'success', message: 'Report deleted successfully.' }));
      setDeleteTarget(null);
      loadReports(true);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to delete report. Please try again.' }));
    }
  };

  const filteredReports = useMemo(() => reports.filter((r) => {
    const matchType = !typeFilter || r.reportType === typeFilter;
    const matchStat = !statFilter || r.status === statFilter;
    return matchType && matchStat;
  }), [reports, typeFilter, statFilter]);

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Reports</h1>
          <p className={css.sub}>Generate and download study data reports in Excel, CSV, or PDF format.</p>
        </div>
        <div className={css.headerActions}>
          {tab === 'generated' && (
            <button className={css.btnRefresh} onClick={() => loadReports(true)} disabled={refreshing} title="Refresh">
              <RefreshCw size={15} className={refreshing ? css.spin : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={css.tabs}>
        <button className={`${css.tab} ${tab === 'catalogue' ? css.tabActive : ''}`} onClick={() => setTab('catalogue')}>
          Available Reports
        </button>
        <button className={`${css.tab} ${tab === 'generated' ? css.tabActive : ''}`} onClick={() => setTab('generated')}>
          Generated Reports
          {reports.length > 0 && <span className={css.tabBadge}>{reports.length}</span>}
        </button>
      </div>

      {/* Catalogue tab */}
      {tab === 'catalogue' && (
        <div className={css.catalogue}>
          {REPORT_TYPES.map((rt) => {
            const Icon = rt.icon;
            return (
              <div key={rt.type} className={css.reportCard}>
                <div className={css.cardIconWrap} style={{ background: rt.iconBg }}>
                  <Icon size={20} style={{ color: rt.iconColor }} />
                </div>
                <div className={css.cardBody}>
                  <p className={css.cardTitle}>{rt.label}</p>
                  <p className={css.cardDesc}>{rt.description}</p>
                </div>
                <button
                  className={css.btnGenerate}
                  onClick={() => { setGenerateType(rt.type); setTab('catalogue'); }}
                >
                  <Plus size={14} /> Generate
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Generated tab */}
      {tab === 'generated' && (
        <>
          <div className={css.toolbar}>
            <div className={css.toolbarLeft}>
              <Filter size={13} className={css.filterIcon} />
              <select className={css.tselect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Report Types</option>
                {REPORT_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
              </select>
              <select className={css.tselect} value={statFilter} onChange={(e) => setStatFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <span className={css.count}>{filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className={css.loadingWrap}>
              {[1,2,3].map((i) => <div key={i} className={css.skeleton} />)}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className={css.empty}>
              <FileText size={40} strokeWidth={1.25} className={css.emptyIcon} />
              <p className={css.emptyTitle}>No reports yet</p>
              <p className={css.emptySub}>
                Switch to <button className={css.linkBtn} onClick={() => setTab('catalogue')}>Available Reports</button> to generate one.
              </p>
            </div>
          ) : (
            <div className={css.reportsList}>
              {filteredReports.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.Pending;
                const rt   = REPORT_TYPES.find((t) => t.type === r.reportType);
                const Icon = rt?.icon ?? FileText;
                return (
                  <div key={r.id} className={css.reportRow}>
                    <div className={css.reportRowIcon} style={{ background: rt?.iconBg ?? '#f1f5f9' }}>
                      <Icon size={16} style={{ color: rt?.iconColor ?? '#64748b' }} />
                    </div>
                    <div className={css.reportRowBody}>
                      <div className={css.reportRowTop}>
                        <span className={css.reportRowLabel}>{r.label}</span>
                        <span className={`${css.statusBadge} ${meta.cls}`}>{meta.icon}{meta.label}</span>
                      </div>
                      <div className={css.reportRowMeta}>
                        <span>{r.dateFrom ? `${r.dateFrom} → ${r.dateTo}` : 'All dates'}</span>
                        <span>·</span>
                        <span className={css.formatTag}>{(r.format ?? 'xlsx').toUpperCase()}</span>
                        {r.fileSize && <><span>·</span><span>{fmtSize(r.fileSize)}</span></>}
                        <span>·</span>
                        <span>Generated {fmtDate(r.createdAt)}</span>
                        <span>·</span>
                        <span>by {r.createdBy}</span>
                      </div>
                    </div>
                    <div className={css.reportRowActions}>
                      {r.status === 'Ready' && canDownload(r.reportType) && (
                        <button className={`${css.rowBtn} ${css.rowBtnDownload}`} title="Download" onClick={() => handleDownload(r)}>
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        className={`${css.rowBtn} ${css.rowBtnDelete}`}
                        title="Delete"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Generate dialog */}
      {generateType && (
        <GenerateDialog
          reportType={generateType}
          studyId={studyId}
          dispatch={dispatch}
          onClose={() => setGenerateType(null)}
          onGenerated={(item) => {
            setReports((prev) => [item, ...prev]);
            setTab('generated');
          }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Report"
        message={`Delete the report "${deleteTarget?.label}"? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
