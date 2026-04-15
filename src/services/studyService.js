/**
 * studyService.js
 * Clinical study API calls — /api/v1/studies
 *
 * Studies are created/edited via a 5-step wizard.
 * Each step has its own PUT endpoint; step 1 creation uses POST.
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob, filename = 'studies.csv') {
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href     = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const studyService = {
  /**
   * GET /api/v1/studies
   * params: { page, pageSize, search, status, sponsorId }
   * Returns: { success, items, pagination }
   */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/studies${buildQueryString(params)}`),

  /**
   * GET /api/v1/studies/:id
   * Returns: { success, item } — includes configuration, form_definition,
   *          triggers, team_assignments, versions
   */
  getById: (id) =>
    axiosClient.get(`/api/v1/studies/${id}`),

  /* ── Wizard steps ──────────────────────────────────────────────────────── */

  /**
   * POST /api/v1/studies/step-1  (create)
   * Payload: { protocolNumber, studyTitle, studyPhaseId, sponsorId,
   *            scopes, therapeuticArea?, studyDescription? }
   * Returns: { success, item }
   */
  createStep1: (data) =>
    axiosClient.post('/api/v1/studies/step-1', data),

  /**
   * PUT /api/v1/studies/:id/step-1
   * Same payload as createStep1.
   */
  updateStep1: (id, data) =>
    axiosClient.put(`/api/v1/studies/${id}/step-1`, data),

  /**
   * PUT /api/v1/studies/:id/step-2
   * Payload: { startDate, expectedEndDate, maxEnrollments, coverageType,
   *            coverageId, maxSites, randomizationMethod? }
   */
  updateStep2: (id, data) =>
    axiosClient.put(`/api/v1/studies/${id}/step-2`, data),

  /**
   * PUT /api/v1/studies/:id/step-3
   * Payload: { enableConsentManager, enableQueryManager,
   *            enableDataManager, enableNavigationBar }
   */
  updateStep3: (id, data) =>
    axiosClient.put(`/api/v1/studies/${id}/step-3`, data),

  /**
   * PUT /api/v1/studies/:id/step-4
   * Payload: { formStructure, version, triggers[] }
   */
  updateStep4: (id, data) =>
    axiosClient.put(`/api/v1/studies/${id}/step-4`, data),

  /**
   * PUT /api/v1/studies/:id/step-5
   * Payload: { assignments: [{ teamMemberId, studyRole }] }
   */
  updateStep5: (id, data) =>
    axiosClient.put(`/api/v1/studies/${id}/step-5`, data),

  /* ── Lifecycle ─────────────────────────────────────────────────────────── */

  /**
   * POST /api/v1/studies/:id/publish
   * Payload: { environment: 'UAT'|'LIVE', status?, description? }
   * Returns: { success, item } — version row with provisioned flag
   */
  publish: (id, payload) =>
    axiosClient.post(`/api/v1/studies/${id}/publish`, payload),

  /**
   * POST /api/v1/studies/:id/invitations
   * Payload: { versionId, environment, recipients: [{ email, recipientType }] }
   */
  sendInvitations: (id, payload) =>
    axiosClient.post(`/api/v1/studies/${id}/invitations`, payload),

  /* ── Export ────────────────────────────────────────────────────────────── */

  /**
   * GET /api/v1/studies/export
   * Triggers a CSV file download in the browser.
   */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/studies/export', { responseType: 'blob' });
    csvDownload(blob, 'studies.csv');
  },
};
