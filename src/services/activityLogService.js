/**
 * activityLogService.js
 * Activity log API calls — /api/v1/activity-logs
 *
 * Response normalization:
 *   list    → { items: Log[], pagination: { page, pageSize, total } }
 *   getById → Log
 *   export  → triggers a CSV file download in-browser
 *
 * Log shape (normalized from snake_case):
 *   id, userId, userName, actionType, module, entityType,
 *   entityId, entityName, description, status, ipAddress,
 *   userAgent (detail only), timestamp
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

/* ── Field normalizer ─────────────────────────────────────────────────────── */
function normalizeLog(raw) {
  return {
    id:            raw.log_id,
    userId:        raw.user_id,
    userName:      raw.user_name,
    actionType:    raw.action_type,
    module:        raw.module,
    entityType:    raw.entity_type,
    entityId:      raw.entity_id,
    entityName:    raw.entity_name,
    description:   raw.action_description,
    status:        raw.status,          // 'SUCCESS' | 'FAILURE' | 'WARNING'
    ipAddress:     raw.ip_address,
    userAgent:     raw.user_agent    ?? null,
    sessionId:     raw.session_id    ?? null,
    beforeValue:   raw.before_value  ?? null,
    afterValue:    raw.after_value   ?? null,
    failureReason: raw.failure_reason ?? null,
    timestamp:     raw.timestamp,
  };
}

/* ── Service ──────────────────────────────────────────────────────────────── */
export const activityLogService = {
  /**
   * List activity logs with filters + pagination.
   *
   * Params: { page, pageSize, dateFrom, dateTo, userId, module,
   *           actionType, status, search }
   *
   * Returns: { items: Log[], pagination: { page, pageSize, total } }
   */
  list: async (params = {}) => {
    const res = await axiosClient.get(`/api/v1/activity-logs${buildQueryString(params)}`);
    return {
      items:      (res.items ?? []).map(normalizeLog),
      pagination: res.pagination ?? { page: 1, pageSize: params.pageSize ?? 50, total: 0 },
    };
  },

  /**
   * Fetch a single activity log entry by ID.
   * Returns: Log (with userAgent field)
   */
  getById: async (id) => {
    const res = await axiosClient.get(`/api/v1/activity-logs/${id}`);
    return normalizeLog(res.item ?? res);
  },

  /**
   * Export filtered logs as CSV and trigger a browser download.
   * Accepts the same filter params as list().
   */
  export: async (params = {}) => {
    const res = await axiosClient.get(`/api/v1/activity-logs/export${buildQueryString(params)}`, {
      responseType: 'blob',
    });
    const url      = URL.createObjectURL(res);
    const anchor   = document.createElement('a');
    anchor.href    = url;
    anchor.download = 'activity_logs.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
