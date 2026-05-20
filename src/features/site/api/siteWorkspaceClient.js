/**
 * siteWorkspaceClient — site-personnel workspace endpoints (tenant DB).
 *
 *   GET    /api/v1/site/workspace/dashboard
 *   GET    /api/v1/site/workspace/subjects
 *   GET    /api/v1/site/workspace/subjects/:subjectId
 *   POST   /api/v1/site/workspace/subjects
 *   PATCH  /api/v1/site/workspace/subjects/:subjectId
 *
 * Requires a study-scoped WORKSPACE token (obtained from
 * siteStudyClient.choose). siteAxiosClient sends that token and auto-injects
 * study_id + environment for every /api/v1/site/workspace/* request. The
 * backend further pins every read/write to the user's site_id from the JWT.
 */

import siteAxiosClient from '@/api/siteAxiosClient';

const BASE = '/api/v1/site/workspace';

export const siteWorkspaceClient = {
  /** Site dashboard for the currently chosen study. */
  async dashboard() {
    return siteAxiosClient.get(`${BASE}/dashboard`);
  },

  /** List subjects assigned to this site (for the currently chosen study). */
  async listSubjects(params = {}) {
    return siteAxiosClient.get(`${BASE}/subjects`, { params });
  },

  async getSubject(subjectId) {
    return siteAxiosClient.get(`${BASE}/subjects/${subjectId}`);
  },

  async createSubject(payload) {
    return siteAxiosClient.post(`${BASE}/subjects`, payload);
  },

  async updateSubject(subjectId, payload) {
    return siteAxiosClient.patch(`${BASE}/subjects/${subjectId}`, payload);
  },

  /** Forms defined for the chosen study (latest version per form). */
  async listForms() {
    return siteAxiosClient.get(`${BASE}/forms`);
  },

  /** One form's schema. */
  async getForm(formId) {
    return siteAxiosClient.get(`${BASE}/forms/${formId}`);
  },

  /** Saved answers for a (subject, form) pair. Returns null inside `data`
   *  when nothing has been captured yet. */
  async getSubjectFormData(subjectId, formId) {
    return siteAxiosClient.get(`${BASE}/subjects/${subjectId}/forms/${formId}/data`);
  },

  /** Upsert (subject, form) answers. `status` may be 'Draft' or 'Submitted'. */
  async saveSubjectFormData(subjectId, formId, payload) {
    return siteAxiosClient.post(`${BASE}/subjects/${subjectId}/forms/${formId}/data`, payload);
  },

  /**
   * Phase 2 — Visit timeline. Returns the ordered list of visits configured
   * for this study, plus the per-subject status of each form within each
   * visit. Returns [] on 404 so the UI degrades to the legacy flat-forms
   * view until the backend ships.
   *
   * Expected shape per visit:
   *   {
   *     visit_id, visit_name, visit_order, visit_window_days,
   *     scheduled_date, completed_date, status,
   *     forms: [{ form_id, form_name, status, last_updated }]
   *   }
   */
  async listVisits(subjectId) {
    try {
      return await siteAxiosClient.get(`${BASE}/subjects/${subjectId}/visits`);
    } catch (err) {
      if (err?.response?.status === 404) return [];
      throw err;
    }
  },
};

export default siteWorkspaceClient;
