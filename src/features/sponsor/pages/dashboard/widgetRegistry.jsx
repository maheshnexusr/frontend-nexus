import KpiCard       from './widgets/KpiCard';
import BarWidget     from './widgets/BarWidget';
import DonutWidget   from './widgets/DonutWidget';
import HeatmapWidget from './widgets/HeatmapWidget';
import AlertsWidget  from './widgets/AlertsWidget';
import { resolveStudyConfig } from '@/features/cro/utils/studyConfigGating';

const fmtPct  = (v) => (v != null ? `${Math.round(v)}%` : '—');
const fmtDays = (v) => (v != null ? `${Number(v).toFixed(1)} days` : '—');

/* Read a Step 3 toggle from a config object, normalizing across the
   legacy (consentEnabled / queryEnabled / dataManagerEnabled / navBarEnabled)
   and current (consentManager / queryManager / dataManager /
   verificationManager / navigationBar) shapes. */
const cfgFlag = (cfg, key) => resolveStudyConfig(cfg)[key] !== false;

/**
 * Each widget entry:
 *   id, title, category, chart: 'kpi' | 'bar' | 'donut' | 'heatmap' | 'alerts'
 *   visibleByDefault: boolean            (default shown when no user config)
 *   requires: (study, config) => boolean (hard gate — user config cannot override)
 *   render(data, { drillDown })          (React element)
 *   exportRows(data) → array<object>      (flat rows with shared keys: widget, label, value)
 */
