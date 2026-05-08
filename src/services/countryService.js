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
  /**
   * GET /api/v1/masters/countries (spec §5.3)
   * Accepts camelCase: { page, pageSize, search, status }
   * Sends snake_case:  ?page=&limit=&search=&status=
   */
  list: (params = {}) => {
    const query = {
      page:   params.page,
      limit:  params.limit ?? params.pageSize,
      search: params.search,
      status: params.status,
    };
    return axiosClient.get(`/api/v1/masters/countries${buildQueryString(query)}`);
  },

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
    }),

  /** GET /api/v1/masters/countries/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/countries/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
