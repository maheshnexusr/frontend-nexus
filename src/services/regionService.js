/**
 * regionService.js
 * Region master data — /api/v1/masters/regions
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = 'regions.csv'; a.click();
  URL.revokeObjectURL(url);
}

export const regionService = {
  /** GET /api/v1/masters/regions — params: { page, pageSize, search, status } */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/masters/regions${buildQueryString(params)}`),

  /** POST /api/v1/masters/regions — { regionName, description?, displayOrder, status? } */
  create: (data) =>
    axiosClient.post('/api/v1/masters/regions', data),

  /** PUT /api/v1/masters/regions/:id */
  update: (id, data) =>
    axiosClient.put(`/api/v1/masters/regions/${id}`, data),

  /** DELETE /api/v1/masters/regions/:id */
  delete: (id) =>
    axiosClient.delete(`/api/v1/masters/regions/${id}`),

  /** GET /api/v1/masters/regions/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/regions/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
