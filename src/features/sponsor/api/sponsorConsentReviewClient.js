/**
 * sponsorConsentReviewClient — Consent Review & Approval for the active study.
 *
 * Base: /api/v1/sponsor/workspace/consent-submissions (non-spec extension —
 * spec §13.4 models review at the template level via
 * /consent/templates/:templateId/review with `{ decision, notes }`).
 *
 * Sponsor Bearer + (study_id, environment) context auto-attached by
 * sponsorAxiosClient.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import siteAxiosClient    from '@/api/siteAxiosClient';

// Consent Review is mounted under BOTH /sponsor/workspace and /site/workspace
// (a site role may be granted consent_review). pickScope() selects the right
// axios + URL prefix from the live token — site wins only when no sponsor token.
function pickScope() {
  if (typeof window === 'undefined') {
    return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/consent-submissions', workspace: '/api/v1/sponsor/workspace' };
  }
  const hasSponsor = !!localStorage.getItem('sponsorAccessToken') || !!localStorage.getItem('sponsorViewToken');
  const hasSite    = !!localStorage.getItem('siteAccessToken');
  if (hasSite && !hasSponsor) {
    return { axios: siteAxiosClient, base: '/api/v1/site/workspace/consent-submissions', workspace: '/api/v1/site/workspace' };
  }
  return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/consent-submissions', workspace: '/api/v1/sponsor/workspace' };
}

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeSubmission(raw) {
  return {
    id:              raw.id               ?? raw.submission_id   ?? '',
    userName:        raw.user_name        ?? raw.userName        ?? '',
    userEmail:       raw.user_email       ?? raw.userEmail       ?? '',
    userId:          raw.user_id          ?? raw.userId          ?? '',
    role:            raw.role_name        ?? raw.role            ?? '',
    roleId:          raw.role_id          ?? raw.roleId          ?? '',
    siteCode:        raw.site_code        ?? raw.siteCode        ?? '',
    siteName:        raw.site_name        ?? raw.siteName        ?? '',
    submissionDate:  raw.submission_date  ?? raw.submissionDate  ?? '',
    status:          raw.status           ?? 'Pending',
    version:         raw.version          ?? 1,
    consentFormId:   raw.consent_form_id  ?? raw.consentFormId  ?? '',
  };
}

function normalizeAuditEntry(raw) {
  return {
    id:          raw.id          ?? crypto.randomUUID(),
    action:      raw.action      ?? '',
    performedBy: raw.performed_by ?? raw.performedBy ?? '',
    timestamp:   raw.timestamp   ?? raw.created_at  ?? '',
    notes:       raw.notes       ?? raw.message      ?? '',
  };
}

function normalizeDetails(raw) {
  const base = normalizeSubmission(raw);
  return {
    ...base,
    sections:    (raw.sections     ?? []).map((s) => ({
      id:           s.id           ?? '',
      sectionTitle: s.section_title ?? s.sectionTitle ?? '',
      content:      s.content      ?? '',
      isMandatory:  s.is_mandatory ?? s.isMandatory ?? false,
      acknowledged: s.acknowledged ?? false,
    })),
    submittedData:  raw.submitted_data  ?? raw.submittedData  ?? {},
    // The exact consent form the site user saw + their raw answers, so the
    // reviewer can re-render it filled and read-only.
    formStructure:  raw.form_structure  ?? raw.formStructure  ?? null,
    responses:      raw.responses       ?? {},
    documents: (raw.documents ?? []).map((d) => ({
      id:   d.id   ?? '',
      name: d.name ?? d.file_name ?? '',
      url:  d.url  ?? d.file_url  ?? '',
      type: d.type ?? d.file_type ?? '',
      size: d.size ?? 0,
    })),
    signature: raw.signature ? {
      imageUrl:  raw.signature.image_url ?? raw.signature.imageUrl ?? '',
      timestamp: raw.signature.timestamp ?? '',
    } : null,
    witness: raw.witness ? {
      name:      raw.witness.name      ?? '',
      signature: raw.witness.signature ?? '',
      date:      raw.witness.date      ?? '',
    } : null,
    metadata: {
      ipAddress: raw.metadata?.ip_address ?? raw.metadata?.ipAddress ?? '',
      userAgent: raw.metadata?.user_agent ?? raw.metadata?.userAgent ?? '',
    },
    approvalDetails:  raw.approval_details  ?? raw.approvalDetails  ?? null,
    rejectionDetails: raw.rejection_details ?? raw.rejectionDetails ?? null,
    auditTrail:       (raw.audit_trail ?? raw.auditTrail ?? []).map(normalizeAuditEntry),
  };
}

// ── Client ─────────────────────────────────────────────────────────────────────

export const sponsorConsentReviewClient = {
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters.status && filters.status !== 'All') params.status  = filters.status;
    if (filters.roleId)   params.role_id   = filters.roleId;
    if (filters.siteCode) params.site_code = filters.siteCode;
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo)   params.date_to   = filters.dateTo;

    const { axios, base } = pickScope();
    const res = await axios.get(base, { params });
    const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
    return arr.map(normalizeSubmission);
  },

  async getById(_studyId, submissionId) {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/${submissionId}`);
    return normalizeDetails(res?.item ?? res ?? {});
  },

  async approve(_studyId, submissionId, data) {
    const { axios, base } = pickScope();
    const res = await axios.post(`${base}/${submissionId}/approve`, {
      customMessage:  data.customMessage,
      effectiveDate:  data.effectiveDate,
      expiryDate:     data.expiryDate,
    });
    return normalizeSubmission(res?.item ?? res ?? {});
  },

  async reject(_studyId, submissionId, data) {
    const { axios, base } = pickScope();
    const res = await axios.post(`${base}/${submissionId}/reject`, {
      rejectionReason: data.rejectionReason,
      customMessage:   data.customMessage,
      actionItems:     data.actionItems,
    });
    return normalizeSubmission(res?.item ?? res ?? {});
  },

  async bulkApprove(_studyId, ids, data) {
    const { axios, base } = pickScope();
    const res = await axios.post(`${base}/bulk-approve`, {
      submissionIds:  ids,
      customMessage:  data.customMessage,
      effectiveDate:  data.effectiveDate,
    });
    return res?.approved ?? ids.length;
  },

  async bulkReject(_studyId, ids, data) {
    const { axios, base } = pickScope();
    const res = await axios.post(`${base}/bulk-reject`, {
      submissionIds:   ids,
      rejectionReason: data.rejectionReason,
      customMessage:   data.customMessage,
      actionItems:     data.actionItems,
    });
    return res?.rejected ?? ids.length;
  },

  async download(_studyId, submissionId) {
    const { axios, base } = pickScope();
    const res = await axios.get(`${base}/${submissionId}/download`, {
      responseType: 'blob',
    });
    return res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
  },

  /** Role list from spec §13.2. */
  async getRoles(_studyId) {
    try {
      const { axios, workspace } = pickScope();
      const res = await axios.get(`${workspace}/lookups/site-roles`);
      // Lookup returns { success, roles } — read `roles` first (not items/data).
      const arr = Array.isArray(res) ? res : (res?.roles ?? res?.items ?? res?.data ?? []);
      return arr.map((r) => ({ value: r.id ?? r.role_id, label: r.name ?? r.role_name ?? '' }));
    } catch { return []; }
  },
};
