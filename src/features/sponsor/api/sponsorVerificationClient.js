/**
 * sponsorVerificationClient — Data Verification Manager for the active study.
 *
 * Spec §13.6 — /api/v1/sponsor/workspace/data-verifications
 * Sponsor Bearer + (study_id, environment) context auto-attached by
 * pickScope().axios.
 *
 * Spec defines: GET /data-verifications, POST /data-verifications,
 * POST /data-verifications/:id/review. Everything else here is a non-spec
 * extension for the current UI (subject-level verify/approve/reject, forms,
 * fields, metrics, bulk ops, export, site filter).
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import siteAxiosClient    from '@/api/siteAxiosClient';

// Verification Manager is mounted under BOTH /sponsor/workspace and
// /site/workspace. The page itself is shared; this client picks the right
// axios + URL prefix based on which scope's token is live.
//
// Site session wins ONLY when there's no sponsor token — a CRO operator
// impersonating a sponsor often has both, in which case we go sponsor.
function pickScope() {
  if (typeof window === 'undefined') {
    return { axios: sponsorAxiosClient, base: '/api/v1/sponsor/workspace/data-verifications', workspace: '/api/v1/sponsor/workspace' };
  }
  const hasSponsor = !!localStorage.getItem('sponsorAccessToken') || !!localStorage.getItem('sponsorViewToken');
  const hasSite    = !!localStorage.getItem('siteAccessToken');
  if (hasSite && !hasSponsor) {
    return {
      axios:     siteAxiosClient,
      base:      '/api/v1/site/workspace/data-verifications',
      workspace: '/api/v1/site/workspace',
    };
  }
  return {
    axios:     sponsorAxiosClient,
    base:      '/api/v1/sponsor/workspace/data-verifications',
    workspace: '/api/v1/sponsor/workspace',
  };
}

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeSubject(raw) {
  const crfsCompleted = raw.crfs_completed ?? raw.crfsCompleted ?? 0;
  const crfsTotal     = raw.crfs_total     ?? raw.crfsTotal     ?? 0;
  return {
    // Verification row identifier — needed for the Activity History drill-in.
    verificationId:   raw.verification_id ?? raw.verificationId ?? null,
    id:               raw.id             ?? raw.subject_id   ?? '',
    // Spec §VM: Subject Details = Subject ID + Initials.
    subjectNumber:    raw.subject_number  ?? raw.subjectNumber ?? '',
    initials:         raw.subject_initials ?? raw.initials    ?? '',
    siteCode:         raw.site_code      ?? raw.siteCode     ?? '',
    siteName:         raw.site_name      ?? raw.siteName     ?? '',
    // Backend now returns enrolled_at (subjects.enrolled_at) instead of an
    // ad-hoc enrollment_date column.
    enrollmentDate:   raw.enrolled_at    ?? raw.enrollment_date ?? raw.enrollmentDate ?? '',
    crfsCompleted,
    crfsTotal,
    // Per-row completeness = this PAGE's verification progress (verified fields ÷
    // the page's total fields) → 100% when the page is fully verified. Distinct
    // from the study-wide CRF Completeness bar (data entry). Falls back to the
    // legacy CRF ratio only if the backend didn't send a per-page value.
    completeness:     raw.verified_pct ?? raw.completeness ?? (crfsTotal ? Math.round((crfsCompleted / crfsTotal) * 100) : 0),
    verifiedFields:   raw.verified_fields ?? raw.verifiedFields ?? null,
    totalFields:      raw.total_fields    ?? raw.totalFields    ?? null,
    openQueries:      raw.open_queries   ?? raw.openQueries  ?? 0,
    status:           raw.status         ?? 'Pending',
    // Prefer the resolved display name; fall back to the raw id only if the
    // backend couldn't resolve it.
    verifiedBy:       raw.verified_by_name ?? raw.verifiedByName ?? raw.verified_by ?? raw.verifiedBy ?? '',
    // Full list of distinct verifiers (for the "Multiple (N)" tooltip).
    verifiedByNames:  raw.verified_by_names ?? raw.verifiedByNames ?? [],
    verificationDate: raw.verified_at    ?? raw.verification_date ?? raw.verificationDate ?? '',
    completedByName:  raw.completed_by_name ?? raw.completedByName ?? '',
    // Per-page verification flow: a PAGE work-item has pageId set + fieldName
    // empty; a field-level row has both. completedBy/At = who marked the page
    // done (data entry) — distinct from verifiedBy (the SDV reviewer).
    formId:           raw.form_id        ?? raw.formId       ?? '',
    pageId:           raw.page_id        ?? raw.pageId       ?? '',
    pageTitle:        raw.page_title     ?? raw.pageTitle    ?? '',
    fieldName:        raw.field_name     ?? raw.fieldName    ?? '',
    completedBy:      raw.completed_by   ?? raw.completedBy  ?? '',
    completedAt:      raw.completed_at   ?? raw.completedAt  ?? '',
    // Spec §VM: Block / Page = the form + the specific eCRF page being verified.
    blockPage:        [raw.form_name ?? raw.formName, raw.page_title ?? raw.pageTitle]
                        .filter(Boolean).join(' / ') || (raw.form_name ?? raw.formName ?? ''),
    // Days from row creation → verified_at (or NOW() if pending).
    ageDays:          Number(raw.age_days ?? raw.ageDays ?? 0),
  };
}

function normalizeField(raw) {
  return {
    id:                 raw.id                   ?? raw.field_id         ?? '',
    label:              raw.label                ?? raw.field_label      ?? '',
    value:              raw.value                ?? raw.field_value      ?? '',
    dataType:           raw.data_type            ?? raw.dataType         ?? 'text',
    verificationStatus: raw.verification_status  ?? raw.verificationStatus ?? 'Pending',
    comment:            raw.comment              ?? '',
    sourceDocRef:       raw.source_doc_ref       ?? raw.sourceDocRef     ?? '',
    isMandatory:        raw.is_mandatory         ?? raw.isMandatory      ?? false,
    qualityFlags:       raw.quality_flags        ?? raw.qualityFlags     ?? [],
  };
}

function normalizeForm(raw) {
  return {
    id:     raw.id      ?? raw.form_id    ?? '',
    name:   raw.name    ?? raw.form_name  ?? '',
    status: raw.status  ?? 'Not Started',
    fields: (raw.fields ?? []).map(normalizeField),
  };
}

function normalizeQualityCheck(raw) {
  return {
    id:        raw.id        ?? crypto.randomUUID(),
    type:      raw.type      ?? 'warning',
    category:  raw.category  ?? '',
    message:   raw.message   ?? '',
    formName:  raw.form_name  ?? raw.formName  ?? '',
    fieldName: raw.field_name ?? raw.fieldName ?? '',
  };
}

function normalizeDetails(raw) {
  return {
    ...normalizeSubject(raw),
    demographics: {
      age:    raw.demographics?.age    ?? raw.age    ?? '',
      gender: raw.demographics?.gender ?? raw.gender ?? '',
    },
    qualityChecks: (raw.quality_checks ?? raw.qualityChecks ?? []).map(normalizeQualityCheck),
    forms:         (raw.forms          ?? []).map(normalizeForm),
    auditTrail:    (raw.audit_trail    ?? raw.auditTrail ?? []).map((e) => ({
      id:          e.id           ?? crypto.randomUUID(),
      action:      e.action       ?? '',
      performedBy: e.performed_by ?? e.performedBy ?? '',
      timestamp:   e.timestamp    ?? e.created_at  ?? '',
      details:     e.details      ?? '',
    })),
  };
}

// ── Client ─────────────────────────────────────────────────────────────────────

export const sponsorVerificationClient = {
  async getMetrics(_studyId) {
    const res = await pickScope().axios.get(`${pickScope().base}/metrics`);
    // Backend (spec vocabulary):
    //   total, not_verified, in_verification, partially_verified,
    //   verified, overdue, avg_verification_days
    // Legacy keys (pending_verification, in_review, approved, rejected_queried,
    // completion_rate, by_site) kept as fallbacks so older mocks still render.
    const total = res?.total ?? res?.total_subjects ?? res?.totalSubjects ?? 0;
    const verified = res?.verified ?? 0;
    return {
      total,
      totalSubjects:        total,
      notVerified:          res?.not_verified         ?? res?.notVerified          ?? res?.pending_verification ?? 0,
      pendingVerification:  res?.not_verified         ?? res?.pending_verification ?? res?.pendingVerification ?? 0,
      inVerification:       res?.in_verification      ?? res?.inVerification       ?? res?.in_review           ?? 0,
      inReview:             res?.in_verification      ?? res?.in_review            ?? res?.inReview            ?? 0,
      partiallyVerified:    res?.partially_verified   ?? res?.partiallyVerified    ?? 0,
      verified,
      // Spec §VM Overdue card — set by the cron scanner. Always exposed,
      // including the camelCase fallback for completeness.
      overdue:              res?.overdue              ?? res?.overdueVerifications ?? 0,
      approved:             res?.approved             ?? 0,
      rejectedQueried:      res?.rejected_queried     ?? res?.rejectedQueried      ?? 0,
      completionRate:       res?.completion_rate      ?? res?.completionRate       ?? (total ? Math.round((verified / total) * 100) : 0),
      // Spec §VM progress bars — pre-computed on the BE so the FE doesn't
      // need to know the "completed status" vocabulary for CRF entry.
      verificationCompletionPct: res?.verification_completion_pct ?? res?.verificationCompletionPct
        ?? (total ? Math.round((verified / total) * 100) : 0),
      crfCompletenessPct:        res?.crf_completeness_pct        ?? res?.crfCompletenessPct        ?? 0,
      crfFormsTotal:             res?.crf_forms_total             ?? res?.crfFormsTotal             ?? 0,
      crfFormsComplete:          res?.crf_forms_complete          ?? res?.crfFormsComplete          ?? 0,
      avgVerificationDays:  res?.avg_verification_days ?? res?.avgVerificationDays  ?? 0,
      bySite:               res?.by_site              ?? res?.bySite               ?? [],
    };
  },

  /** GET /data-verifications — spec §4.6 list (filters: status, site_id, verification_type). */
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters.status    && filters.status !== 'All') params.status = filters.status;
    if (filters.siteId)            params.site_id           = filters.siteId;
    if (filters.verificationType)  params.verification_type = filters.verificationType;
    // Non-spec UI filters — backend may ignore.
    if (filters.siteCode)   params.site_code  = filters.siteCode;
    if (filters.dateFrom)   params.date_from  = filters.dateFrom;
    if (filters.dateTo)     params.date_to    = filters.dateTo;
    if (filters.minComplete !== undefined) params.min_completeness = filters.minComplete;

    const res = await pickScope().axios.get(pickScope().base, { params });
    // Backend wraps rows in `{ success, verifications }`; older mocks used
    // `items` or `data`. Accept all three so the page stays compatible.
    const arr = Array.isArray(res)
      ? res
      : (res?.verifications ?? res?.items ?? res?.data ?? []);
    return arr.map(normalizeSubject);
  },

  async getSubject(_studyId, subjectId) {
    const res = await pickScope().axios.get(`${pickScope().base}/${subjectId}`);
    return normalizeDetails(res?.item ?? res ?? {});
  },

  /** Per-page + per-field verification status for one (subject, form). Returns
   *  the raw rows ({ page_id, page_title, field_name, status, verified_by_name,
   *  verified_at, completed_by_name, completed_at }). Scope-aware (sponsor/site). */
  async getPageStatuses(subjectId, formId) {
    const { axios, workspace } = pickScope();
    const res = await axios.get(`${workspace}/subjects/${subjectId}/forms/${formId}/page-status`);
    return res?.pages ?? res?.data ?? [];
  },

  /** Form schema — used to resolve field ids → labels and page titles in the
   *  verification detail view. */
  async getForm(formId) {
    const { axios, workspace } = pickScope();
    const res = await axios.get(`${workspace}/forms/${formId}`);
    return res?.form ?? res ?? {};
  },

  /** POST /data-verifications — spec §4.6 create. */
  async createVerification(_studyId, data) {
    const res = await pickScope().axios.post(pickScope().base, {
      subject_id:        data.subjectId,
      form_id:           data.formId,
      field_name:        data.fieldName || undefined,
      site_id:           data.siteId    || undefined,
      verification_type: data.verificationType ?? 'SDV',
    });
    return normalizeSubject(res?.item ?? res ?? {});
  },

  /**
   * POST /data-verifications/:id/review — spec §4.6 review.
   * decision: 'Verified' | 'Rejected' | 'Locked'; body: { decision, comments }.
   */
  async review(_studyId, verificationId, { decision, comments, notes }) {
    const res = await pickScope().axios.post(`${pickScope().base}/${verificationId}/review`, {
      decision,
      comments: comments ?? notes,
    });
    return normalizeSubject(res?.item ?? res ?? {});
  },

  // ── Not in spec §13.6 — retained for current UI. ──────────────────────────
  async verifyField(_studyId, subjectId, formId, fieldId, data) {
    const res = await pickScope().axios.patch(
      `${pickScope().base}/${subjectId}/forms/${formId}/fields/${fieldId}`,
      { action: data.action, comment: data.comment },
    );
    return normalizeField(res?.item ?? res ?? {});
  },

  async verifyForm(_studyId, subjectId, formId, data) {
    const res = await pickScope().axios.post(
      `${pickScope().base}/${subjectId}/forms/${formId}/verify`,
      { action: data.action, comment: data.comment },
    );
    return normalizeForm(res?.item ?? res ?? {});
  },

  async verifySubject(_studyId, subjectId, data) {
    const res = await pickScope().axios.post(`${pickScope().base}/${subjectId}/verify`, {
      comment: data?.comment,
    });
    return normalizeSubject(res?.item ?? res ?? {});
  },

  async approveSubject(_studyId, subjectId, data) {
    const res = await pickScope().axios.post(`${pickScope().base}/${subjectId}/approve`, {
      comment: data?.comment,
    });
    return normalizeSubject(res?.item ?? res ?? {});
  },

  async rejectSubject(_studyId, subjectId, data) {
    const res = await pickScope().axios.post(`${pickScope().base}/${subjectId}/reject`, {
      rejectionReason: data.rejectionReason,
      comment:         data.comment,
    });
    return normalizeSubject(res?.item ?? res ?? {});
  },

  async bulkVerify(_studyId, ids) {
    const res = await pickScope().axios.post(`${pickScope().base}/bulk-verify`, { subjectIds: ids });
    return res?.verified ?? ids.length;
  },

  async bulkApprove(_studyId, ids) {
    const res = await pickScope().axios.post(`${pickScope().base}/bulk-approve`, { subjectIds: ids });
    return res?.approved ?? ids.length;
  },

  async exportReport(_studyId, format = 'csv') {
    const res  = await pickScope().axios.get(`${pickScope().base}/export`, { params: { format }, responseType: 'blob' });
    const blob = res instanceof Blob ? res : new Blob([res], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
    const ext  = format === 'pdf' ? 'pdf' : 'csv';
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `Verification_Report_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async getSites(_studyId) {
    try {
      const res = await pickScope().axios.get(`${pickScope().workspace}/sites`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return arr.map((s) => ({
        value: s.site_code ?? s.siteCode ?? s.id,
        label: `${s.site_name ?? s.siteName ?? ''} (${s.site_code ?? s.siteCode ?? ''})`.trim(),
      }));
    } catch { return []; }
  },
};
