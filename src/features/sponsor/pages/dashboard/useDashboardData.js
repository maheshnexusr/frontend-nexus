import { useCallback, useEffect, useRef, useState } from 'react';
import sponsorAxiosClient      from '@/api/sponsorAxiosClient';
import { sponsorStudyContextStore } from '@/services/sponsorAuthService';

const POLL_MS = 60_000;

export default function useDashboardData({ studyId, filters, autoRefresh }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(null);

  const fetchNow = useCallback(async () => {
    if (!studyId) return;
    setLoading(true);
    setError(null);
    try {
      const ctx = sponsorStudyContextStore.get();
      const params = { study_id: studyId, environment: ctx?.environment };
      if (filters.site)     params.site      = filters.site;
      if (filters.country)  params.country   = filters.country;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo)   params.date_to   = filters.dateTo;
      // Spec §3.3 — GET /api/v1/sponsor/studies/dashboard?study_id=...&environment=...
      const res = await sponsorAxiosClient.get('/api/v1/sponsor/studies/dashboard', { params });
      setData(res?.data ?? res ?? {});
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message ?? 'Failed to load dashboard data.');
      setData({});
    } finally {
      setLoading(false);
    }
  }, [studyId, filters.site, filters.country, filters.dateFrom, filters.dateTo]);

  // Initial + filter-change fetch.
  useEffect(() => { fetchNow(); }, [fetchNow]);

  // Auto-refresh polling.
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(fetchNow, POLL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fetchNow]);

  // Clean up pending abort on unmount.
  useEffect(() => () => abortRef.current?.abort?.(), []);

  return { data: data ?? {}, loading, error, lastUpdated, refresh: fetchNow };
}
