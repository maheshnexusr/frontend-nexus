/**
 * SponsorDashboardPage — /sponsor/:studyId/dashboard
 *
 * Clinical Intelligence Dashboard for the Sponsor Workspace.
 * Features: Site/Country/Date filters, drill-down, configurable widgets,
 * multi-format export (CSV / Excel / PDF tabular + PDF snapshot),
 * manual + auto refresh (60 s polling).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  fetchStudyAsync,
  selectActiveStudy,
  selectStudyStatus,
  selectStudyError,
} from '@/features/workspace/store/workspaceSlice';
import { addToast } from '@/app/notificationSlice';
import { exportTable } from '@/utils/exportTable';

import useDashboardState       from './dashboard/useDashboardState';
import useDashboardData        from './dashboard/useDashboardData';
import DashboardToolbar        from './dashboard/DashboardToolbar';
import ConfigureWidgetsModal   from './dashboard/ConfigureWidgetsModal';
import { exportDashboardSnapshot } from './dashboard/exportDashboardPdf';
import { WIDGETS_BY_ID, CATEGORY_ORDER, isWidgetPermitted } from './dashboard/widgetRegistry';
import { useSiteRolePermissions } from '@/features/site/hooks/useSiteRolePermissions';

import styles from './dashboard/dashboard.module.css';

const EXPORT_COLUMNS = [
  { header: 'Widget', accessor: 'widget' },
  { header: 'Label',  accessor: 'label'  },
  { header: 'Value',  accessor: 'value'  },
];

export default function SponsorDashboardPage() {
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();
  const { studyId } = useParams();
  const study       = useAppSelector(selectActiveStudy);
  const status      = useAppSelector(selectStudyStatus);
  const error       = useAppSelector(selectStudyError);
  const studyConfig = study?.config;
  const gridRef     = useRef(null);
  // Per-study permission tree for the active user (null = unrestricted) — the
  // same resolver the sidebar menu uses. Drives which dashboard widgets show.
  const perms       = useSiteRolePermissions(studyId);

  const {
    filters, setFilter, resetFilters,
    widgets, orderedWidgetIds, toggleWidget, moveWidget, resetWidgets,
    autoRefresh, setAutoRefresh,
  } = useDashboardState(studyId);

  const {
    data, loading, error: dataError, lastUpdated, refresh,
  } = useDashboardData({ studyId, filters, autoRefresh });

  const [configureOpen, setConfigureOpen] = useState(false);
  const [snapshotting,  setSnapshotting]  = useState(false);

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

  // Grouped visible widgets by category, in user-chosen order.
  const visibleByCategory = useMemo(() => {
    const groups = CATEGORY_ORDER.reduce((acc, cat) => { acc[cat] = []; return acc; }, {});
    for (const id of orderedWidgetIds) {
      const meta = WIDGETS_BY_ID[id];
      const cfg  = widgets[id];
      if (!meta || !cfg?.visible) continue;
      // Permission gate — a role only sees widgets its permissions allow.
      if (!isWidgetPermitted(meta, perms)) continue;
      const gatedOut = meta.requires ? !meta.requires(study, studyConfig) : false;
      if (gatedOut) continue;
      groups[meta.category].push(meta);
    }
    return groups;
  }, [orderedWidgetIds, widgets, study, studyConfig, perms]);

  const anyVisible = Object.values(visibleByCategory).some((arr) => arr.length > 0);

  const handleTabularExport = useCallback((format) => {
    const rows = [];
    for (const cat of CATEGORY_ORDER) {
      for (const meta of visibleByCategory[cat]) {
        try {
          const exported = meta.exportRows?.(data) ?? [];
          rows.push(...exported);
        } catch { /* skip faulty widget */ }
      }
    }
    if (!rows.length) {
      dispatch(addToast({ type: 'error', message: 'Nothing to export — no visible widgets with data.' }));
      return;
    }
    const filename = `Study${studyId}_Dashboard_${new Date().toISOString().slice(0, 10)}`;
    try {
      exportTable(format, {
        columns:   EXPORT_COLUMNS,
        rows,
        filename,
        sheetName: 'Dashboard',
        title:     `${study?.title ?? 'Study'} — Dashboard`,
      });
      dispatch(addToast({ type: 'success', message: 'Dashboard exported.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export dashboard.' }));
    }
  }, [data, dispatch, studyId, study?.title, visibleByCategory]);

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

  const scope = study?.scope ?? '';

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
          <p className={styles.subtitle}>Clinical intelligence dashboard · filter, drill down, configure and export.</p>
        </div>
      </div>

      <DashboardToolbar
        studyId={studyId}
        filters={filters}
        setFilter={setFilter}
        resetFilters={resetFilters}
        refreshing={loading}
        onRefresh={refresh}
        onConfigure={() => setConfigureOpen(true)}
        onExport={handleTabularExport}
        onSnapshot={handleSnapshot}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        lastUpdated={lastUpdated}
        exportDisabled={loading || !anyVisible}
        snapshotting={snapshotting}
      />

      {dataError && (
        <p className={styles.errorText}>Failed to load dashboard data: {dataError}</p>
      )}

      <div ref={gridRef} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!anyVisible ? (
          <div className={styles.empty}>
            No widgets visible. Click <strong>Configure</strong> to enable widgets for this study.
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const metas = visibleByCategory[cat];
            if (!metas.length) return null;
            return (
              <section key={cat} className={styles.section}>
                <h2 className={styles.sectionTitle}>{cat}</h2>
                <div className={styles.grid}>
                  {metas.map((meta) => (
                    <div key={meta.id} style={{
                      gridColumn:
                        meta.chart === 'kpi' ? undefined :
                        meta.chart === 'alerts' ? '1 / -1' : undefined,
                    }}>
                      {meta.render(data ?? {}, { drillDown })}
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <ConfigureWidgetsModal
        open={configureOpen}
        onClose={() => setConfigureOpen(false)}
        widgets={widgets}
        orderedWidgetIds={orderedWidgetIds}
        toggleWidget={toggleWidget}
        moveWidget={moveWidget}
        resetWidgets={resetWidgets}
        study={study}
        studyConfig={studyConfig}
        perms={perms}
      />
    </div>
  );
}
