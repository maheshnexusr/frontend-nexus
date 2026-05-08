import { useCallback, useEffect, useMemo, useState } from 'react';
import { WIDGETS } from './widgetRegistry';

const STORAGE_PREFIX = 'sponsor.dashboard.';

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

function defaultFilters() {
  return { site: null, country: null, dateFrom: isoDaysAgo(30), dateTo: todayISO() };
}

function defaultWidgetConfig() {
  return WIDGETS.reduce((acc, w, idx) => {
    acc[w.id] = { visible: !!w.visibleByDefault, order: idx };
    return acc;
  }, {});
}

function readStored(studyId) {
  if (!studyId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + studyId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeStored(studyId, value) {
  if (!studyId) return;
  try { localStorage.setItem(STORAGE_PREFIX + studyId, JSON.stringify(value)); } catch { /* ignore */ }
}

export default function useDashboardState(studyId) {
  const [filters, setFilters] = useState(defaultFilters);
  const [widgets, setWidgets] = useState(defaultWidgetConfig);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load stored prefs on study change.
  useEffect(() => {
    const stored = readStored(studyId);
    if (!stored) {
      setFilters(defaultFilters());
      setWidgets(defaultWidgetConfig());
      setAutoRefresh(false);
      return;
    }
    setFilters({ ...defaultFilters(), ...(stored.filters ?? {}) });
    // Reconcile widget config: merge with any new widgets added since stored prefs were saved.
    const base = defaultWidgetConfig();
    const merged = { ...base };
    for (const id of Object.keys(stored.widgets ?? {})) {
      if (merged[id]) merged[id] = { ...merged[id], ...stored.widgets[id] };
    }
    setWidgets(merged);
    setAutoRefresh(!!stored.autoRefresh);
  }, [studyId]);

  // Persist.
  useEffect(() => {
    if (!studyId) return;
    writeStored(studyId, { filters, widgets, autoRefresh });
  }, [studyId, filters, widgets, autoRefresh]);

  const setFilter = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => setFilters(defaultFilters()), []);
  const resetWidgets = useCallback(() => setWidgets(defaultWidgetConfig()), []);

  const toggleWidget = useCallback((id) => {
    setWidgets((prev) => ({
      ...prev,
      [id]: { ...prev[id], visible: !prev[id]?.visible },
    }));
  }, []);

  const moveWidget = useCallback((id, direction) => {
    setWidgets((prev) => {
      const entries = Object.entries(prev).sort((a, b) => a[1].order - b[1].order);
      const idx = entries.findIndex(([wid]) => wid === id);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= entries.length) return prev;
      [entries[idx], entries[target]] = [entries[target], entries[idx]];
      return entries.reduce((acc, [wid, cfg], i) => {
        acc[wid] = { ...cfg, order: i };
        return acc;
      }, {});
    });
  }, []);

  const orderedWidgetIds = useMemo(
    () => Object.entries(widgets).sort((a, b) => a[1].order - b[1].order).map(([id]) => id),
    [widgets],
  );

  return {
    filters, setFilter, resetFilters,
    widgets, orderedWidgetIds, toggleWidget, moveWidget, resetWidgets,
    autoRefresh, setAutoRefresh,
  };
}
