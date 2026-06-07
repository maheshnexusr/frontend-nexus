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
import { uploadFormFile } from '@/api/formFileClient';

// Upload any File instances to the study disk store and return reference
// objects ({ url, name, size, type }); pass-through anything already a ref.
export async function uploadAttachments(files) {
  if (!files?.length) return [];
  const out = [];
  for (const f of files) {
    if (typeof File !== 'undefined' && f instanceof File) {
      const r = await uploadFormFile(f);
      out.push({ url: r.url, name: r.name, size: r.size, type: r.type });
    } else if (f?.url) {
      out.push({ url: f.url, name: f.name, size: f.size, type: f.type });
    }
  }
  return out;
}

const BASE      = '/api/v1/sponsor/workspace/queries';
const WORKSPACE = '/api/v1/sponsor/workspace';

export const PRIORITY_SLA_DAYS = { High: 1, Medium: 3, Low: 7 };

// Spec §4.5 severity ↔ UI priority aliasing.
// Severity and priority share ONE 4-level scale: Critical > High > Medium > Low.
// (No separate Major/Minor vocabulary.) The maps are identity for the four
// values; PRIORITY_FROM_SEVERITY additionally folds legacy Major/Minor rows
// back to Medium/Low so old data still reads sensibly.
const SEVERITY_FROM_PRIORITY = { Critical: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low' };
const PRIORITY_FROM_SEVERITY = { Critical: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low', Major: 'Medium', Minor: 'Low' };

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
  const severity   = raw.severity ?? raw.priority ?? 'Medium';
  const priority   = PRIORITY_FROM_SEVERITY[severity] ?? raw.priority ?? 'Medium';
  const status     = raw.status     ?? 'Open';
  const raisedDate = raw.raised_date ?? raw.raisedDate ?? raw.created_at ?? '';
  return {
    id:           raw.id           ?? raw.query_id    ?? raw.queryId ?? '',
    studyName:    raw.study_title  ?? raw.studyTitle  ?? raw.study_name ?? raw.studyName ?? '',
    siteName:     raw.site_name    ?? raw.siteName    ?? '',
    siteCode:     raw.site_number  ?? raw.siteNumber  ?? raw.site_code ?? raw.siteCode ?? '',
    siteId:       raw.site_id      ?? raw.siteId      ?? raw.site_code ?? raw.siteCode ?? '',
    subjectId:    raw.subject_id   ?? raw.subjectId   ?? '',
    subjectNumber: raw.subject_number ?? raw.subjectNumber ?? '',
    subjectName:   raw.subject_name   ?? raw.subjectName   ?? '',
    subjectInitials: raw.subject_initials ?? raw.subjectInitials ?? '',
    protocolNumber: raw.protocol_number ?? raw.protocolNumber ?? '',
    formId:       raw.form_id      ?? raw.formId      ?? '',
    blockId:      raw.block_id     ?? raw.blockId     ?? '',
    pageId:       raw.page_id      ?? raw.pageId      ?? '',
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
    // Escalation target — distinct from the assignee. Present (truthy) means
    // the query has been escalated to this person, who can view it alongside
    // the original assignee. isEscalated drives the "Escalated" badge.
    escalatedTo:     raw.escalated_to       ?? raw.escalatedTo     ?? '',
    escalatedToName: raw.escalated_to_name  ?? raw.escalatedToName ?? '',
    escalatedByName: raw.escalated_by_name  ?? raw.escalatedByName ?? '',
    escalatedAt:     raw.escalated_at       ?? raw.escalatedAt     ?? '',
    escalationReason: raw.escalation_reason ?? raw.escalationReason ?? '',
    isEscalated:     Boolean(raw.escalated_to ?? raw.escalatedTo),
    // Previous owner before the last reassignment (label only — current owner is
    // assignedTo). isReassigned drives the "was: <name>" note.
    previousAssignedTo:     raw.previous_assigned_to       ?? raw.previousAssignedTo     ?? '',
    previousAssignedToName: raw.previous_assigned_to_name  ?? raw.previousAssignedToName ?? '',
    reassignedAt:           raw.reassigned_at              ?? raw.reassignedAt           ?? '',
    isReassigned:           Boolean(raw.previous_assigned_to ?? raw.previousAssignedTo),
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

// An escalation is stored as an "[Escalated] to <name> — <reason>" comment.
// Render it as a system event line (not a reply bubble) so it reads as a
// lifecycle event in the timeline — same treatment as [Reopened]. The badge on
// the query already shows WHO; this keeps the reason + when in the history.
export function asEscalateSystemEntry(raw, responderName) {
  const text = raw.response_text ?? raw.responseText ?? raw.comment_text ?? raw.answer ?? '';
  const m = /^\s*\[escalated\]\s*(.*)$/is.exec(text);
  if (!m) return null;
  const detail = (m[1] || '').trim();
  return {
    id:           raw.id ?? raw.comment_id ?? crypto.randomUUID(),
    isSystem:     true,
    statusChange: 'Escalated',
    responderName,
    responseText: `⬆ Escalated by ${responderName}${detail ? ` ${detail}` : ''}`,
    timestamp:    raw.timestamp ?? raw.created_at ?? '',
    attachments:  [],
  };
}

function normalizeResponse(raw) {
  const responderName = raw.responder_name ?? raw.responderName ?? 'Unknown';
  const reopen = asReopenSystemEntry(raw, responderName);
  if (reopen) return reopen;
  const escalate = asEscalateSystemEntry(raw, responderName);
  if (escalate) return escalate;
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
      ?? 'Medium';
    const res = await sponsorAxiosClient.post(BASE, {
      subject_id:  data.subjectId,
      form_id:     data.formId,
      field_name:  data.fieldName ?? data.fieldKey,
      field_label: data.fieldLabel ?? undefined,
      block_id:    data.blockId   ?? undefined,
      page_id:     data.pageId    ?? undefined,
      block_name:  data.blockName ?? undefined,
      page_name:   data.pageName ?? undefined,
      query_text:  data.queryText ?? data.question,
      severity,
      site_id:     data.siteId      || undefined,
      assigned_to: data.assignedTo  || undefined,
      due_at:      data.dueAt       || undefined,
      attachments: await uploadAttachments(data.attachments),
    });
    return normalizeQuery(res?.item ?? res?.query ?? res ?? {});
  },

  /** POST /queries/:queryId/answer — spec §4.5 answer. Attachments are uploaded
   *  to the study disk store first, then their references are sent as JSON. */
  async respond(_studyId, queryId, data) {
    const res = await sponsorAxiosClient.post(`${BASE}/${queryId}/answer`, {
      answer:            data.responseText,
      statusUpdate:      data.statusUpdate,
      updatedFieldValue: data.updatedFieldValue,
      attachments:       await uploadAttachments(data.attachments),
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
    // The backend escalate endpoint reads { reason, assigned_to, severity } —
    // map the modal's field names onto those (and priority → severity, since
    // escalation bumps the query's severity, not its priority vocabulary).
    const res = await sponsorAxiosClient.post(`${BASE}/${queryId}/escalate`, {
      reason:      data.escalationReason,
      assigned_to: data.escalateTo,
      severity:    SEVERITY_FROM_PRIORITY[data.newPriority] ?? data.newPriority,
    });
    return normalizeQuery(res?.item ?? res ?? {});
  },

  async bulkClose(_studyId, ids, data) {
    const res = await sponsorAxiosClient.post(`${BASE}/bulk-close`, {
      queryIds: ids,
      comments: data.comments ?? data.closureReason ?? data.resolution,
    });
    return res?.summary?.ok ?? res?.closed ?? ids.length;
  },

  /** POST /queries/bulk-escalate — escalate every selected query. */
  async bulkEscalate(_studyId, ids, data) {
    const res = await sponsorAxiosClient.post(`${BASE}/bulk-escalate`, {
      queryIds:    ids,
      reason:      data.escalationReason ?? data.reason,
      assigned_to: data.escalateTo ?? data.assignedTo,
      severity:    SEVERITY_FROM_PRIORITY[data.newPriority] ?? data.severity,
    });
    return res?.summary?.ok ?? ids.length;
  },

  async exportCSV(_studyId, { ids, ...filters } = {}) {
    const params = {};
    if (Array.isArray(ids) && ids.length) params.ids = ids.join(',');
    if (filters.status   && filters.status   !== 'All') params.status   = filters.status;
    if (filters.priority && filters.priority !== 'All') params.severity = SEVERITY_FROM_PRIORITY[filters.priority] ?? filters.priority;
    if (filters.siteCode) params.site_code = filters.siteCode;
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
};
