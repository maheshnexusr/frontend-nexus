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
    email:         raw.email        ?? raw.user_name,
    roleName:      raw.role_name     ?? null,
    actionType:    raw.action_type,
    module:        raw.module,
    feature:       raw.feature       ?? null,
    category:      raw.category      ?? null,
    entityType:    raw.entity_type,
    entityId:      raw.entity_id,
    entityName:    raw.entity_name,
    studyName:     raw.study_name    ?? null,
    siteName:      raw.site_name     ?? null,
    subjectName:   raw.subject_name  ?? null,
    organizationName: raw.organization_name ?? null,
    description:   raw.action_description,
    reason:        raw.reason        ?? null,
    status:        raw.status,          // 'SUCCESS' | 'FAILURE' | 'WARNING'
    severity:      raw.severity      ?? null, // INFO|LOW|MEDIUM|HIGH|CRITICAL
    riskLevel:     raw.risk_level    ?? null,
    ipAddress:     raw.ip_address,
    userAgent:     raw.user_agent    ?? null,
    browser:       raw.browser       ?? null,
    device:        raw.device        ?? null,
    os:            raw.os            ?? null,
    sessionId:     raw.session_id    ?? null,
    correlationId: raw.correlation_id ?? null,
    requestId:     raw.request_id    ?? null,
    apiEndpoint:   raw.api_endpoint  ?? null,
    httpMethod:    raw.http_method   ?? null,
    responseStatus: raw.response_status ?? null,
    executionTimeMs: raw.execution_time_ms ?? null,
    beforeValue:   raw.before_value  ?? null,
    afterValue:    raw.after_value   ?? null,
    // Structured per-field diff. `changes` (JSONB on the row) is present on list
    // + detail; `change_rows` (normalized table) only on detail. Either renders
    // as a Field / Old / New table — never raw JSON.
    changes:       raw.changes       ?? null,
    changeRows:    raw.change_rows   ?? null,
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
      severity:    params.severity,
      category:    params.category,
      risk_level:  params.risk_level  ?? params.riskLevel,
      study_id:    params.study_id    ?? params.studyId,
      site_id:     params.site_id     ?? params.siteId,
      subject_id:  params.subject_id  ?? params.subjectId,
      role:        params.role        ?? params.roleName,
      entity_type: params.entity_type ?? params.entityType,
      browser:     params.browser,
      device:      params.device,
      search:      params.search,
    };
    const res = await axiosClient.get(`/api/v1/activity-logs${buildQueryString(query)}`);
    return {
      items:      (res.items ?? []).map(normalizeLog),
      pagination: res.pagination ?? { page: 1, limit: query.limit ?? 50, total: 0 },
    };
  },

  /**
   * Activity dashboard summary (spec §Dashboard): today's count, critical
   * events, failed logins, top users / modules / studies, and a daily trend.
   * Returns the raw summary object from the backend.
   */
  dashboard: async (params = {}) => {
    const res = await axiosClient.get(
      `/api/v1/activity-logs/dashboard${buildQueryString({ days: params.days })}`,
    );
    return {
      todayCount:       res.todayCount       ?? 0,
      criticalCount:    res.criticalCount    ?? 0,
      failedLoginCount: res.failedLoginCount ?? 0,
      topUsers:         res.topUsers         ?? [],
      topModules:       res.topModules       ?? [],
      topStudies:       res.topStudies       ?? [],
      trend:            res.trend            ?? [],
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
   * Record a user-driven action emitted from the frontend. Used by surfaces
   * that mutate local state before any save (e.g. the Study Form Builder's
   * block / page / control deletions) so the action is auditable even if the
   * user never saves the surrounding form.
   *
   * payload: { actionType, module, entityType, entityId?, entityName?,
   *            description, beforeValue?, afterValue? }
   *
   * Failures are silent — auditing should never block the UX. Errors are
   * surfaced to the console only.
   */
  record: async (payload) => {
    try {
      await axiosClient.post('/api/v1/activity-logs', {
        actionType:  payload.actionType,
        module:      payload.module,
        entityType:  payload.entityType,
        entityId:    payload.entityId   ?? null,
        entityName:  payload.entityName ?? null,
        description: payload.description,
        beforeValue: payload.beforeValue ?? null,
        afterValue:  payload.afterValue  ?? null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[activityLog] record failed', err?.message ?? err);
    }
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
