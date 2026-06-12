/**
 * siteSitePersonnelClient — Site Personnel Management for the site user's
 * own site, in the currently chosen study.
 *
 * Mirrors the surface of sponsorPersonnelClient so SitePersonnelPage can be a
 * straight copy of the sponsor PersonnelPage with the import swapped. The
 * backend pins site_id to req.siteUser.siteId from the JWT, so any site_id
 * sent in the request body is ignored.
 */

import siteAxiosClient from '@/api/siteAxiosClient';

const BASE = '/api/v1/site/workspace/site-personnel';
const WORKSPACE = '/api/v1/site/workspace';

function normalizePersonnel(raw) {
  return {
    id:                  raw.id                    ?? raw.personnel_id      ?? '',
    fullName:            raw.full_name             ?? raw.fullName          ?? '',
    email:               raw.email                 ?? raw.email_address     ?? '',
    role:                raw.role                  ?? raw.role_name         ?? '',
    roleId:              raw.role_id               ?? raw.roleId            ?? '',
    siteId:              raw.site_id               ?? raw.siteId            ?? '',
    siteName:            raw.site_name             ?? raw.siteName          ?? '',
    contactNumber:       raw.contact_number        ?? raw.contactNumber     ?? '',
    status:              raw.status                ?? 'Active',
    // Site response doesn't yet carry consent / compensation — keep defaults so
    // the mirrored sponsor UI columns render gracefully instead of blank.
    consentStatus:       raw.consent_status        ?? raw.consentStatus     ?? 'Pending',
    consentRequired:     raw.consent_required      ?? raw.consentRequired   ?? true,
    consentTemplateId:   raw.consent_template_id   ?? raw.consentTemplateId ?? '',
    consentTemplateName: raw.consent_template_name ?? raw.consentTemplateName ?? '',
    invitationSent:      raw.invitation_sent       ?? raw.invitationSent    ?? Boolean(raw.invitation_sent_at),
    invitationOpenedAt:  raw.invitation_opened_at  ?? raw.invitationOpenedAt ?? raw.activated_at ?? '',
    compensation:        normalizeCompensation(raw.compensation ?? {}),
    createdAt:           raw.created_at            ?? raw.createdAt         ?? '',
    updatedAt:           raw.updated_at            ?? raw.updatedAt         ?? '',
  };
}

function normalizeCompensation(raw) {
  return {
    type:                raw.type                  ?? 'None',
    amount:              raw.amount                ?? 0,
    currency:            raw.currency              ?? 'USD',
    paymentSchedule:     raw.payment_schedule      ?? raw.paymentSchedule      ?? 'One-time',
    paymentMethod:       raw.payment_method        ?? raw.paymentMethod        ?? 'Bank Transfer',
    bankDetailsRequired: raw.bank_details_required ?? raw.bankDetailsRequired  ?? false,
    totalEligible:       raw.total_eligible        ?? raw.totalEligible        ?? 0,
    amountPaid:          raw.amount_paid           ?? raw.amountPaid           ?? 0,
    amountPending:       raw.amount_pending        ?? raw.amountPending        ?? 0,
    paymentHistory:      (raw.payment_history ?? raw.paymentHistory ?? []).map((p) => ({
      id:        p.id        ?? crypto.randomUUID(),
      amount:    p.amount    ?? 0,
      currency:  p.currency  ?? 'USD',
      status:    p.status    ?? '',
      date:      p.date      ?? p.paid_at ?? '',
      reference: p.reference ?? '',
    })),
  };
}

function normalizeDetails(raw) {
  return {
    ...normalizePersonnel(raw),
    auditTrail: (raw.audit_trail ?? raw.auditTrail ?? []).map((e) => ({
      id:          e.id           ?? crypto.randomUUID(),
      action:      e.action       ?? '',
      performedBy: e.performed_by ?? e.performedBy ?? '',
      timestamp:   e.timestamp    ?? e.created_at  ?? '',
      details:     e.details      ?? '',
    })),
  };
}

export const siteSitePersonnelClient = {
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters.status        && filters.status !== 'All')        params.status         = filters.status;
    if (filters.role          && filters.role !== 'All')          params.role           = filters.role;
    if (filters.siteId        && filters.siteId !== 'All')        params.site_id        = filters.siteId;
    if (filters.consentStatus && filters.consentStatus !== 'All') params.consent_status = filters.consentStatus;

    const res = await siteAxiosClient.get(BASE, { params });
    const arr = Array.isArray(res) ? res : (res?.items ?? res?.personnel ?? res?.data ?? []);
    return arr.map(normalizePersonnel);
  },

  async getById(_studyId, personnelId) {
    const res = await siteAxiosClient.get(`${BASE}/${personnelId}`);
    return normalizeDetails(res?.item ?? res?.personnel ?? res ?? {});
  },

  async invite(_studyId, data) {
    const res = await siteAxiosClient.post(`${BASE}/invite`, {
      full_name:      data.fullName,
      email_address:  data.email,
      role_id:        data.roleId ?? data.role,
      contact_number: data.contactNumber,
    });
    return normalizePersonnel(res?.item ?? res ?? {});
  },

  async update(_studyId, personnelId, data) {
    const res = await siteAxiosClient.patch(`${BASE}/${personnelId}`, {
      full_name:      data.fullName,
      role_id:        data.roleId ?? data.role,
      contact_number: data.contactNumber,
      status:         data.status,
    });
    return normalizePersonnel(res?.item ?? res ?? {});
  },

  async delete(_studyId, personnelId) {
    await siteAxiosClient.delete(`${BASE}/${personnelId}`);
  },

  async resendInvitation(_studyId, personnelId) {
    await siteAxiosClient.post(`${BASE}/${personnelId}/resend-invitation`);
  },

  // ── Compensation / Import / Export — not yet wired site-side. The page
  //    references them; keep stubs so the mirrored UI doesn't blow up.
  async updateCompensation(_studyId, _personnelId, data) {
    return normalizeCompensation(data ?? {});
  },

  async import(_studyId, _file) {
    return { imported: 0, failed: 0, errors: ['Import is not yet supported for site personnel.'] };
  },

  async export(_studyId, _format = 'csv') {
    throw new Error('Export is not yet supported for site personnel.');
  },

  async getConsentTemplates(_studyId, _role) {
    return [];
  },

  /** Site Roles master for this study — feeds the Personnel role filter and the
   *  invite/edit role picker so neither hardcodes role names. Returns
   *  { id, name, status }[]. Best-effort: [] on error so the UI still renders. */
  async roles(_studyId) {
    try {
      const res = await siteAxiosClient.get(`${WORKSPACE}/lookups/site-roles`);
      const arr = Array.isArray(res) ? res : (res?.roles ?? res?.items ?? res?.data ?? []);
      return arr.map((r) => ({
        id:     r.role_id   ?? r.roleId   ?? r.id   ?? '',
        name:   r.role_name ?? r.roleName ?? r.name ?? '',
        status: r.status    ?? 'Active',
      })).filter((r) => r.name);
    } catch { return []; }
  },

  /** Site filter dropdown source — single row (the user's own site). */
  async getSites(_studyId) {
    try {
      const res = await siteAxiosClient.get(`${BASE}/sites`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.personnel ?? res?.data ?? []);
      return arr.map((s) => ({
        id:    s.id       ?? s.site_id   ?? '',
        label: `${s.site_name ?? s.siteName ?? ''} (${s.site_code ?? s.siteCode ?? ''})`.trim(),
      }));
    } catch { return []; }
  },
};

export default siteSitePersonnelClient;
