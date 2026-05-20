/**
 * sponsorVisitsClient — per-subject visit timeline for the sponsor workspace.
 *
 * Returns the same shape as the site equivalent. 404 → [] so the UI can
 * fall back to the flat-forms view until the backend ships.
 *
 *   GET /api/v1/sponsor/workspace/subjects/:subjectId/visits
 *     → [{
 *         visit_id, visit_name, visit_order, visit_window_days,
 *         scheduled_date, completed_date, status,
 *         forms: [{ form_id, form_name, status, last_updated }]
 *       }]
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE = '/api/v1/sponsor/workspace';

function normalize(raw) {
  return {
    id:              raw.visit_id        ?? raw.id,
    name:            raw.visit_name      ?? raw.name      ?? '',
    order:           raw.visit_order     ?? raw.order     ?? 0,
    windowDays:      raw.visit_window_days ?? raw.windowDays ?? null,
    scheduledDate:   raw.scheduled_date  ?? raw.scheduledDate ?? null,
    completedDate:   raw.completed_date  ?? raw.completedDate ?? null,
    status:          raw.status          ?? 'Pending',
    forms: (raw.forms ?? []).map((f) => ({
      id:          f.form_id     ?? f.id,
      name:        f.form_name   ?? f.name ?? '',
      status:      f.status      ?? 'Not Started',
      lastUpdated: f.last_updated ?? f.lastUpdated ?? null,
    })),
  };
}

export const sponsorVisitsClient = {
  async listForSubject(subjectId) {
    try {
      const res = await sponsorAxiosClient.get(`${BASE}/subjects/${subjectId}/visits`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.visits ?? res?.data ?? []);
      return arr.map(normalize);
    } catch (err) {
      if (err?.response?.status === 404) return [];
      throw err;
    }
  },
};
