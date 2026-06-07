/**
 * SponsorDashboardPage — /sponsor/:studyId/dashboard
 *
 * Sponsor (all-sites) dashboard. A fixed set of cards + a day-wise enrollment
 * graph (spec §5). Toolbar keeps Site/Country/Date filters + Snapshot; the
 * auto-refresh / last-updated / reset / configure / export controls were
 * removed per spec §2. Cards are gated on the `dashboard.view` permission and
 * the Snapshot button on `dashboard.snapshot`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  fetchStudyAsync,
  selectActiveStudy,
  selectStudyStatus,
  selectStudyError,
} from '@/features/workspace/store/workspaceSlice';
import { addToast } from '@/app/notificationSlice';
import { usePermissions } from '@/features/auth/usePermissions';

import useDashboardState from './dashboard/useDashboardState';
import useDashboardData  from './dashboard/useDashboardData';
import DashboardToolbar  from './dashboard/DashboardToolbar';
import KpiCard           from './dashboard/widgets/KpiCard';
import BarWidget         from './dashboard/widgets/BarWidget';
import { exportDashboardSnapshot } from './dashboard/exportDashboardPdf';

import styles from './dashboard/dashboard.module.css';

export default function SponsorDashboardPage() {
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();
  const { studyId } = useParams();
  const study       = useAppSelector(selectActiveStudy);
  const status      = useAppSelector(selectStudyStatus);
  const error       = useAppSelector(selectStudyError);
  const gridRef     = useRef(null);
  const { has }     = usePermissions();
  const canView     = has('dashboard', 'view');
  const canSnapshot = has('dashboard', 'snapshot');

  const { filters, setFilter } = useDashboardState(studyId);
  const { data, loading, error: dataError, refresh } = useDashboardData({ studyId, filters, autoRefresh: false });

  const [snapshotting, setSnapshotting] = useState(false);

  useEffect(() => {
    if (studyId && study?.id !== studyId) {
      dispatch(fetchStudyAsync(studyId));
    }
  }, [studyId, study?.id, dispatch]);

  const drillDown = useCallback(
    (suffix) => {
      if (!suffix) return;
      const path = suffix.startsWith('/') ? `/sponsor/${studyId}${suffix}` : suffix;
      navigate(path);
    },
    [navigate, studyId],
  );

  const handleSnapshot = useCallback(async () => {
    if (!gridRef.current) return;
    setSnapshotting(true);
    try {
      await exportDashboardSnapshot(gridRef.current, {
        filename: `Study${studyId}_Dashboard_Snapshot_${new Date().toISOString().slice(0, 10)}`,
        title:    `${study?.title ?? 'Study'} — Dashboard Snapshot`,
      });
      dispatch(addToast({ type: 'success', message: 'Snapshot downloaded.' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to generate snapshot.' }));
    } finally {
      setSnapshotting(false);
    }
  }, [dispatch, studyId, study?.title]);

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

  if (!canView) {
    return (
      <div className={styles.center}>
        <p className={styles.errorText}>You do not have permission to view this dashboard.</p>
      </div>
    );
  }

  const scope = study?.scope ?? '';
  const enrollmentByDay = Array.isArray(data.enrollmentByDay) ? data.enrollmentByDay : [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            {study?.title ?? 'Study Dashboard'}
            {scope && <span className={styles.scopeBadge}>{scope}</span>}
            {data.studyStatus && (
              <span className={styles.statusBadge} data-status={String(data.studyStatus).toLowerCase()}>
                {data.studyStatus}
              </span>
            )}
          </h1>
          <p className={styles.subtitle}>All-sites overview · subjects, sites and enrollment.</p>
        </div>
      </div>

      <DashboardToolbar
        studyId={studyId}
        filters={filters}
        setFilter={setFilter}
        refreshing={loading}
        onRefresh={refresh}
        onSnapshot={handleSnapshot}
        canSnapshot={canSnapshot}
        snapshotting={snapshotting}
        snapshotDisabled={loading}
      />

      {dataError && (
        <p className={styles.errorText}>Failed to load dashboard data: {dataError}</p>
      )}

      <div ref={gridRef} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section className={styles.section}>
          <div className={styles.grid}>
            <KpiCard label="Total Subjects"   value={data.totalSubjects}   accent="#2563eb" onClick={() => drillDown('/subjects')} />
            <KpiCard label="Total Sites"      value={data.totalSites}      accent="#059669" onClick={() => drillDown('/sites')} />
            <KpiCard label="Enrolled Subjects" value={data.enrolledSubjects} accent="#7c3aed" onClick={() => drillDown('/subjects?status=Enrolled')} />
            <KpiCard label="Excluded Subjects" value={data.excludedSubjects} accent="#d97706" onClick={() => drillDown('/subjects?eligibility=Excluded')} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.grid}>
            <div style={{ gridColumn: '1 / -1' }}>
              <BarWidget
                title="All Sites — Actual Enrollments (Day-wise)"
                data={enrollmentByDay}
                valueKey="count"
                labelKey="date"
                color="#2563eb"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
