/**
 * countriesClient — real API client for Countries.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:          raw.country_id        ?? raw.id,
    countryName: raw.country_name      ?? raw.countryName ?? '',
    isoCode:     raw.iso_code          ?? raw.isoCode     ?? '',
    phoneCode:   raw.phone_code        ?? raw.phoneCode   ?? '',
    status:      raw.status            ?? 'Active',
    isSystem:    raw.is_system_country ?? false,
    createdAt:   raw.created_at        ?? raw.createdAt,
    updatedAt:   raw.updated_at        ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? res?.countries ?? []);
  return arr.map(normalize);
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const countriesClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/masters/countries');
    return extractList(res);
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/masters/countries', {
      country_name: data.countryName,
      iso_code:     data.isoCode   || undefined,
      phone_code:   data.phoneCode || undefined,
      status:       data.status ?? 'Active',
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/masters/countries/${id}`, {
      country_name: data.countryName,
      iso_code:     data.isoCode   || undefined,
      phone_code:   data.phoneCode || undefined,
      status:       data.status,
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/masters/countries/${id}`);
  },

  /**
   * Bulk-import countries from a CSV or XLSX file.
   *
   * Backend contract:
   *   - File: `Countries.csv` or `Countries.xlsx` (sheet name `Countries`)
   *   - Columns: Country Name, Description, Status
   *   - Duplicates (by Country Name) are skipped, not overwritten.
   *   - Successful imports are recorded in the master Activity Log.
   *
   * `onProgress` is invoked with a percentage (0–100) as the file uploads.
   */
  async bulkImport(file, { onProgress } = {}) {
    const fd = new FormData();
    fd.append('file', file);
    return axiosClient.post('/api/v1/masters/countries/import', fd, {
      onUploadProgress: (evt) => {
        if (!onProgress || !evt?.total) return;
        const pct = Math.round((evt.loaded * 100) / evt.total);
        onProgress(pct);
      },
    });
  },

  // Validation stubs — backend enforces uniqueness / dependency constraints
  nameExists:        () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
