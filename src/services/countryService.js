/**
 * countryService.js
 * Country master data — /api/v1/masters/countries
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = 'countries.csv'; a.click();
  URL.revokeObjectURL(url);
}

export const countryService = {
  /** GET /api/v1/masters/countries — params: { page, pageSize, search, status } */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/masters/countries${buildQueryString(params)}`),

  /** POST /api/v1/masters/countries — { countryName, status? } */
  create: (data) =>
    axiosClient.post('/api/v1/masters/countries', data),

  /** PUT /api/v1/masters/countries/:id — { countryName, status? } */
  update: (id, data) =>
    axiosClient.put(`/api/v1/masters/countries/${id}`, data),

  /** DELETE /api/v1/masters/countries/:id */
  delete: (id) =>
    axiosClient.delete(`/api/v1/masters/countries/${id}`),

  /**
   * POST /api/v1/masters/countries/import  (multipart/form-data)
   * file: CSV with columns country_name, status
   * Returns: { success, message, imported, skipped }
   */
  import: (formData) =>
    axiosClient.post('/api/v1/masters/countries/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** GET /api/v1/masters/countries/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/countries/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
