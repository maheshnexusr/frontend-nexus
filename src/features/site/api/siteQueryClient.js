/**
 * siteQueryClient — Query Management endpoints for the site workspace.
 *
 *   GET  /api/v1/site/workspace/queries
 *   GET  /api/v1/site/workspace/queries/:queryId
 *   POST /api/v1/site/workspace/queries/:queryId/answer
 *
 * Uses the study-scoped WORKSPACE token from siteAxiosClient; the backend
 * pins every read to the user's site_id. Site personnel typically respond to
 * queries (cannot close them — that's a sponsor/CRO action).
 *
 * Normalizers mirror sponsorQueryClient so the same UI columns work in both
 * portals.
 */

import siteAxiosClient from '@/api/siteAxiosClient';

const BASE = '/api/v1/site/workspace/queries';

export const PRIORITY_SLA_DAYS = { High: 1, Medium: 3, Low: 7 };

const SEVERITY_FROM_PRIORITY = { High: 'Critical', Medium: 'Major', Low: 'Minor' };
const PRIORITY_FROM_SEVERITY = { Critical: 'High', Major: 'Medium', Minor: 'Low' };

function daysOpen(dateStr) {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function slaRemaining(priority, dateStr) {
  const sla = PRIORITY_SLA_DAYS[priority] ?? 7;
  return sla - daysOpen(dateStr);
}

function normalizeQuery(raw) {
  const severity   = raw.severity ?? raw.priority ?? 'Major';
  const priority   = PRIORITY_FROM_SEVERITY[severity] ?? raw.priority ?? 'Medium';
  const status     = raw.status     ?? 'Open';
  const raisedDate = raw.raised_date ?? raw.raisedDate ?? raw.created_at ?? '';
  return {
    id:           raw.id           ?? raw.query_id    ?? raw.queryId ?? '',
    studyName:    raw.study_name   ?? raw.studyName   ?? '',
    siteName:     raw.site_name    ?? raw.siteName    ?? '',
    siteCode:     raw.site_number  ?? raw.siteNumber  ?? raw.site_code ?? raw.siteCode ?? '',
    siteId:       raw.site_id      ?? raw.siteId      ?? raw.site_code ?? raw.siteCode ?? '',
    subjectId:    raw.subject_id   ?? raw.subjectId   ?? '',
    subjectInitials: raw.subject_initials ?? raw.subjectInitials ?? '',
    // FormQueriesContext filters by (subjectId, formId) so the per-field /
    // per-page / per-block count badges work. Without formId here the site
    // workspace silently dropped every query → no badges for site users.
    formId:       raw.form_id      ?? raw.formId      ?? '',
    blockName:    raw.block_name   ?? raw.blockName   ?? '',
    pageName:     raw.page_name    ?? raw.pageName    ?? raw.form_name ?? raw.formName ?? '',
    formName:     raw.form_name    ?? raw.formName    ?? '',
    fieldName:    raw.field_name   ?? raw.fieldName   ?? '',
    queryText:    raw.query_text   ?? raw.queryText   ?? raw.question ?? '',
    queryReason:  raw.query_reason ?? raw.queryReason ?? '',
    severity,
    priority,
    status,
    raisedBy:       raw.raised_by      ?? raw.raisedBy      ?? '',
    raisedByName:   raw.raised_by_name ?? raw.raisedByName  ?? '',
    raisedDate,
    responseDate:       raw.response_date       ?? raw.responseDate       ?? raw.latest_response_at ?? raw.latestResponseAt ?? '',
    respondedBy:        raw.responded_by        ?? raw.respondedBy        ?? '',
    respondedByName:    raw.responded_by_name   ?? raw.respondedByName    ?? '',
    latestResponseText: raw.latest_response_text ?? raw.latestResponseText ?? '',
    resolvedBy:    raw.resolved_by    ?? raw.resolvedBy    ?? raw.closed_by   ?? raw.closedBy    ?? '',
    resolvedDate:  raw.resolved_date  ?? raw.resolvedDate  ?? raw.closed_date ?? raw.closedDate  ?? '',
    resolutionComment: raw.resolution_comment ?? raw.resolutionComment ?? raw.close_comments ?? raw.closeComments ?? '',
    dueAt:        raw.due_at        ?? raw.dueAt       ?? '',
    daysOpen:     daysOpen(raisedDate),
    slaRemaining: slaRemaining(priority, raisedDate),
    assignedTo:     raw.assigned_to       ?? raw.assignedTo     ?? '',
    assignedToName: raw.assigned_to_name  ?? raw.assignedToName ?? '',
  };
}

export const siteQueryClient = {
  /** GET /queries — list queries assigned to this site. */
  async list(filters = {}) {
    const params = {};
    if (filters.status   && filters.status   !== 'All') params.status   = filters.status;
    if (filters.priority && filters.priority !== 'All') {
      params.severity = SEVERITY_FROM_PRIORITY[filters.priority] ?? filters.priority;
    }
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo)   params.date_to   = filters.dateTo;
    try {
      const res = await siteAxiosClient.get(BASE, { params });
      const arr = Array.isArray(res) ? res : (res?.queries ?? res?.items ?? res?.data ?? []);
      return arr.map(normalizeQuery);
    } catch (err) {
      // Backend route may not be live yet — surface empty list rather than crash.
      if (err?.response?.status === 404) return [];
      throw err;
    }
  },

  async getById(queryId) {
    const res = await siteAxiosClient.get(`${BASE}/${queryId}`);
    return normalizeQuery(res?.item ?? res ?? {});
  },

  /** POST /queries — site Query Manager raises a query. site_id is set by the
   *  backend from the JWT (a site user can't raise queries for another site). */
  async raise(data) {
    const severity = data.severity
      ?? SEVERITY_FROM_PRIORITY[data.priority]
      ?? data.priority
      ?? 'Major';
    const res = await siteAxiosClient.post(BASE, {
      subject_id:  data.subjectId,
      form_id:     data.formId,
      field_name:  data.fieldName ?? data.fieldKey,
      query_text:  data.queryText ?? data.question,
      severity,
      assigned_to: data.assignedTo || undefined,
      due_at:      data.dueAt      || undefined,
    });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },

  /** POST /queries/:queryId/close — site Query Manager closes a query. */
  async close(queryId, data) {
    const res = await siteAxiosClient.post(`${BASE}/${queryId}/close`, {
      comments: data.comments ?? data.closureReason ?? data.resolution,
    });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },

  /** POST /queries/:queryId/answer — site responds to a sponsor/CRO query. */
  async respond(queryId, data) {
    const res = await siteAxiosClient.post(`${BASE}/${queryId}/answer`, {
      answer:            data.responseText,
      statusUpdate:      data.statusUpdate,
      updatedFieldValue: data.updatedFieldValue,
    });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },
};

export default siteQueryClient;
