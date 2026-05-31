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
import { humanizeAuditAction, asReopenSystemEntry } from '@/features/sponsor/api/sponsorQueryClient';

const BASE = '/api/v1/site/workspace/queries';

// Response-thread + audit-trail row shapes the shared QueryDetailsModal reads.
function normalizeResponse(raw) {
  const responderName = raw.responder_name ?? raw.responderName ?? 'Unknown';
  // "[Reopened] <reason>" comments render as a distinct system status line.
  const reopen = asReopenSystemEntry(raw, responderName);
  if (reopen) return reopen;
  return {
    id:            raw.id            ?? raw.comment_id ?? crypto.randomUUID(),
    responderName,
    responderRole: raw.responder_role ?? raw.responderRole ?? '',
    responseText:  raw.response_text  ?? raw.responseText  ?? raw.comment_text ?? raw.answer ?? '',
    timestamp:     raw.timestamp      ?? raw.created_at     ?? '',
    attachments:   [],
  };
}
function normalizeAudit(raw) {
  return {
    id:          raw.id           ?? crypto.randomUUID(),
    action:      humanizeAuditAction(raw.action),
    performedBy: raw.performed_by  ?? raw.performedBy ?? 'System',
    timestamp:   raw.timestamp     ?? raw.created_at  ?? '',
    details:     raw.details       ?? '',
  };
}

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
    // field_label is the human-readable field label captured at raise time
    // (e.g. "Date of Birth"). Tables prefer this over fieldName (which is the
    // stable field ID/key). Falls back to fieldName for legacy rows that
    // predate the column.
    fieldLabel:   raw.field_label  ?? raw.fieldLabel  ?? '',
    queryText:    raw.query_text   ?? raw.queryText   ?? raw.question ?? '',
    queryReason:  raw.query_reason ?? raw.queryReason ?? '',
    severity,
    priority,
    status,
    raisedBy:       raw.raised_by      ?? raw.raisedBy      ?? '',
    raisedByName:   raw.raised_by_name ?? raw.raisedByName  ?? '',
    raisedByRole:   raw.raised_by_role ?? raw.raisedByRole  ?? '',
    raisedDate,
    responseDate:       raw.response_date       ?? raw.responseDate       ?? raw.latest_response_at ?? raw.latestResponseAt ?? '',
    respondedBy:        raw.responded_by        ?? raw.respondedBy        ?? '',
    respondedByName:    raw.responded_by_name   ?? raw.respondedByName    ?? '',
    latestResponseText: raw.latest_response_text ?? raw.latestResponseText ?? '',
    resolvedBy:    raw.resolved_by    ?? raw.resolvedBy    ?? raw.closed_by   ?? raw.closedBy    ?? '',
    resolvedByName: raw.resolved_by_name ?? raw.resolvedByName ?? '',
    resolvedDate:  raw.resolved_date  ?? raw.resolvedDate  ?? raw.closed_date ?? raw.closedDate  ?? '',
    resolutionComment: raw.resolution_comment ?? raw.resolutionComment ?? raw.close_comments ?? raw.closeComments ?? '',
    dueAt:        raw.due_at        ?? raw.dueAt       ?? '',
    daysOpen:     daysOpen(raisedDate),
    slaRemaining: slaRemaining(priority, raisedDate),
    assignedTo:     raw.assigned_to       ?? raw.assignedTo     ?? '',
    assignedToName: raw.assigned_to_name  ?? raw.assignedToName ?? '',
    assignedToRole: raw.assigned_to_role  ?? raw.assignedToRole ?? '',
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
    // Backend wraps the row as { success, query }. Unwrap query/item before
    // normalising — otherwise the envelope (no .id) yields id:'' and downstream
    // actions hit /queries//answer (empty id → 404).
    const raw = res?.query ?? res?.item ?? res ?? {};
    return {
      ...normalizeQuery(raw),
      responses:  (raw.responses ?? raw.comments ?? []).map(normalizeResponse),
      auditTrail: (raw.audit_trail ?? raw.auditTrail ?? []).map(normalizeAudit),
    };
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
      field_label: data.fieldLabel ?? undefined,
      block_name:  data.blockName ?? undefined,
      page_name:   data.pageName ?? undefined,
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

  /** POST /queries/:queryId/reopen — return a resolved/closed query to
   *  actionable. The reason is added to the thread + audit trail. */
  async reopen(queryId, data) {
    const res = await siteAxiosClient.post(`${BASE}/${queryId}/reopen`, {
      reason: data.reopenReason ?? data.reason,
    });
    return normalizeQuery(res?.query ?? res?.item ?? res ?? {});
  },

  /** POST /queries/:queryId/escalate — bump severity + optional reassignment +
   *  reason comment. The body shape matches the sponsor EscalateModal so the
   *  shared modal renders identically. `newPriority` is the FE priority label
   *  (High/Medium/Low); the BE maps it to severity via the same SEVERITY map.
   */
  async escalate(queryId, data) {
    const severity = SEVERITY_FROM_PRIORITY[data.newPriority] ?? data.severity;
    const res = await siteAxiosClient.post(`${BASE}/${queryId}/escalate`, {
      reason:       data.escalationReason ?? data.reason,
      assigned_to:  data.escalateTo       ?? data.assignedTo,
      severity,
    });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },
};

export default siteQueryClient;
