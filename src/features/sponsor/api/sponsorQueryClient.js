/**
 * sponsorQueryClient — Query Management for the active sponsor study.
 *
 * Spec §13.5 — /api/v1/sponsor/workspace/queries
 * Sponsor Bearer + (study_id, environment) context auto-attached by
 * sponsorAxiosClient.
 *
 * Spec defines: GET /queries, GET /queries/:id, POST /queries,
 * POST /queries/:id/answer, POST /queries/:id/close.
 * Extras retained for UI compat: respond (maps to /answer), reopen, escalate,
 * bulk-close, export.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE      = '/api/v1/sponsor/workspace/queries';
const WORKSPACE = '/api/v1/sponsor/workspace';

export const PRIORITY_SLA_DAYS = { High: 1, Medium: 3, Low: 7 };

// Spec §4.5 severity ↔ UI priority aliasing.
// UI surfaces High/Medium/Low; backend authoritative values are Critical/Major/Minor.
const SEVERITY_FROM_PRIORITY = { High: 'Critical', Medium: 'Major', Low: 'Minor' };
const PRIORITY_FROM_SEVERITY = { Critical: 'High', Major: 'Medium', Minor: 'Low' };

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysOpen(dateStr) {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function slaRemaining(priority, dateStr) {
  const sla = PRIORITY_SLA_DAYS[priority] ?? 7;
  return sla - daysOpen(dateStr);
}

// ── Normalizers ────────────────────────────────────────────────────────────────
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
    formId:       raw.form_id      ?? raw.formId      ?? '',
    blockName:    raw.block_name   ?? raw.blockName   ?? '',
    pageName:     raw.page_name    ?? raw.pageName    ?? raw.form_name ?? raw.formName ?? '',
    formName:     raw.form_name    ?? raw.formName    ?? '',
    fieldName:    raw.field_name   ?? raw.fieldName   ?? '',
    // Human-readable label captured at raise time. Tables prefer this over
    // fieldName (the stable field ID/key). Falls back to fieldName for
    // pre-migration rows that have no label.
    fieldLabel:   raw.field_label  ?? raw.fieldLabel  ?? '',
    queryText:    raw.query_text   ?? raw.queryText   ?? raw.question ?? '',
    queryReason:  raw.query_reason ?? raw.queryReason ?? '',
    severity,
    priority,
    status,
    raisedBy:     raw.raised_by    ?? raw.raisedBy    ?? '',
    raisedByName: raw.raised_by_name ?? raw.raisedByName ?? '',
    raisedByRole: raw.raised_by_role ?? raw.raisedByRole ?? '',
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
    expectedValue:     raw.expected_value      ?? raw.expectedValue      ?? '',
    referenceSource:   raw.reference_source    ?? raw.referenceSource    ?? '',
    currentFieldValue: raw.current_field_value ?? raw.currentFieldValue  ?? '',
  };
}

// A reopen is stored as a "[Reopened] <reason>" comment. Render it as a
// distinct system status line (not a reply bubble) so the lifecycle event
// reads clearly in the thread. Returns null when it isn't a reopen marker.
export function asReopenSystemEntry(raw, responderName) {
  const text = raw.response_text ?? raw.responseText ?? raw.comment_text ?? raw.answer ?? '';
  const m = /^\s*\[reopened\]\s*(.*)$/is.exec(text);
  if (!m) return null;
  const reason = (m[1] || '').trim();
  return {
    id:           raw.id ?? raw.comment_id ?? crypto.randomUUID(),
    isSystem:     true,
    statusChange: 'Reopened',
    responderName,
    responseText: `🔄 Reopened by ${responderName}${reason ? ` — ${reason}` : ''}`,
    timestamp:    raw.timestamp ?? raw.created_at ?? '',
    attachments:  [],
  };
}

function normalizeResponse(raw) {
  const responderName = raw.responder_name ?? raw.responderName ?? 'Unknown';
  const reopen = asReopenSystemEntry(raw, responderName);
  if (reopen) return reopen;
  return {
    id:             raw.id             ?? crypto.randomUUID(),
    responderName,
    responderRole:  raw.responder_role ?? raw.responderRole  ?? '',
    responseText:   raw.response_text  ?? raw.responseText   ?? raw.answer ?? '',
    timestamp:      raw.timestamp      ?? raw.created_at     ?? '',
    attachments:    (raw.attachments   ?? []).map((a) => ({
      id:   a.id   ?? '',
      name: a.name ?? '',
      url:  a.url  ?? '',
    })),
    updatedFieldValue: raw.updated_field_value ?? raw.updatedFieldValue ?? '',
    statusChange:      raw.status_change       ?? raw.statusChange       ?? '',
    isSystem:          raw.is_system           ?? raw.isSystem           ?? false,
  };
}

// Map the backend's raw action vocabulary (sponsor 'RAISE'/'ANSWER'/… and
// site 'query.raised'/'query.statusChanged'/…) onto the human labels the
// modal's AUDIT_ICONS map keys on.
export function humanizeAuditAction(raw) {
  const a = String(raw ?? '').toLowerCase().replace(/^query\./, '');
  switch (a) {
    case 'raise':
    case 'raised':         return 'Query Raised';
    case 'answer':
    case 'answered':
    case 'statuschanged':  return 'Response Added';
    case 'resolve':
    case 'resolved':
    case 'close':
    case 'closed':         return 'Query Closed';
    case 'reopen':
    case 'reopened':       return 'Query Reopened';
    case 'escalate':
    case 'escalated':      return 'Query Escalated';
    case 'reassign':
    case 'reassigned':     return 'Status Changed';
    default:               return raw || 'Activity';
  }
}

function normalizeAudit(raw) {
  return {
    id:          raw.id          ?? crypto.randomUUID(),
    action:      humanizeAuditAction(raw.action),
    performedBy: raw.performed_by ?? raw.performedBy ?? 'System',
    timestamp:   raw.timestamp   ?? raw.created_at   ?? '',
    details:     raw.details     ?? '',
  };
}

function normalizeDetails(raw) {
  return {
    ...normalizeQuery(raw),
    responses:  (raw.responses  ?? []).map(normalizeResponse),
    auditTrail: (raw.audit_trail ?? raw.auditTrail ?? []).map(normalizeAudit),
  };
}

// ── Client ─────────────────────────────────────────────────────────────────────

export const sponsorQueryClient = {
  /** GET /queries — list (spec §4.5 filters: status, site_id, severity, overdue). */
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters.status   && filters.status   !== 'All') params.status   = filters.status;
    if (filters.priority && filters.priority !== 'All') {
      params.severity = SEVERITY_FROM_PRIORITY[filters.priority] ?? filters.priority;
    }
    if (filters.siteId)    params.site_id    = filters.siteId;
    if (filters.siteCode)  params.site_code  = filters.siteCode; // legacy — backend may ignore
    if (filters.formName)  params.form_name  = filters.formName;
    if (filters.overdue !== undefined) params.overdue = filters.overdue;
    if (filters.dateFrom)  params.date_from  = filters.dateFrom;
    if (filters.dateTo)    params.date_to    = filters.dateTo;

    const res = await sponsorAxiosClient.get(BASE, { params });
    const arr = Array.isArray(res) ? res : (res?.queries ?? res?.items ?? res?.data ?? []);
    return arr.map(normalizeQuery);
  },

  /** GET /queries/:queryId — details. */
  async getById(queryId) {
    const res = await sponsorAxiosClient.get(`${BASE}/${queryId}`);
    // Backend wraps the row as { success, query }. Unwrap query/item before
    // normalising — passing the envelope (no row fields) yields an empty detail
    // object and the Details modal renders blank.
    return normalizeDetails(res?.query ?? res?.item ?? res ?? {});
  },

  /** POST /queries — raise a new query (spec §4.5 body). */
  async raise(_studyId, data) {
    const severity = data.severity
      ?? SEVERITY_FROM_PRIORITY[data.priority]
      ?? data.priority
      ?? 'Major';
    const res = await sponsorAxiosClient.post(BASE, {
      subject_id:  data.subjectId,
      form_id:     data.formId,
      field_name:  data.fieldName ?? data.fieldKey,
      field_label: data.fieldLabel ?? undefined,
      block_name:  data.blockName ?? undefined,
      page_name:   data.pageName ?? undefined,
      query_text:  data.queryText ?? data.question,
      severity,
      site_id:     data.siteId      || undefined,
      assigned_to: data.assignedTo  || undefined,
      due_at:      data.dueAt       || undefined,
    });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },

  /** POST /queries/:queryId/answer — spec §4.5 answer. */
  async respond(_studyId, queryId, data) {
    const fd = data.attachments?.length ? (() => {
      const f = new FormData();
      f.append('answer', data.responseText);
      f.append('statusUpdate', data.statusUpdate ?? '');
      if (data.updatedFieldValue) f.append('updatedFieldValue', data.updatedFieldValue);
      data.attachments.forEach((file) => f.append('attachments', file));
      return f;
    })() : null;

    const res = fd
      ? await sponsorAxiosClient.post(`${BASE}/${queryId}/answer`, fd)
      : await sponsorAxiosClient.post(`${BASE}/${queryId}/answer`, {
          answer:            data.responseText,
          statusUpdate:      data.statusUpdate,
          updatedFieldValue: data.updatedFieldValue,
        });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },

  /** POST /queries/:queryId/close — spec §4.5 close (body: { comments }). */
  async close(_studyId, queryId, data) {
    const res = await sponsorAxiosClient.post(`${BASE}/${queryId}/close`, {
      comments: data.comments ?? data.closureReason ?? data.resolution,
    });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },

  // ── Not in spec §13.5 — retained for current UI. ──────────────────────────
  async reopen(_studyId, queryId, data) {
    // Send `reason` (not `reopenReason`): the axios client deep-snake-cases the
    // body, so `reopenReason` would arrive as `reopen_reason` and the controller
    // (which reads `reason`) would miss it — dropping the [Reopened] comment.
    const res = await sponsorAxiosClient.post(`${BASE}/${queryId}/reopen`, {
      reason: data.reopenReason ?? data.reason,
    });
    return normalizeQuery(res?.item ?? res ?? {});
  },

  async escalate(_studyId, queryId, data) {
    const res = await sponsorAxiosClient.post(`${BASE}/${queryId}/escalate`, {
      escalationReason: data.escalationReason,
      escalateTo:       data.escalateTo,
      newPriority:      data.newPriority,
    });
    return normalizeQuery(res?.item ?? res ?? {});
  },

  async bulkClose(_studyId, ids, data) {
    const res = await sponsorAxiosClient.post(`${BASE}/bulk-close`, {
      queryIds: ids,
      comments: data.comments ?? data.closureReason ?? data.resolution,
    });
    return res?.closed ?? ids.length;
  },

  async exportCSV(_studyId, filters = {}) {
    const params = {};
    if (filters.status   && filters.status   !== 'All') params.status   = filters.status;
    if (filters.priority && filters.priority !== 'All') params.priority = filters.priority;
    const res  = await sponsorAxiosClient.get(`${BASE}/export`, { params, responseType: 'blob' });
    const blob = res instanceof Blob ? res : new Blob([res], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `Queries_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Sites list for filter — spec §13.1. */
  async getSites(_studyId) {
    try {
      const res = await sponsorAxiosClient.get(`${WORKSPACE}/sites`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return arr.map((s) => ({
        value: s.site_code ?? s.siteCode ?? s.id,
        label: `${s.site_name ?? s.siteName ?? ''} (${s.site_code ?? s.siteCode ?? ''})`.trim(),
      }));
    } catch { return []; }
  },

  /** User list for escalation dropdown — non-spec. */
  async getUsers(_studyId) {
    try {
      const res = await sponsorAxiosClient.get(`${WORKSPACE}/team`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return arr.map((u) => ({
        value: u.id ?? u.user_id,
        label: u.full_name ?? u.fullName ?? u.name ?? '',
      }));
    } catch { return []; }
  },
};
