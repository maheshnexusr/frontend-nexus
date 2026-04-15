/**
 * locationService.js
 * Location master data — /api/v1/masters/locations
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = 'locations.csv'; a.click();
  URL.revokeObjectURL(url);
}

export const locationService = {
  /**
   * GET /api/v1/masters/locations
   * params: { page, pageSize, search, status, countryId }
   */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/masters/locations${buildQueryString(params)}`),

  /**
   * POST /api/v1/masters/locations
   * { countryId, state, city, postalCode, district?, status? }
   */
  create: (data) =>
    axiosClient.post('/api/v1/masters/locations', data),

  /** PUT /api/v1/masters/locations/:id */
  update: (id, data) =>
    axiosClient.put(`/api/v1/masters/locations/${id}`, data),

  /** DELETE /api/v1/masters/locations/:id */
  delete: (id) =>
    axiosClient.delete(`/api/v1/masters/locations/${id}`),

  /**
   * POST /api/v1/masters/locations/import  (multipart/form-data)
   * file: CSV with columns country, state, district, city, postal_code, status
   * Returns: { success, message, imported, skipped }
   */
  import: (formData) =>
    axiosClient.post('/api/v1/masters/locations/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** GET /api/v1/masters/locations/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/locations/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
