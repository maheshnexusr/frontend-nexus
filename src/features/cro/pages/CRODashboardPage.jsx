import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import styles from './CRODashboardPage.module.css';

// Role display labels — backend sends role key, we show a friendly label
const ROLE_LABELS = {
  admin:     'Admin',
  cro_admin: 'CRO Admin',
  cro:       'CRO Member',
};

export default function CRODashboardPage() {
  const user      = useAppSelector(selectCurrentUser);
  const roleLabel = ROLE_LABELS[user?.role] ?? user?.role ?? 'User';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            Welcome, {user?.fullName ?? 'User'}
          </h1>
          <span className={styles.roleBadge}>{roleLabel}</span>
        </div>
      </div>

      <div className={styles.grid}>
        <StatCard label="Total Sponsors" value="—" />
        <StatCard label="Active Studies"  value="—" />
        <StatCard label="Team Members"    value="—" />
        <StatCard label="Pending Tasks"   value="—" />
      </div>

      <p className={styles.hint}>
        Connect backend endpoints to populate real metrics.
      </p>
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
