/**
 * regionsClient — real API client for Regions.
 * Normalizes snake_case API response to camelCase for the UI.
 */

import axiosClient from '@/api/axiosClient';

function normalize(raw) {
  return {
    id:          raw.region_id   ?? raw.id,
    regionName:  raw.region_name ?? raw.regionName,
    description: raw.description ?? '',
    status:      raw.status      ?? 'Active',
    isSystem:    raw.is_system_region ?? false,
    displayOrder: raw.display_order ?? null,
    createdAt:   raw.created_at  ?? raw.createdAt,
    updatedAt:   raw.updated_at  ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res)
    ? res
    : (res?.items ?? res?.data ?? res?.regions ?? []);
  return arr.map(normalize);
}

export const regionsClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/masters/regions');
    return extractList(res);
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/masters/regions', {
      region_name: data.regionName,
      description: data.description ?? '',
      status:      data.status ?? 'Active',
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/masters/regions/${id}`, {
      region_name: data.regionName,
      description: data.description ?? '',
      status:      data.status,
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/masters/regions/${id}`);
  },

  // Validation stubs — backend enforces uniqueness and dependency constraints
  nameExists:        () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
