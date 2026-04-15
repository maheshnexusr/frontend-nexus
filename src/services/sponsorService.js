/**
 * sponsorService.js
 * Sponsor CRUD — /api/v1/sponsors
 *
 * create / update use multipart/form-data (photograph upload).
 * export triggers a CSV browser download.
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob, filename = 'sponsors.csv') {
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href     = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const sponsorService = {
  /**
   * GET /api/v1/sponsors
   * params: { page, pageSize, search, status }
   * Returns: { success, items, pagination }
   */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/sponsors${buildQueryString(params)}`),

  /**
   * GET /api/v1/sponsors/:id
   * Returns: { success, item }
   */
  getById: (id) =>
    axiosClient.get(`/api/v1/sponsors/${id}`),

  /**
   * POST /api/v1/sponsors  (multipart/form-data)
   * formData fields: fullName*, emailAddress*, organizationName*, registrationNumber*,
   *                  photograph (file), contactNumber, website, addressLine1,
   *                  addressLine2, locationId, countryId, status
   * Returns: { success, item }
   */
  create: (formData) =>
    axiosClient.post('/api/v1/sponsors', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * PUT /api/v1/sponsors/:id  (multipart/form-data)
   * Returns: { success, item }
   */
  update: (id, formData) =>
    axiosClient.put(`/api/v1/sponsors/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * DELETE /api/v1/sponsors/:id
   * Returns: { success, item }
   */
  delete: (id) =>
    axiosClient.delete(`/api/v1/sponsors/${id}`),

  /**
   * GET /api/v1/sponsors/export
   * Triggers a CSV file download in the browser.
   */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/sponsors/export', { responseType: 'blob' });
    csvDownload(blob, 'sponsors.csv');
  },
};
