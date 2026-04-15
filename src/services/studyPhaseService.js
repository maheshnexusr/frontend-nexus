/**
 * studyPhaseService.js
 * Study phase master data — /api/v1/masters/study-phases
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = 'study-phases.csv'; a.click();
  URL.revokeObjectURL(url);
}

export const studyPhaseService = {
  /** GET /api/v1/masters/study-phases — params: { page, pageSize, search, status } */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/masters/study-phases${buildQueryString(params)}`),

  /** POST /api/v1/masters/study-phases — { phaseName, description?, status? } */
  create: (data) =>
    axiosClient.post('/api/v1/masters/study-phases', data),

  /** PUT /api/v1/masters/study-phases/:id */
  update: (id, data) =>
    axiosClient.put(`/api/v1/masters/study-phases/${id}`, data),

  /** DELETE /api/v1/masters/study-phases/:id */
  delete: (id) =>
    axiosClient.delete(`/api/v1/masters/study-phases/${id}`),

  /** GET /api/v1/masters/study-phases/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/study-phases/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
