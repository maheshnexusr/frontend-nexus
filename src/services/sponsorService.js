/**
 * sponsorService.js
 * Sponsor API calls.
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

export const sponsorService = {
  list: (params = {}) =>
    axiosClient.get(`/sponsors${buildQueryString(params)}`),

  getById: (id) =>
    axiosClient.get(`/sponsors/${id}`),

  create: (data) =>
    axiosClient.post('/sponsors', data),

  update: (id, data) =>
    axiosClient.put(`/sponsors/${id}`, data),

  delete: (id) =>
    axiosClient.delete(`/sponsors/${id}`),

  sendInvitation: (id) =>
    axiosClient.post(`/sponsors/${id}/invite`),

  export: (format = 'csv') =>
    axiosClient.get(`/sponsors/export`, {
      params:       { format },
      responseType: 'blob',
    }),
};
