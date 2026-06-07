import { useEffect, useState } from 'react';
import { RefreshCw, Camera } from 'lucide-react';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import DatePicker         from '@/components/form/DatePicker';
import { sponsorSitesClient }     from '@/features/sponsor/api/sponsorSitesClient';
import { sponsorCountriesClient } from '@/features/sponsor/api/sponsorCountriesClient';
import styles from './dashboard.module.css';

export default function DashboardToolbar({
  studyId, filters, setFilter,
  refreshing, onRefresh, onSnapshot,
  canSnapshot, snapshotting, snapshotDisabled,
}) {
  const [siteOpts, setSiteOpts]       = useState([]);
  const [countryOpts, setCountryOpts] = useState([]);

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
          onChange={(iso) => setFilter({ dateFrom: iso || null })}
        />
      </div>
      <div>
        <label className={styles.toolLabel}>Date To</label>
        <DatePicker
          value={filters.dateTo}
          min={filters.dateFrom}
          onChange={(iso) => setFilter({ dateTo: iso || null })}
        />
      </div>

      <div className={styles.toolActions}>
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
        {canSnapshot && (
          <button
            type="button"
            className={styles.btn}
            onClick={onSnapshot}
            disabled={snapshotting || snapshotDisabled}
            title="Download dashboard snapshot as PDF"
          >
            <Camera size={13} />
            {snapshotting ? 'Snapshotting…' : 'Snapshot PDF'}
          </button>
        )}
      </div>
    </div>
  );
}
