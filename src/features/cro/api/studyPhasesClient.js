/**
 * studyPhasesClient — real API client for Study Phases.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:          raw.phase_id    ?? raw.id,
    phaseName:   raw.phase_name  ?? raw.phaseName ?? '',
    description: raw.description ?? '',
    status:      raw.status      ?? 'Active',
    createdAt:   raw.created_at  ?? raw.createdAt,
    updatedAt:   raw.updated_at  ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? res?.phases ?? []);
  return arr.map(normalize);
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const studyPhasesClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/masters/study-phases');
    return extractList(res);
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/masters/study-phases', {
      phase_name:  data.phaseName,
      description: data.description ?? '',
      status:      data.status      ?? 'Active',
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/masters/study-phases/${id}`, {
      phase_name:  data.phaseName,
      description: data.description ?? '',
      status:      data.status,
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/masters/study-phases/${id}`);
  },

  // Validation stubs — backend enforces uniqueness / dependency constraints
  nameExists:        () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
