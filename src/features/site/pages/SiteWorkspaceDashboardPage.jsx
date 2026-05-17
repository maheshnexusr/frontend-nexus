/**
 * SiteWorkspaceDashboardPage — content rendered inside SiteLayout at
 * /site/dashboard. The picker UI and tiles live elsewhere now (the sidebar
 * built by SiteLayout handles feature navigation); this page is just the
 * site-scoped welcome + metrics card.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Building2, FileText, User, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { getSiteStudyContext } from '@/features/site/authStore';

const card = {
  background: 'var(--bg-elevated, #fff)',
  border: '1px solid var(--border-subtle, #e2e8f0)',
  borderRadius: 12,
  padding: 24,
};
const title = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  color: 'var(--text-primary, #0f172a)',
};
const sub = {
  marginTop: 6,
  fontSize: 14,
  color: 'var(--text-muted, #64748b)',
};
const errorBox = {
  marginTop: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  background: 'var(--bg-danger, #fef2f2)',
  border: '1px solid var(--border-danger, #fecaca)',
  color: 'var(--text-danger, #b91c1c)',
  borderRadius: 8,
  fontSize: 13,
};
const sectionTitle = {
  marginTop: 24,
  marginBottom: 12,
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-primary, #0f172a)',
};
const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};
const metricRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  background: 'var(--bg-page, #f8fafc)',
  border: '1px solid var(--border-subtle, #e2e8f0)',
  borderRadius: 8,
  fontSize: 13,
};

function Metric({ icon, label, value }) {
  if (value === undefined || value === null) return null;
  return (
    <div style={metricRow}>
      <span style={{ color: 'var(--text-muted, #64748b)' }}>{icon}</span>
      <span style={{ flex: 1, color: 'var(--text-muted, #64748b)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{value}</span>
    </div>
  );
}

export default function SiteWorkspaceDashboardPage() {
  const context = getSiteStudyContext();
  const [dashboard, setDashboard] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const data = await siteWorkspaceClient.dashboard();
      setDashboard(data);
      setPhase('ready');
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load the dashboard.');
      setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = dashboard?.metrics ?? {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <h1 style={title}>
          {context?.studyTitle || context?.protocolNumber || 'Study'}
        </h1>
        <p style={sub}>
          {context?.environment} · {context?.siteName} · {context?.roleName}
        </p>

        {phase === 'loading' && (
          <p style={{ ...sub, marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={16} /> Loading dashboard…
          </p>
        )}

        {phase === 'error' && (
          <div style={errorBox}>
            <AlertCircle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button
              type="button"
              onClick={load}
              style={{
                background: 'transparent', border: 'none', color: 'inherit',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <h2 style={sectionTitle}>Your site at a glance</h2>
            <div style={grid}>
              <Metric icon={<User size={14} />}      label="Subjects (total)"  value={metrics.subjects?.total} />
              <Metric icon={<User size={14} />}      label="Subjects enrolled" value={metrics.subjects?.enrolled} />
              <Metric icon={<User size={14} />}      label="In screening"      value={metrics.subjects?.screening} />
              <Metric icon={<FileText size={14} />}  label="Open queries"      value={metrics.queries?.open_queries} />
              <Metric icon={<FileText size={14} />}  label="Answered queries"  value={metrics.queries?.answered_queries} />
              <Metric icon={<FileText size={14} />}  label="Closed queries"    value={metrics.queries?.closed_queries} />
              <Metric icon={<Building2 size={14} />} label="Enrollment target" value={metrics.site?.enrollment_target} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
