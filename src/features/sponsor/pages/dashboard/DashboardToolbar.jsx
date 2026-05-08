import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Settings2, Camera } from 'lucide-react';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import DatePicker         from '@/components/form/DatePicker';
import ExportMenu         from '@/components/data-table/ExportMenu';
import { sponsorSitesClient }     from '@/features/sponsor/api/sponsorSitesClient';
import { sponsorCountriesClient } from '@/features/sponsor/api/sponsorCountriesClient';
import { useReadOnlyView }        from '@/features/workspace/hooks/useReadOnlyView';
import styles from './dashboard.module.css';

function fmtTimeAgo(d) {
  if (!d) return 'never';
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60)  return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export default function DashboardToolbar({
  studyId, filters, setFilter, resetFilters,
  refreshing, onRefresh, onConfigure, onExport, onSnapshot,
  autoRefresh, setAutoRefresh, lastUpdated, exportDisabled, snapshotting,
}) {
  const [siteOpts, setSiteOpts]       = useState([]);
  const [countryOpts, setCountryOpts] = useState([]);
  const ro = useReadOnlyView();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sites, countries] = await Promise.all([
          sponsorSitesClient.list(studyId).catch(() => []),
          sponsorCountriesClient.list(studyId).catch(() => []),
        ]);
        if (cancelled) return;
        setSiteOpts(sites.map((s) => ({ value: s.id, label: `${s.siteCode || s.siteName} — ${s.siteName}`.trim() })));
        setCountryOpts(countries.map((c) => ({ value: c.countryName, label: c.countryName })));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [studyId]);

  const lastUpdatedText = useMemo(() => fmtTimeAgo(lastUpdated), [lastUpdated, refreshing]);

  return (
    <div className={styles.toolbar}>
      <div>
        <label className={styles.toolLabel}>Site</label>
        <SearchableDropdown
          options={siteOpts}
          value={filters.site}
          onChange={(v) => setFilter({ site: v || null })}
          placeholder="All sites"
        />
      </div>
      <div>
        <label className={styles.toolLabel}>Country</label>
        <SearchableDropdown
          options={countryOpts}
          value={filters.country}
          onChange={(v) => setFilter({ country: v || null })}
          placeholder="All countries"
        />
      </div>
      <div>
        <label className={styles.toolLabel}>Date From</label>
        <DatePicker
          value={filters.dateFrom}
          max={filters.dateTo}
          onChange={(e) => setFilter({ dateFrom: e.target.value })}
        />
      </div>
      <div>
        <label className={styles.toolLabel}>Date To</label>
        <DatePicker
          value={filters.dateTo}
          min={filters.dateFrom}
          onChange={(e) => setFilter({ dateTo: e.target.value })}
        />
      </div>

      <div className={styles.toolActions}>
        <label className={styles.autoToggle}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
        <span className={styles.lastUpdated}>Updated: {lastUpdatedText}</span>
        <button
          type="button"
          className={styles.btn}
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh"
        >
          <RefreshCw size={13} className={refreshing ? styles.refreshing : undefined} />
          Refresh
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={resetFilters}
          title="Reset filters"
        >
          Reset
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={onConfigure}
          title={ro.isReadOnly ? ro.readOnlyMessage : 'Configure widgets'}
          {...ro.disabledProps('Configure widgets')}
        >
          <Settings2 size={13} />
          Configure
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={onSnapshot}
          disabled={snapshotting || exportDisabled}
          title="Download dashboard snapshot as PDF"
        >
          <Camera size={13} />
          {snapshotting ? 'Snapshotting…' : 'Snapshot PDF'}
        </button>
        <ExportMenu
          disabled={exportDisabled}
          onExport={onExport}
          label="Export"
        />
      </div>
    </div>
  );
}
