import { useState, useEffect } from 'react';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { dashboardService } from '@/services/dashboardService';
import styles from './CRODashboardPage.module.css';

export default function CRODashboardPage() {
  const user = useAppSelector(selectCurrentUser);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.get()
      .then((res) => setStats(res))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const p = stats?.portfolio ?? {};

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            Welcome, {user?.fullName ?? 'User'}
          </h1>
          <span className={styles.roleBadge}>{user?.roleName ?? user?.role ?? 'User'}</span>
        </div>
      </div>

      <div className={styles.grid}>
        <StatCard label="Total Studies"     value={loading ? '…' : (p.total_studies     ?? '—')} />
        <StatCard label="Active Studies"    value={loading ? '…' : (p.active_studies    ?? '—')} />
        <StatCard label="Studies in UAT"    value={loading ? '…' : (p.studies_in_uat    ?? '—')} />
        <StatCard label="Completed Studies" value={loading ? '…' : (p.completed_studies ?? '—')} />
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{label}</p>
    </div>
  );
}
