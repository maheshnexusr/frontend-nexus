/**
 * locationsClient — real API client for Locations.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:          raw.location_id        ?? raw.id,
    countryId:   raw.country_id         ?? raw.countryId ?? '',
    countryName: raw.country_name       ?? raw.countryName ?? '',
    state:       raw.state              ?? '',
    district:    raw.district           ?? '',
    city:        raw.city               ?? '',
    postalCode:  raw.postal_code        ?? raw.postalCode ?? '',
    status:      raw.status             ?? 'Active',
    isSystem:    raw.is_system_location ?? false,
    createdAt:   raw.created_at         ?? raw.createdAt,
    updatedAt:   raw.updated_at         ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? res?.locations ?? []);
  return arr.map(normalize);
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const locationsClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/masters/locations');
    return extractList(res);
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/masters/locations', {
      country_id:  data.countryId,
      state:       data.state,
      city:        data.city,
      postal_code: data.postalCode,
      district:    data.district   || undefined,
      status:      data.status     ?? 'Active',
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/masters/locations/${id}`, {
      country_id:  data.countryId,
      state:       data.state,
      city:        data.city,
      postal_code: data.postalCode,
      district:    data.district   || undefined,
      status:      data.status,
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/masters/locations/${id}`);
  },

  async bulkImport(file) {
    const fd = new FormData();
    fd.append('file', file);
    return axiosClient.post('/api/v1/masters/locations/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Validation stubs — backend enforces uniqueness / dependency constraints
  combinationExists: () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
