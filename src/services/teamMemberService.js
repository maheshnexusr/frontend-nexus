/**
 * teamMemberService.js
 * Team member CRUD — /api/v1/team-members
 *
 * create / update use multipart/form-data (photograph upload).
 * studyIds[] is sent as repeated form fields.
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob, filename = 'team-members.csv') {
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href     = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const teamMemberService = {
  /**
   * GET /api/v1/team-members
   * params: { page, pageSize, search }
   * Returns: { success, items, pagination }
   */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/team-members${buildQueryString(params)}`),

  /**
   * GET /api/v1/team-members/:id
   * Returns: { success, item }  — includes role_name, study_ids[]
   */
  getById: (id) =>
    axiosClient.get(`/api/v1/team-members/${id}`),

  /**
   * POST /api/v1/team-members  (multipart/form-data)
   * Fields: fullName*, emailAddress*, roleId*, photograph (file)*,
   *         contactNumber, studyIds[]
   * Returns: { success, item }
   */
  create: (formData) =>
    axiosClient.post('/api/v1/team-members', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * PUT /api/v1/team-members/:id  (multipart/form-data)
   * Fields: fullName*, roleId*, photograph (file), emailAddress,
   *         contactNumber, studyIds[]
   * Returns: { success, item }
   */
  update: (id, formData) =>
    axiosClient.put(`/api/v1/team-members/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * DELETE /api/v1/team-members/:id
   * Returns: { success, item }
   */
  delete: (id) =>
    axiosClient.delete(`/api/v1/team-members/${id}`),

  /**
   * GET /api/v1/team-members/export
   * Triggers a CSV file download in the browser.
   */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/team-members/export', { responseType: 'blob' });
    csvDownload(blob, 'team-members.csv');
  },
};
