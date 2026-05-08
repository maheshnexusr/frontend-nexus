import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { addToast } from '@/app/notificationSlice';
import { dashboardService } from '@/services/dashboardService';
import { sponsorViewTokenStore } from '@/features/workspace/sponsorViewTokenStore';
import styles from './CRODashboardPage.module.css';

export default function CRODashboardPage() {
  const user     = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Surface any one-shot flash left over from a sponsor-view token expiry
  // (sponsorAxiosClient redirects here after a 401 in read-only viewer mode).
  useEffect(() => {
    const flash = sponsorViewTokenStore.consumeFlash();
    if (flash) dispatch(addToast({ type: 'info', message: flash, duration: 5000 }));
  }, [dispatch]);

  useEffect(() => {
    dashboardService.get()
      .then((res) => setStats(res))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const p = stats?.portfolio ?? {};
  const t = stats?.team ?? {};

  const portfolioCards = [
    { label: 'Total Studies',          value: p.total_studies       ?? '—', color: '#2563eb' },
    { label: 'Active Studies',         value: p.active_studies      ?? '—', color: '#059669' },
    { label: 'Studies in UAT',         value: p.studies_in_uat      ?? '—', color: '#d97706' },
    { label: 'Studies in Production',  value: p.studies_in_live     ?? '—', color: '#7c3aed' },
    { label: 'Locked Studies',         value: p.locked_studies      ?? '—', color: '#dc2626' },
    { label: 'Completed Studies',      value: p.completed_studies   ?? '—', color: '#0ea5e9' },
  ];

  const teamCards = [
    { label: 'Total CRO Users',   value: t.total_users    ?? '—', color: '#2563eb' },
    { label: 'Active Users',      value: t.active_users   ?? '—', color: '#059669' },
    { label: 'New Users Added',   value: t.new_users      ?? '—', color: '#d97706' },
    { label: 'CRA Workload',      value: t.cra_workload   ?? '—', color: '#7c3aed' },
    { label: 'Studies per PM',    value: t.studies_per_pm ?? '—', color: '#dc2626' },
    { label: 'Sites per CRA',     value: t.sites_per_cra  ?? '—', color: '#0ea5e9' },
  ];

  const roleDistribution = t.role_distribution ?? [];
  const studyTrend = p.study_trend ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome, {user?.fullName ?? 'User'}</h1>
          <span className={styles.roleBadge}>{user?.roleName ?? user?.role ?? 'User'}</span>
        </div>
      </div>

      {/* Study Portfolio Overview */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Study Portfolio Overview</h2>
        <div className={styles.grid}>
          {portfolioCards.map((c) => (
            <StatCard key={c.label} label={c.label} value={loading ? '…' : c.value} accent={c.color} />
          ))}
        </div>
      </section>

      {/* Study Trend */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Study Trend</h2>
        <div className={styles.chartCard}>
          {loading ? (
            <p className={styles.chartHint}>Loading…</p>
          ) : studyTrend.length === 0 ? (
            <p className={styles.chartHint}>No trend data available. Study growth over time will appear here.</p>
          ) : (
            <TrendChart data={studyTrend} />
          )}
        </div>
      </section>

      {/* CRO Team Management */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>CRO Team Management</h2>
        <div className={styles.grid}>
          {teamCards.map((c) => (
            <StatCard key={c.label} label={c.label} value={loading ? '…' : c.value} accent={c.color} />
          ))}
        </div>
      </section>

      {/* Role Distribution */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Role Distribution</h2>
        <div className={styles.chartCard}>
          {loading ? (
            <p className={styles.chartHint}>Loading…</p>
          ) : roleDistribution.length === 0 ? (
            <p className={styles.chartHint}>No role distribution data. User role breakdown will appear here.</p>
          ) : (
            <RoleChart data={roleDistribution} />
          )}
        </div>
      </section>

      {/* Team Utilization */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Team Utilization</h2>
        <div className={styles.chartCard}>
          <TeamUtilizationGauge value={loading ? null : (t.utilization_pct ?? null)} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent = '#2563eb' }) {
  return (
    <div className={styles.statCard} style={{ borderTop: `3px solid ${accent}` }}>
      <p className={styles.statValue} style={{ color: accent }}>{value}</p>
      <p className={styles.statLabel}>{label}</p>
    </div>
  );
}

function TrendChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.count ?? 0), 1);
  return (
    <div className={styles.trendChart}>
      {data.map((d, i) => (
        <div key={i} className={styles.trendBar}>
          <div
            className={styles.trendBarFill}
            style={{ height: `${Math.round(((d.count ?? 0) / max) * 100)}%` }}
            title={`${d.count} studies`}
          />
          <span className={styles.trendLabel}>{d.month ?? d.label ?? i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function RoleChart({ data }) {
  const total = data.reduce((s, d) => s + (d.count ?? 0), 0) || 1;
  const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0ea5e9'];
  return (
    <div className={styles.roleChart}>
      {data.map((d, i) => (
        <div key={i} className={styles.roleRow}>
          <span className={styles.roleColor} style={{ background: COLORS[i % COLORS.length] }} />
          <span className={styles.roleName}>{d.role ?? d.label}</span>
          <div className={styles.roleBarWrap}>
            <div
              className={styles.roleBarFill}
              style={{
                width: `${Math.round(((d.count ?? 0) / total) * 100)}%`,
                background: COLORS[i % COLORS.length],
              }}
            />
          </div>
          <span className={styles.roleCount}>{d.count ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function TeamUtilizationGauge({ value }) {
  const pct = value != null ? Math.min(Math.max(value, 0), 100) : null;
  const color = pct == null ? '#94a3b8' : pct >= 85 ? '#dc2626' : pct >= 65 ? '#d97706' : '#059669';
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeValue} style={{ color }}>
        {pct != null ? `${Math.round(pct)}%` : '—'}
      </div>
      <p className={styles.gaugeLabel}>Team Utilization</p>
      {pct != null && (
        <div className={styles.gaugeBar}>
          <div className={styles.gaugeBarFill} style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
      <p className={styles.gaugeHint}>
        {pct == null ? 'Resource utilization data will appear here.' :
          pct >= 85 ? 'High utilization — consider redistributing workload.' :
          pct >= 65 ? 'Moderate utilization.' : 'Utilization is within healthy range.'}
      </p>
    </div>
  );
}
