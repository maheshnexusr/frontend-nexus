import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectCurrentUser,
  selectPermissions,
  selectPermissionsTree,
} from '@/features/auth/authSlice';
import { addToast } from '@/app/notificationSlice';
import { dashboardService } from '@/services/dashboardService';
import { sponsorViewTokenStore } from '@/features/workspace/sponsorViewTokenStore';
import styles from './CRODashboardPage.module.css';

export default function CRODashboardPage() {
  const user     = useAppSelector(selectCurrentUser);
  const permsArr = useAppSelector(selectPermissions);
  const permTree = useAppSelector(selectPermissionsTree);
  const dispatch = useAppDispatch();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Permission check — gate on the single `dashboard` leaf, matching what
  // the sidebar uses. Both dashboard sub-pages (Study Portfolio Overview +
  // CRO Team Utilization) collapse into this one leaf on the consumer side.
  // Wildcard ('*') from either source = super-admin = full access.
  const isAdmin = (Array.isArray(permsArr) && permsArr.includes('*')) || permTree === '*';
  const canViewDashboard =
    isAdmin
    || (Array.isArray(permsArr) && permsArr.includes('dashboard.view'))
    || !!(permTree && typeof permTree === 'object' && permTree.dashboard?.view);

  // Surface any one-shot flash left over from a sponsor-view token expiry
  // (sponsorAxiosClient redirects here after a 401 in read-only viewer mode).
  useEffect(() => {
    const flash = sponsorViewTokenStore.consumeFlash();
    if (flash) dispatch(addToast({ type: 'info', message: flash, duration: 5000 }));
  }, [dispatch]);

  useEffect(() => {
    // Skip the API call entirely when the user has no dashboard.view perm —
    // otherwise the backend (correctly) returns 403 on every load. The page
    // renders a friendly "no access" state below instead.
    if (!canViewDashboard) { setLoading(false); return; }
    dashboardService.get()
      .then((res) => setStats(res))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [canViewDashboard]);

  // ── No-access state ─────────────────────────────────────────────────────
  // The user landed here either by typing the URL or via a stale link, but
  // their role has dashboard.view=false. Show a helpful explanation + links
  // to whatever they CAN access (assigned studies most commonly).
  if (!canViewDashboard) {
    const assigned = Array.isArray(user?.assignedStudies) ? user.assignedStudies : [];
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Welcome, {user?.fullName ?? 'User'}</h1>
            <span className={styles.roleBadge}>{user?.roleName ?? user?.role ?? 'User'}</span>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.chartCard} style={{ padding: 24, lineHeight: 1.55 }}>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
              You don't have access to the CRO Dashboard
            </h2>
            <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
              Your role <strong>{user?.roleName || 'this user'}</strong> doesn't include the
              "Dashboard → View" permission. Ask an admin to enable it under
              <em> CRO Team Administration → Roles &amp; Permissions</em> if you need to see it.
            </p>

            {assigned.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                  Studies you can work in:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {assigned.map((s) => (
                    <li key={s.studyId} style={{ marginBottom: 4 }}>
                      <Link
                        to={`/sponsor/${s.studyId}/dashboard`}
                        style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {s.studyTitle || s.studyId}
                      </Link>
                      {s.sponsorName && (
                        <span style={{ color: '#64748b', fontSize: 12, marginLeft: 6 }}>
                          · {s.sponsorName}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

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
