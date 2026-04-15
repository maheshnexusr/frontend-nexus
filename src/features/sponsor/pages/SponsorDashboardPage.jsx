import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  fetchStudyAsync,
  selectActiveStudy,
  selectStudyStatus,
  selectStudyError,
} from '@/features/workspace/store/workspaceSlice';
import styles from './SponsorDashboardPage.module.css';

export default function SponsorDashboardPage() {
  const dispatch    = useAppDispatch();
  const { studyId } = useParams();
  const study       = useAppSelector(selectActiveStudy);
  const status      = useAppSelector(selectStudyStatus);
  const error       = useAppSelector(selectStudyError);

  useEffect(() => {
    // Fetch study if not already loaded (avoids re-fetching on every render)
    if (studyId && study.id !== studyId) {
      dispatch(fetchStudyAsync(studyId));
    }
  }, [studyId]);

  if (status === 'loading') {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Loading study…</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={styles.center}>
        <p className={styles.errorText}>Failed to load study: {error}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{study.title ?? 'Study Dashboard'}</h1>
          {study.scope && <span className={styles.scopeBadge}>{study.scope}</span>}
        </div>
      </div>

      <div className={styles.grid}>
        <StatCard label="Enrolled Subjects" value="—" />
        <StatCard label="Data Completion"   value="—" />
        <StatCard label="Open Queries"      value="—" />
        <StatCard label="Sites Active"      value="—" />
      </div>

      <p className={styles.hint}>
        Connect backend <code>GET /studies/{studyId}</code> to populate real metrics.
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
