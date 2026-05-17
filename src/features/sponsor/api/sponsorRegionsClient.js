/**
 * sponsorRegionsClient — Sponsor study-scoped region master.
 *
 * Base: /api/v1/sponsor/workspace/masters/regions (non-spec extension — spec
 * §13.7 lists only countries and locations under /masters).
 * Sponsor Bearer + (study_id, environment) auto-attached.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE = '/api/v1/sponsor/workspace/masters/regions';

function normalize(raw) {
  return {
    id:          raw.region_id   ?? raw.id,
    regionName:  raw.region_name ?? raw.regionName ?? '',
    description: raw.description ?? '',
    status:      raw.status      ?? 'Active',
    createdAt:   raw.created_at  ?? raw.createdAt,
    updatedAt:   raw.updated_at  ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  return arr.map(normalize);
}

export const sponsorRegionsClient = {
  async list(_studyId) {
    const res = await sponsorAxiosClient.get(BASE);
    return extractList(res);
  },

  async getById(_studyId, id) {
    const res = await sponsorAxiosClient.get(`${BASE}/${id}`);
    return normalize(res?.item ?? res);
  },

  async create(_studyId, form) {
    const res = await sponsorAxiosClient.post(BASE, {
      region_name: form.regionName,
      description: form.description || undefined,
      status:      form.status ?? 'Active',
    });
    return normalize(res?.item ?? res);
  },

  async update(_studyId, id, form) {
    const res = await sponsorAxiosClient.put(`${BASE}/${id}`, {
      region_name: form.regionName,
      description: form.description || undefined,
      status:      form.status,
    });
    return normalize(res?.item ?? res);
  },

  async delete(_studyId, id) {
    return sponsorAxiosClient.delete(`${BASE}/${id}`);
  },

  nameExists:        () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
