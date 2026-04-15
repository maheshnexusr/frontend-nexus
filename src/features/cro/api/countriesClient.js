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
      status:       data.status ?? 'Active',
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/masters/countries/${id}`, {
      country_name: data.countryName,
      status:       data.status,
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/masters/countries/${id}`);
  },

  async bulkImport(file) {
    const fd = new FormData();
    fd.append('file', file);
    return axiosClient.post('/api/v1/masters/countries/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Validation stubs — backend enforces uniqueness / dependency constraints
  nameExists:        () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
