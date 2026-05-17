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
   * GET /api/v1/masters/locations (spec §5.4)
   * Accepts camelCase: { page, pageSize, search, status, countryId }
   * Sends snake_case:  ?page=&limit=&search=&status=&country_id=
   */
  list: (params = {}) => {
    const query = {
      page:       params.page,
      limit:      params.limit      ?? params.pageSize,
      search:     params.search,
      status:     params.status,
      country_id: params.country_id ?? params.countryId,
    };
    return axiosClient.get(`/api/v1/masters/locations${buildQueryString(query)}`);
  },

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
    }),

  /** GET /api/v1/masters/locations/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/locations/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
