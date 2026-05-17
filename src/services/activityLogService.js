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
   * List activity logs with filters + pagination (spec §9).
   *
   * Accepts camelCase:  { page, pageSize, dateFrom, dateTo, userId, module,
   *                       actionType, status, search }
   * Sends snake_case:   ?page=&limit=&from=&to=&user_id=&module=&action_type=&status=&search=
   * Returns: { items: Log[], pagination: { page, limit, total, totalPages } }
   */
  list: async (params = {}) => {
    const query = {
      page:        params.page,
      limit:       params.limit       ?? params.pageSize,
      from:        params.from        ?? params.dateFrom,
      to:          params.to          ?? params.dateTo,
      user_id:     params.user_id     ?? params.userId,
      module:      params.module,
      action_type: params.action_type ?? params.actionType,
      status:      params.status,
      search:      params.search,
    };
    const res = await axiosClient.get(`/api/v1/activity-logs${buildQueryString(query)}`);
    return {
      items:      (res.items ?? []).map(normalizeLog),
      pagination: res.pagination ?? { page: 1, limit: query.limit ?? 50, total: 0 },
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
   * Accepts the same filter params as list(); mapped to spec §9 names.
   */
  export: async (params = {}) => {
    const query = {
      from:        params.from        ?? params.dateFrom,
      to:          params.to          ?? params.dateTo,
      user_id:     params.user_id     ?? params.userId,
      module:      params.module,
      action_type: params.action_type ?? params.actionType,
      status:      params.status,
      search:      params.search,
    };
    const res = await axiosClient.get(`/api/v1/activity-logs/export${buildQueryString(query)}`, {
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
