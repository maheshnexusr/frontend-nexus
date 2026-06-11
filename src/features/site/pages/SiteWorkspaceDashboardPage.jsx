/**
 * SiteWorkspaceDashboardPage — /site/dashboard (PI / site-staff workspace).
 *
 * Assigned-site dashboard (spec §6): a fixed set of cards + a day-wise
 * enrollment graph scoped to the user's assigned site. Date range defaults to
 * the last 15 days; a Snapshot (PDF) button is gated on `dashboard.snapshot`.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, RefreshCw, Camera } from 'lucide-react';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { getSiteStudyContext } from '@/features/site/authStore';
import { usePermissions } from '@/features/auth/usePermissions';
import DatePicker from '@/components/form/DatePicker';
import { exportDashboardSnapshot } from '@/features/sponsor/pages/dashboard/exportDashboardPdf';
import BarWidget from '@/features/sponsor/pages/dashboard/widgets/BarWidget';

const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtPct = (v) => (v != null ? `${Math.round(v)}%` : '—');

const CARDS = [
  { key: 'totalSubjects',     label: 'Total Subjects',     accent: '#2563eb' },
  { key: 'enrolledSubjects',  label: 'Enrolled Subjects',  accent: '#7c3aed' },
  { key: 'pendingSubjects',   label: 'Pending Subjects',   accent: '#d97706' },
  { key: 'completedSubjects', label: 'Completed Subjects', accent: '#059669' },
];

export default function SiteWorkspaceDashboardPage() {
  const context = getSiteStudyContext();
  const { has } = usePermissions();
  const canSnapshot = has('dashboard', 'snapshot');
  const gridRef = useRef(null);

  const [dashboard, setDashboard] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(14));
  const [dateTo, setDateTo]     = useState(todayISO());
  const [snapshotting, setSnapshotting] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const data = await siteWorkspaceClient.dashboard({ dateFrom, dateTo });
      setDashboard(data);
      setPhase('ready');
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load the dashboard.');
      setPhase('error');
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleSnapshot = useCallback(async () => {
    if (!gridRef.current) return;
    setSnapshotting(true);
    try {
      await exportDashboardSnapshot(gridRef.current, {
        filename: `Site_Dashboard_Snapshot_${todayISO()}`,
        title:    `${context?.studyTitle ?? 'Study'} — ${context?.siteName ?? 'Site'} Dashboard`,
      });
    } catch { /* non-fatal */ } finally {
      setSnapshotting(false);
    }
  }, [context?.studyTitle, context?.siteName]);

  const enrollmentByDay = Array.isArray(dashboard?.enrollmentByDay) ? dashboard.enrollmentByDay : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={title}>{context?.studyTitle || context?.protocolNumber || 'Study'}</h1>
            <p style={sub}>{context?.environment} · {context?.siteName} · {context?.roleName}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <label style={toolLabel}>Date From</label>
              <DatePicker value={dateFrom} max={dateTo} onChange={(iso) => setDateFrom(iso || '')} />
            </div>
            <div>
              <label style={toolLabel}>Date To</label>
              <DatePicker value={dateTo} min={dateFrom} onChange={(iso) => setDateTo(iso || '')} />
            </div>
            <button type="button" style={btn} onClick={load} disabled={phase === 'loading'} title="Refresh">
              <RefreshCw size={13} /> Refresh
            </button>
            {canSnapshot && (
              <button type="button" style={btn} onClick={handleSnapshot} disabled={snapshotting || phase !== 'ready'} title="Download snapshot as PDF">
                <Camera size={13} /> {snapshotting ? 'Snapshotting…' : 'Snapshot PDF'}
              </button>
            )}
          </div>
        </div>

        {phase === 'loading' && (
          <p style={{ ...sub, marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={16} /> Loading dashboard…
          </p>
        )}

        {phase === 'error' && (
          <div style={errorBox}>
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button type="button" onClick={load} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <div ref={gridRef} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={grid}>
              {CARDS.map((c) => {
                const raw = dashboard?.[c.key];
                return (
                  <div key={c.key} style={{ ...kpi, borderTopColor: c.accent }}>
                    <p style={{ ...kpiValue, color: c.accent }}>{c.pct ? fmtPct(raw) : (raw ?? '—')}</p>
                    <p style={kpiLabel}>{c.label}</p>
                  </div>
                );
              })}
            </div>

            <BarWidget
              title="Site — Actual Enrollments (Day-wise)"
              data={enrollmentByDay}
              valueKey="count"
              labelKey="date"
              color="#2563eb"
            />
          </div>
        )}
      </div>
    </div>
  );
}

const card = { background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 12, padding: 24 };
const title = { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #0f172a)' };
const sub = { marginTop: 6, fontSize: 14, color: 'var(--text-muted, #64748b)' };
const toolLabel = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #64748b)', marginBottom: 4 };
const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' };
const errorBox = { marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-danger, #fef2f2)', border: '1px solid var(--border-danger, #fecaca)', color: 'var(--text-danger, #b91c1c)', borderRadius: 8, fontSize: 13 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 };
const kpi = { background: 'var(--bg-page, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', borderTop: '3px solid #2563eb', borderRadius: 10, padding: '16px 18px' };
const kpiValue = { margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.1 };
const kpiLabel = { margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)', fontWeight: 600 };
const chartCard = { background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: 10, padding: 16 };
const chartTitle = { margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)' };
