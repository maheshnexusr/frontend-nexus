/**
 * studyService.js
 * Clinical study API calls.
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

export const studyService = {
  /* ── CRUD ─────────────────────────────────────────────────────────────── */

  /**
   * List studies with optional filters.
   * @param {{ status?, sponsorId?, search?, page?, pageSize? }} params
   */
  list: (params = {}) =>
    axiosClient.get(`/studies${buildQueryString(params)}`),

  /** Get a single study by ID. */
  getById: (id) =>
    axiosClient.get(`/studies/${id}`),

  /** Create a new study (all wizard steps in one payload). */
  create: (data) =>
    axiosClient.post('/studies', data),

  /** Update any step of an existing study. */
  update: (id, data) =>
    axiosClient.put(`/studies/${id}`, data),

  /** Soft-delete a study. */
  delete: (id) =>
    axiosClient.delete(`/studies/${id}`),

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  /** Publish a study to UAT or LIVE. */
  publish: (id, environment) =>
    axiosClient.post(`/studies/${id}/publish`, { environment }),

  /** Change study status (Active / Inactive / Locked). */
  changeStatus: (id, status) =>
    axiosClient.patch(`/studies/${id}/status`, { status }),

  /** Create a new version of a study. */
  createVersion: (id) =>
    axiosClient.post(`/studies/${id}/versions`),

  /* ── Form design ──────────────────────────────────────────────────────── */

  /** Save the study form builder design. */
  saveFormDesign: (id, studyFormData) =>
    axiosClient.put(`/studies/${id}/form`, { studyFormData }),

  /* ── Team & invitations ───────────────────────────────────────────────── */

  /** Assign team members to a study. */
  assignTeam: (id, memberIds) =>
    axiosClient.post(`/studies/${id}/team`, { memberIds }),

  /** Send an invitation email. */
  sendInvitation: (id, inviteeEmail) =>
    axiosClient.post(`/studies/${id}/invitations`, { email: inviteeEmail }),

  /* ── Export ───────────────────────────────────────────────────────────── */

  /**
   * Export study data.  The server returns a Blob (Excel/CSV/PDF).
   * @param {string} id
   * @param {'csv'|'xlsx'|'pdf'} format
   */
  export: (id, format = 'csv') =>
    axiosClient.get(`/studies/${id}/export`, {
      params:       { format },
      responseType: 'blob',
    }),
};
