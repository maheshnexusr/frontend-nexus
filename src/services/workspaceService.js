/**
 * workspaceService.js
 * Workspace / sponsor selector — /api/v1/workspace
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

export const workspaceService = {
  /**
   * GET /api/v1/workspace/sponsors
   * params: { search? }
   * Returns: { success, mainDashboard, sponsors[] }
   */
  listSponsors: (params = {}) =>
    axiosClient.get(`/api/v1/workspace/sponsors${buildQueryString(params)}`),
};
