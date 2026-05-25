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
    id:               raw.id             ?? raw.subject_id   ?? '',
    siteCode:         raw.site_code      ?? raw.siteCode     ?? '',
    siteName:         raw.site_name      ?? raw.siteName     ?? '',
    enrollmentDate:   raw.enrollment_date ?? raw.enrollmentDate ?? '',
    crfsCompleted,
    crfsTotal,
    completeness:     raw.completeness   ?? (crfsTotal ? Math.round((crfsCompleted / crfsTotal) * 100) : 0),
    openQueries:      raw.open_queries   ?? raw.openQueries  ?? 0,
    status:           raw.status         ?? 'Pending',
    verifiedBy:       raw.verified_by    ?? raw.verifiedBy   ?? '',
    verificationDate: raw.verification_date ?? raw.verificationDate ?? '',
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
    return {
      totalSubjects:       res?.total_subjects        ?? res?.totalSubjects        ?? 0,
      pendingVerification: res?.pending_verification  ?? res?.pendingVerification  ?? 0,
      inReview:            res?.in_review             ?? res?.inReview             ?? 0,
      verified:            res?.verified              ?? 0,
      approved:            res?.approved              ?? 0,
      rejectedQueried:     res?.rejected_queried      ?? res?.rejectedQueried      ?? 0,
      completionRate:      res?.completion_rate       ?? res?.completionRate       ?? 0,
      avgVerificationDays: res?.avg_verification_days ?? res?.avgVerificationDays  ?? 0,
      bySite:              res?.by_site               ?? res?.bySite               ?? [],
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
    const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
    return arr.map(normalizeSubject);
  },

  async getSubject(_studyId, subjectId) {
    const res = await pickScope().axios.get(`${pickScope().base}/${subjectId}`);
    return normalizeDetails(res?.item ?? res ?? {});
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
