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
  /** Consent login gate — the published consent template this user still needs
   *  to accept (or null). */
  async pendingConsent() {
    return siteAxiosClient.get(`${BASE}/consent/pending`);
  },

  /** Record agreement to the consent template (logs the activity) and submit the
   *  filled-in answers + signature for Sponsor/CRO review. `extra` carries
   *  { responses, signatureDataUrl, version }. */
  async acceptConsent(templateId, extra = {}) {
    return siteAxiosClient.post(`${BASE}/consent/accept`, { template_id: templateId, ...extra });
  },

  /** Site dashboard for the currently chosen study. Optional date range
   *  ({ dateFrom, dateTo }) scopes the day-wise enrollment graph. */
  async dashboard({ dateFrom, dateTo } = {}) {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    return siteAxiosClient.get(`${BASE}/dashboard`, { params });
  },

  /** List subjects assigned to this site (for the currently chosen study). */
  async listSubjects(params = {}) {
    return siteAxiosClient.get(`${BASE}/subjects`, { params });
  },

  async getSubject(subjectId) {
    return siteAxiosClient.get(`${BASE}/subjects/${subjectId}`);
  },

  /** Inclusion/Exclusion screening report (auto-scoped to this site). */
  async screeningReport() {
    return siteAxiosClient.get(`${BASE}/screening-report`);
  },

  async createSubject(payload) {
    return siteAxiosClient.post(`${BASE}/subjects`, payload);
  },

  async updateSubject(subjectId, payload) {
    return siteAxiosClient.patch(`${BASE}/subjects/${subjectId}`, payload);
  },

  /** Controlled unlock — reopen a Submitted form back to editable (gated by
   *  data_capture.reopen, requires a reason). */
  async reopenForm(subjectId, formId, reason) {
    return siteAxiosClient.post(`${BASE}/subjects/${subjectId}/forms/${formId}/reopen`, { reason });
  },

  /** Hard-delete a subject and all its data (gated by data_capture.subject_delete). */
  async deleteSubject(subjectId) {
    return siteAxiosClient.delete(`${BASE}/subjects/${subjectId}`);
  },

  /**
   * Transfer subject ownership to another PI. Moves owner_id + all open
   * queries to the new owner and writes an audit row. Gated by
   * data_capture.subject_edit.
   *   payload = { new_owner_id, reason }
   */
  async transferSubjectOwnership(subjectId, payload) {
    return siteAxiosClient.post(`${BASE}/subjects/${subjectId}/transfer-ownership`, payload);
  },

  /** Ownership-transfer history for a subject (newest first). */
  async listSubjectOwnershipTransfers(subjectId) {
    return siteAxiosClient.get(`${BASE}/subjects/${subjectId}/ownership-transfers`);
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

  /** Mark a page Completed → creates the Verification Manager work-item. */
  async markPageCompleted(subjectId, formId, pageId, pageTitle) {
    return siteAxiosClient.post(
      `${BASE}/subjects/${subjectId}/forms/${formId}/pages/${pageId}/complete`,
      { page_title: pageTitle ?? null }
    );
  },

  /** Verify a page — `fields` = [{ field_name, verified, comment }]. */
  async verifyPage(payload) {
    return siteAxiosClient.post(`${BASE}/data-verifications/verify-page`, payload);
  },

  /** Per-page completion/verification status for one (subject, form). Returns
   *  `{ pages: [{ page_id, status, completed_at, ... }] }`. */
  async getPageStatuses(subjectId, formId) {
    return siteAxiosClient.get(`${BASE}/subjects/${subjectId}/forms/${formId}/page-status`);
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

  /** Site personnel for this study/site — used by the Query "Associated"
   *  dropdown so a query can be routed to a real person (PI, CRC, …).
   *  Uses the lookup endpoint (gated on data_capture.view) so a site Query
   *  Manager without site_personnel.view can still populate the dropdown. */
  async listPersonnel() {
    return siteAxiosClient.get(`${BASE}/lookups/site-personnel`);
  },
};

export default siteWorkspaceClient;