export const WIDGETS = [
  // ── Study Summary (Core) ────────────────────────────────────────────────
  {
    id: 'totalSubjects', title: 'Total Subjects', category: 'Study Summary',
    chart: 'kpi', visibleByDefault: true,
    render: (k, { drillDown }) => (
      <KpiCard
        label="Total Subjects"
        value={k.totalSubjects}
        accent="#2563eb"
        onClick={() => drillDown('/subjects')}
      />
    ),
    exportRows: (k) => [{ widget: 'Total Subjects', label: '—', value: k.totalSubjects ?? '' }],
  },
  {
    id: 'totalSites', title: 'Total Sites', category: 'Study Summary',
    chart: 'kpi', visibleByDefault: true,
    render: (k, { drillDown }) => (
      <KpiCard
        label="Total Sites"
        value={k.totalSites}
        accent="#059669"
        onClick={() => drillDown('/sites')}
      />
    ),
    exportRows: (k) => [{ widget: 'Total Sites', label: '—', value: k.totalSites ?? '' }],
  },
  {
    id: 'enrolledSubjects', title: 'Enrolled Subjects', category: 'Study Summary',
    chart: 'kpi', visibleByDefault: true,
    render: (k, { drillDown }) => (
      <KpiCard
        label="Enrolled Subjects"
        value={k.enrolledSubjects}
        accent="#7c3aed"
        onClick={() => drillDown('/subjects?status=Enrolled')}
      />
    ),
    exportRows: (k) => [{ widget: 'Enrolled Subjects', label: '—', value: k.enrolledSubjects ?? '' }],
  },
  {
    id: 'excludedSubjects', title: 'Excluded Subjects', category: 'Study Summary',
    chart: 'kpi', visibleByDefault: true,
    render: (k, { drillDown }) => (
      <KpiCard
        label="Excluded Subjects"
        value={k.excludedSubjects}
        accent="#d97706"
        onClick={() => drillDown('/subjects?status=Excluded')}
      />
    ),
    exportRows: (k) => [{ widget: 'Excluded Subjects', label: '—', value: k.excludedSubjects ?? '' }],
  },
  {
    id: 'siteEnrollment', title: 'Site-wise Enrollment', category: 'Study Summary',
    chart: 'bar', visibleByDefault: true,
    render: (k, { drillDown }) => (
      <BarWidget
        title="Site-wise Enrollment"
        data={k.siteEnrollment ?? []}
        valueKey="enrolled"
        labelKey="siteName"
        color="#2563eb"
        onBarClick={(row) => drillDown(`/sites?siteCode=${encodeURIComponent(row?.siteCode ?? row?.siteName ?? '')}`)}
      />
    ),
    exportRows: (k) => (k.siteEnrollment ?? []).map((r) => ({
      widget: 'Site-wise Enrollment', label: r.siteName ?? '', value: r.enrolled ?? 0,
    })),
  },
  {
    id: 'siteExclusions', title: 'Site-wise Exclusions', category: 'Study Summary',
    chart: 'bar', visibleByDefault: false,
    render: (k, { drillDown }) => (
      <BarWidget
        title="Site-wise Exclusions"
        data={k.siteExclusions ?? []}
        valueKey="excluded"
        labelKey="siteName"
        color="#d97706"
        onBarClick={(row) => drillDown(`/sites?siteCode=${encodeURIComponent(row?.siteCode ?? row?.siteName ?? '')}`)}
      />
    ),
    exportRows: (k) => (k.siteExclusions ?? []).map((r) => ({
      widget: 'Site-wise Exclusions', label: r.siteName ?? '', value: r.excluded ?? 0,
    })),
  },

  // ── EDC Analytics ───────────────────────────────────────────────────────
  {
    id: 'crfCompletion', title: 'CRF Completion %', category: 'EDC Analytics',
    chart: 'kpi', visibleByDefault: true,
    requires: (_s, cfg) => cfgFlag(cfg, 'dataManager') || cfgFlag(cfg, 'queryManager'),
    render: (k, { drillDown }) => (
      <KpiCard
        label="CRF Completion %"
        value={fmtPct(k.crfCompletion)}
        accent="#059669"
        onClick={() => drillDown('/capture')}
      />
    ),
    exportRows: (k) => [{ widget: 'CRF Completion %', label: '—', value: fmtPct(k.crfCompletion) }],
  },
  {
    id: 'entryTimeliness', title: 'Data Entry Timeliness', category: 'EDC Analytics',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'dataManager') || cfgFlag(cfg, 'queryManager'),
    render: (k, { drillDown }) => (
      <KpiCard
        label="Data Entry Timeliness"
        value={fmtDays(k.entryTimeliness)}
        accent="#2563eb"
        onClick={() => drillDown('/capture')}
      />
    ),
    exportRows: (k) => [{ widget: 'Data Entry Timeliness', label: '—', value: fmtDays(k.entryTimeliness) }],
  },

  // ── Query Analytics ─────────────────────────────────────────────────────
  {
    id: 'openQueries', title: 'Total Open Queries', category: 'Query Analytics',
    chart: 'kpi', visibleByDefault: true,
    requires: (_s, cfg) => cfgFlag(cfg, 'queryManager'),
    render: (k, { drillDown }) => (
      <KpiCard
        label="Total Open Queries"
        value={k.openQueries}
        accent="#dc2626"
        onClick={() => drillDown('/queries?status=Open')}
      />
    ),
    exportRows: (k) => [{ widget: 'Total Open Queries', label: '—', value: k.openQueries ?? '' }],
  },
  {
    id: 'escalationRate', title: 'Query Escalation Rate', category: 'Query Analytics',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'queryManager'),
    render: (k) => (
      <KpiCard label="Query Escalation Rate" value={fmtPct(k.escalationRate)} accent="#d97706" />
    ),
    exportRows: (k) => [{ widget: 'Query Escalation Rate', label: '—', value: fmtPct(k.escalationRate) }],
  },
  {
    id: 'avgResolutionDays', title: 'Avg Resolution Time', category: 'Query Analytics',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'queryManager'),
    render: (k) => (
      <KpiCard label="Avg Resolution Time" value={fmtDays(k.avgResolutionDays)} accent="#2563eb" />
    ),
    exportRows: (k) => [{ widget: 'Avg Resolution Time', label: '—', value: fmtDays(k.avgResolutionDays) }],
  },
  {
    id: 'queryStatusDist', title: 'Query Status Distribution', category: 'Query Analytics',
    chart: 'donut', visibleByDefault: true,
    requires: (_s, cfg) => cfgFlag(cfg, 'queryManager'),
    render: (k, { drillDown }) => (
      <DonutWidget
        title="Query Status Distribution"
        data={k.queryStatusDist ?? []}
        valueKey="count"
        labelKey="status"
        onSliceClick={(row) => drillDown(`/queries?status=${encodeURIComponent(row?.status ?? '')}`)}
      />
    ),
    exportRows: (k) => (k.queryStatusDist ?? []).map((r) => ({
      widget: 'Query Status Distribution', label: r.status ?? '', value: r.count ?? 0,
    })),
  },

  // ── Consent Analytics ───────────────────────────────────────────────────
  {
    id: 'consentApprovalRate', title: 'Consent Approval Rate', category: 'Consent Analytics',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'consentManager'),
    render: (k, { drillDown }) => (
      <KpiCard
        label="Consent Approval Rate"
        value={fmtPct(k.consentApprovalRate)}
        accent="#059669"
        onClick={() => drillDown('/consent-review?status=Approved')}
      />
    ),
    exportRows: (k) => [{ widget: 'Consent Approval Rate', label: '—', value: fmtPct(k.consentApprovalRate) }],
  },
  {
    id: 'consentRejectionRate', title: 'Consent Rejection Rate', category: 'Consent Analytics',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'consentManager'),
    render: (k, { drillDown }) => (
      <KpiCard
        label="Consent Rejection Rate"
        value={fmtPct(k.consentRejectionRate)}
        accent="#dc2626"
        onClick={() => drillDown('/consent-review?status=Rejected')}
      />
    ),
    exportRows: (k) => [{ widget: 'Consent Rejection Rate', label: '—', value: fmtPct(k.consentRejectionRate) }],
  },

  // ── Data Verification ───────────────────────────────────────────────────
  {
    id: 'dataCompleteness', title: 'Data Completeness %', category: 'Data Verification',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'verificationManager'),
    render: (k) => (
      <KpiCard label="Data Completeness %" value={fmtPct(k.dataCompleteness)} accent="#059669" />
    ),
    exportRows: (k) => [{ widget: 'Data Completeness %', label: '—', value: fmtPct(k.dataCompleteness) }],
  },
  {
    id: 'pendingVerifications', title: 'Pending Verifications', category: 'Data Verification',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'verificationManager'),
    render: (k, { drillDown }) => (
      <KpiCard
        label="Pending Verifications"
        value={k.pendingVerifications}
        accent="#d97706"
        onClick={() => drillDown('/verification?status=Pending')}
      />
    ),
    exportRows: (k) => [{ widget: 'Pending Verifications', label: '—', value: k.pendingVerifications ?? '' }],
  },
  {
    id: 'verificationRejectionRate', title: 'Verification Rejection %', category: 'Data Verification',
    chart: 'kpi', visibleByDefault: false,
    requires: (_s, cfg) => cfgFlag(cfg, 'verificationManager'),
    render: (k) => (
      <KpiCard label="Verification Rejection %" value={fmtPct(k.verificationRejectionRate)} accent="#dc2626" />
    ),
    exportRows: (k) => [{ widget: 'Verification Rejection %', label: '—', value: fmtPct(k.verificationRejectionRate) }],
  },

  // ── Site & Risk Analytics ──────────────────────────────────────────────
  {
    id: 'activeSites', title: 'Active Sites', category: 'Site & Risk Analytics',
    chart: 'kpi', visibleByDefault: false,
    render: (k, { drillDown }) => (
      <KpiCard label="Active Sites" value={k.activeSites} accent="#059669"
        onClick={() => drillDown('/sites?status=Active')} />
    ),
    exportRows: (k) => [{ widget: 'Active Sites', label: '—', value: k.activeSites ?? '' }],
  },
  {
    id: 'highRiskSites', title: 'High-Risk Sites', category: 'Site & Risk Analytics',
    chart: 'kpi', visibleByDefault: false,
    render: (k, { drillDown }) => (
      <KpiCard label="High-Risk Sites" value={k.highRiskSites} accent="#d97706"
        onClick={() => drillDown('/sites?risk=High')} />
    ),
    exportRows: (k) => [{ widget: 'High-Risk Sites', label: '—', value: k.highRiskSites ?? '' }],
  },
  {
    id: 'sdvPct', title: 'Monitoring SDV %', category: 'Site & Risk Analytics',
    chart: 'kpi', visibleByDefault: false,
    render: (k) => <KpiCard label="Monitoring SDV %" value={fmtPct(k.sdvPct)} accent="#2563eb" />,
    exportRows: (k) => [{ widget: 'Monitoring SDV %', label: '—', value: fmtPct(k.sdvPct) }],
  },
  {
    id: 'sitePerformanceHeatmap', title: 'Site Performance Score', category: 'Site & Risk Analytics',
    chart: 'heatmap', visibleByDefault: false,
    render: (k, { drillDown }) => (
      <HeatmapWidget
        title="Site Performance Score"
        data={k.sitePerformance ?? []}
        valueKey="score"
        labelKey="siteName"
        onCellClick={(row) => drillDown(`/sites?siteCode=${encodeURIComponent(row?.siteCode ?? row?.siteName ?? '')}`)}
      />
    ),
    exportRows: (k) => (k.sitePerformance ?? []).map((r) => ({
      widget: 'Site Performance Score', label: r.siteName ?? '', value: r.score ?? '',
    })),
  },
  {
    id: 'siteRiskHeatmap', title: 'Site Risk Score', category: 'Site & Risk Analytics',
    chart: 'heatmap', visibleByDefault: false,
    render: (k, { drillDown }) => (
      <HeatmapWidget
        title="Site Risk Score"
        data={k.siteRisk ?? []}
        valueKey="score"
        labelKey="siteName"
        onCellClick={(row) => drillDown(`/sites?siteCode=${encodeURIComponent(row?.siteCode ?? row?.siteName ?? '')}`)}
      />
    ),
    exportRows: (k) => (k.siteRisk ?? []).map((r) => ({
      widget: 'Site Risk Score', label: r.siteName ?? '', value: r.score ?? '',
    })),
  },

  // ── Lock & Data Control ─────────────────────────────────────────────────
  {
    id: 'studyLockStatus', title: 'Study Lock Status', category: 'Lock & Data Control',
    chart: 'kpi', visibleByDefault: true,
    render: (k) => (
      <KpiCard
        label="Study Lock Status"
        value={k.studyLocked ? 'Locked' : 'Unlocked'}
        accent={k.studyLocked ? '#dc2626' : '#059669'}
      />
    ),
    exportRows: (k) => [{ widget: 'Study Lock Status', label: '—', value: k.studyLocked ? 'Locked' : 'Unlocked' }],
  },
  {
    id: 'lockedSites', title: 'Locked Sites', category: 'Lock & Data Control',
    chart: 'kpi', visibleByDefault: false,
    render: (k, { drillDown }) => (
      <KpiCard label="Locked Sites" value={k.lockedSites} accent="#d97706"
        onClick={() => drillDown('/sites?isLocked=true')} />
    ),
    exportRows: (k) => [{ widget: 'Locked Sites', label: '—', value: k.lockedSites ?? '' }],
  },
  {
    id: 'lockedSubjects', title: 'Locked Subjects', category: 'Lock & Data Control',
    chart: 'kpi', visibleByDefault: false,
    render: (k) => <KpiCard label="Locked Subjects" value={k.lockedSubjects} accent="#dc2626" />,
    exportRows: (k) => [{ widget: 'Locked Subjects', label: '—', value: k.lockedSubjects ?? '' }],
  },
  {
    id: 'modifiedAfterUnlock', title: 'Modified After Unlock', category: 'Lock & Data Control',
    chart: 'kpi', visibleByDefault: false,
    render: (k) => <KpiCard label="Modified After Unlock" value={k.modifiedAfterUnlock} accent="#7c3aed" />,
    exportRows: (k) => [{ widget: 'Modified After Unlock', label: '—', value: k.modifiedAfterUnlock ?? '' }],
  },

  // ── Alerts ──────────────────────────────────────────────────────────────
  {
    id: 'alerts', title: 'Alerts & Notifications', category: 'Alerts',
    chart: 'alerts', visibleByDefault: true,
    render: (k, { drillDown }) => (
      <AlertsWidget
        alerts={k.alerts ?? []}
        onAlertClick={(a) => a?.link && drillDown(a.link)}
      />
    ),
    exportRows: (k) => (k.alerts ?? []).map((a) => ({
      widget: 'Alert', label: a.type ?? '', value: a.message ?? '',
    })),
  },
];

export const WIDGETS_BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));
export const CATEGORY_ORDER = [
  'Study Summary',
  'EDC Analytics',
  'Query Analytics',
  'Consent Analytics',
  'Data Verification',
  'Site & Risk Analytics',
  'Lock & Data Control',
  'Alerts',
];
