/**
 * sponsorPersonnelClient — Site Personnel Management for the active sponsor study.
 *
 * Spec §13.3 — /api/v1/sponsor/workspace/site-personnel
 * Sponsor Bearer + (study_id, environment) context auto-attached by
 * sponsorAxiosClient.
 *
 * `studyId` kept as first arg for backwards compat with existing pages; it is
 * ignored by the network layer (auto-injected). Extra methods (resend,
 * compensation, import, export, helpers) are preserved though not in spec.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE = '/api/v1/sponsor/workspace/site-personnel';
const WORKSPACE = '/api/v1/sponsor/workspace';

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizePersonnel(raw) {
  return {
    id:                  raw.id                    ?? raw.personnel_id      ?? '',
    fullName:            raw.full_name             ?? raw.fullName          ?? '',
    email:               raw.email                 ?? raw.email_address     ?? '',
    role:                raw.role                  ?? raw.role_name         ?? '',
    roleId:              raw.role_id               ?? raw.roleId            ?? '',
    siteId:              raw.site_id               ?? raw.siteId            ?? '',
    siteIds:             raw.site_ids              ?? raw.siteIds
                          ?? [raw.site_id ?? raw.siteId, ...(raw.additional_site_ids ?? raw.additionalSiteIds ?? [])].filter(Boolean),
    siteName:            raw.site_name             ?? raw.siteName          ?? '',
    contactNumber:       raw.contact_number        ?? raw.contactNumber     ?? '',
    status:              raw.status                ?? 'Active',
    consentStatus:       raw.consent_status        ?? raw.consentStatus     ?? 'Pending',
    consentRequired:     raw.consent_required      ?? raw.consentRequired   ?? true,
    consentTemplateId:   raw.consent_template_id   ?? raw.consentTemplateId ?? '',
    consentTemplateName: raw.consent_template_name ?? raw.consentTemplateName ?? '',
    invitationSent:      raw.invitation_sent       ?? raw.invitationSent    ?? false,
    invitationOpenedAt:  raw.invitation_opened_at  ?? raw.invitationOpenedAt ?? '',
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

function normalizeConsentTemplate(raw) {
  return {
    id:              raw.id           ?? raw.template_id ?? '',
    name:            raw.name         ?? raw.template_name ?? '',
    version:         raw.version      ?? '',
    updatedAt:       raw.updated_at   ?? raw.updatedAt    ?? '',
    applicableRoles: raw.applicable_roles ?? raw.applicableRoles ?? [],
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

// ── Client ─────────────────────────────────────────────────────────────────────

export const sponsorPersonnelClient = {
  /** GET /site-personnel — list with optional filters. */
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters.status        && filters.status !== 'All')        params.status         = filters.status;
    if (filters.role          && filters.role !== 'All')          params.role           = filters.role;
    if (filters.siteId        && filters.siteId !== 'All')        params.site_id        = filters.siteId;
    if (filters.consentStatus && filters.consentStatus !== 'All') params.consent_status = filters.consentStatus;

    const res = await sponsorAxiosClient.get(BASE, { params });
    const arr = Array.isArray(res) ? res : (res?.items ?? res?.personnel ?? res?.data ?? []);
    return arr.map(normalizePersonnel);
  },

  /** GET /lookups/site-personnel — dropdown-only list, ungated by
   *  site_personnel.view. Used by the Raise Query "Associated" dropdown so a
   *  Query Manager can assign work without holding the personnel-management
   *  permission. */
  async lookup() {
    const res = await sponsorAxiosClient.get(
      '/api/v1/sponsor/workspace/lookups/site-personnel'
    );
    const arr = Array.isArray(res) ? res : (res?.items ?? res?.personnel ?? res?.data ?? []);
    return arr.map(normalizePersonnel);
  },

  /** GET /site-personnel/:personnelId — details. */
  async getById(_studyId, personnelId) {
    const res = await sponsorAxiosClient.get(`${BASE}/${personnelId}`);
    return normalizeDetails(res?.item ?? res?.personnel ?? res ?? {});
  },

  /** POST /site-personnel/invite — spec §13.3 invite body.
   *  Sends `site_ids` (array); the first element is the primary site and the
   *  rest land in additional_site_ids on the backend. Single-site invites
   *  send a one-element array. */
  async invite(_studyId, data) {
    const siteIds = Array.isArray(data.siteIds) && data.siteIds.length
      ? data.siteIds
      : (data.siteId ? [data.siteId] : []);
    const res = await sponsorAxiosClient.post(`${BASE}/invite`, {
      full_name:      data.fullName,
      email_address:  data.email,
      role_id:        data.roleId ?? data.role,
      site_ids:       siteIds,
      // Keep the legacy single-site field populated for back-compat with
      // any caller still on the old contract.
      site_id:        siteIds[0],
      contact_number: data.contactNumber,
      status:         data.status ?? 'Active',
      compensation: data.compensation?.type !== 'None' ? {
        type:                  data.compensation.type,
        amount:                Number(data.compensation.amount),
        currency:              data.compensation.currency,
        payment_schedule:      data.compensation.paymentSchedule,
        payment_method:        data.compensation.paymentMethod,
        bank_details_required: data.compensation.bankDetailsRequired,
      } : { type: 'None' },
    });
    return normalizePersonnel(res?.item ?? res ?? {});
  },

  /** PATCH /site-personnel/:personnelId — spec §13.3 edit. */
  async update(_studyId, personnelId, data) {
    const siteIds = Array.isArray(data.siteIds) && data.siteIds.length
      ? data.siteIds
      : (data.siteId ? [data.siteId] : []);
    const res = await sponsorAxiosClient.patch(`${BASE}/${personnelId}`, {
      full_name:      data.fullName,
      role_id:        data.roleId ?? data.role,
      site_ids:       siteIds,
      site_id:        siteIds[0],
      contact_number: data.contactNumber,
      status:         data.status,
      compensation: data.compensation?.type !== 'None' ? {
        type:                  data.compensation.type,
        amount:                Number(data.compensation.amount),
        currency:              data.compensation.currency,
        payment_schedule:      data.compensation.paymentSchedule,
        payment_method:        data.compensation.paymentMethod,
        bank_details_required: data.compensation.bankDetailsRequired,
      } : { type: 'None' },
    });
    return normalizePersonnel(res?.item ?? res ?? {});
  },

  /** DELETE /site-personnel/:personnelId — spec §13.3 delete. */
  async delete(_studyId, personnelId) {
    await sponsorAxiosClient.delete(`${BASE}/${personnelId}`);
  },

  // ── Not in spec §13.3 — retained for current UI. ──────────────────────────
  async resendInvitation(_studyId, personnelId) {
    await sponsorAxiosClient.post(`${BASE}/${personnelId}/resend-invitation`);
  },

  async updateCompensation(_studyId, personnelId, data) {
    const res = await sponsorAxiosClient.patch(`${BASE}/${personnelId}/compensation`, {
      type:                  data.type,
      amount:                Number(data.amount),
      currency:              data.currency,
      payment_schedule:      data.paymentSchedule,
      payment_method:        data.paymentMethod,
      bank_details_required: data.bankDetailsRequired,
    });
    return normalizeCompensation(res?.item ?? res ?? {});
  },

  async import(_studyId, file) {
    const form = new FormData();
    form.append('file', file);
    const res = await sponsorAxiosClient.post(`${BASE}/import`, form);
    return {
      imported: res?.imported ?? res?.success_count ?? 0,
      failed:   res?.failed   ?? res?.failure_count ?? 0,
      errors:   res?.errors   ?? [],
    };
  },

  async export(_studyId, format = 'csv') {
    const res  = await sponsorAxiosClient.get(`${BASE}/export`, { params: { format }, responseType: 'blob' });
    const blob = res instanceof Blob ? res : new Blob([res], {
      type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
    });
    const ext  = format === 'xlsx' ? 'xlsx' : 'csv';
    const date = new Date().toISOString().slice(0, 10);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Personnel_${date}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Consent template list for a role — backed by /consent/templates (§13.4). */
  async getConsentTemplates(_studyId, role) {
    try {
      const res = await sponsorAxiosClient.get(`${WORKSPACE}/consent/templates`, {
        params: { role },
      });
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return arr.map(normalizeConsentTemplate);
    } catch { return []; }
  },

  /** Active site list for dropdown — backed by /sites (§13.1). */
  async getSites(_studyId) {
    try {
      const res = await sponsorAxiosClient.get(`${WORKSPACE}/sites`, { params: { status: 'Active' } });
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return arr.map((s) => ({
        id:    s.id       ?? s.site_id   ?? '',
        label: `${s.site_name ?? s.siteName ?? ''} (${s.site_code ?? s.siteCode ?? ''})`.trim(),
      }));
    } catch { return []; }
  },
};
