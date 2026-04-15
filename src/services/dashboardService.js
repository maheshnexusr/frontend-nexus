/**
 * dashboardService.js
 * CRO dashboard data — /api/v1/dashboard
 */

import axiosClient from '@/api/axiosClient';

export const dashboardService = {
  /**
   * GET /api/v1/dashboard
   * Returns: { success, portfolio, teamUtilization, enrollmentProgress,
   *            sitePerformance, dataQuality, monitoringActivities,
   *            alerts, environmentStatus }
   */
  get: () =>
    axiosClient.get('/api/v1/dashboard'),

  /**
   * POST /api/v1/dashboard/sync
   * Returns: { success, message }
   */
  sync: () =>
    axiosClient.post('/api/v1/dashboard/sync'),
};
