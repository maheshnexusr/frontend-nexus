/**
 * sponsorSitesClient — Site Management for the active sponsor study.
 *
 * Spec §13.1 — /api/v1/sponsor/workspace/sites
 * Every call carries the sponsor Bearer token and (study_id, environment)
 * context automatically via sponsorAxiosClient (populated by
 * sponsorStudiesService.choose()).
 *
 * NOTE: The spec's body schema is narrower than what this UI currently renders
 * (it ships contactPerson/email/contactNumber/expectedEnrollments/isLocked
 * etc. that are not in §13.1). We keep the tolerant normalizer + extended
 * create/update body for backwards compatibility; unknown fields will either
 * be honored by the backend if supported or silently ignored. The UI should
 * eventually be trimmed to the spec shape.
 *
 * Endpoints retained from pre-spec implementation for UI compatibility but
 * NOT defined by the spec: /lock, /unlock, /export, /import, /countries.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE = '/api/v1/sponsor/workspace/sites';

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeSite(raw) {
  // Spec §4.1 authoritative field: site_number (was site_code in earlier drafts).
  const siteNumber   = raw.site_number ?? raw.siteNumber ?? raw.site_code ?? raw.siteCode ?? '';
  const enrollTarget = raw.enrollment_target ?? raw.enrollmentTarget
                    ?? raw.expected_enrollments ?? raw.expectedEnrollments ?? 0;
  const enrolled     = raw.enrolled_subjects ?? raw.enrolledSubjects
                    ?? raw.actual_enrollments ?? raw.actualEnrollments ?? 0;
  return {
    // Spec fields (§4.1)
    id:                    raw.site_id              ?? raw.siteId                ?? raw.id ?? '',
    siteNumber,
    siteCode:              siteNumber, // UI legacy alias
    siteName:              raw.site_name            ?? raw.siteName              ?? '',
    countryId:             raw.country_id           ?? raw.countryId             ?? '',
    locationId:            raw.location_id          ?? raw.locationId            ?? '',
    principalInvestigator: raw.principal_investigator ?? raw.principalInvestigator ?? '',
    status:                raw.status               ?? 'Active',
    enrollmentTarget:      enrollTarget,
    enrolledSubjects:      enrolled,
    lastActivityAt:        raw.last_activity_at     ?? raw.lastActivityAt        ?? '',
    createdAt:             raw.created_at           ?? raw.createdAt             ?? '',
    updatedAt:             raw.updated_at           ?? raw.updatedAt             ?? '',

    // UI-only aliases for existing components
    expectedEnrollments: enrollTarget,
    actualEnrollments:   enrolled,
    isLocked:            raw.is_locked            ?? raw.isLocked            ?? false,
    lockReason:          raw.lock_reason          ?? raw.lockReason          ?? '',
    // Contact (new schema uses point_of_contact_name; old uses contact_person)
    pointOfContactName:  raw.point_of_contact_name ?? raw.pointOfContactName ?? raw.contact_person ?? raw.contactPerson ?? '',
    contactPerson:       raw.contact_person       ?? raw.contactPerson       ?? '',
    email:               raw.email                ?? '',
    countryCode:         raw.country_code         ?? raw.countryCode         ?? '+91',
    contactNumber:       raw.contact_number       ?? raw.contactNumber       ?? '',
    // Address — new schema is single `address`; legacy is line1/line2.
    address:             raw.address              ?? '',
    addressLine1:        raw.address_line1        ?? raw.addressLine1        ?? '',
    addressLine2:        raw.address_line2        ?? raw.addressLine2        ?? '',
    siteLocation:        raw.site_location        ?? raw.siteLocation        ?? '',
    postalCode:          raw.postal_code          ?? raw.postalCode          ?? '',
    city:                raw.city                 ?? '',
    district:            raw.district             ?? '',
    state:               raw.state                ?? '',
    country:             raw.country              ?? '',
  };
}

function normalizeSiteDetails(raw) {
  return {
    ...normalizeSite(raw),
    enrollmentTrend: raw.enrollment_trend ?? raw.enrollmentTrend ?? [],
    personnel: (raw.personnel ?? []).map((p) => ({
      id:    p.id    ?? '',
      name:  p.name  ?? p.full_name ?? '',
      role:  p.role  ?? p.role_name ?? '',
      email: p.email ?? '',
    })),
    crfStats: {
      total:    raw.crf_stats?.total    ?? raw.crfStats?.total    ?? 0,
      complete: raw.crf_stats?.complete ?? raw.crfStats?.complete ?? 0,
      pending:  raw.crf_stats?.pending  ?? raw.crfStats?.pending  ?? 0,
    },
    queryStats: {
      open:   raw.query_stats?.open   ?? raw.queryStats?.open   ?? 0,
      closed: raw.query_stats?.closed ?? raw.queryStats?.closed ?? 0,
    },
    consentStats: {
      consented: raw.consent_stats?.consented ?? raw.consentStats?.consented ?? 0,
      pending:   raw.consent_stats?.pending   ?? raw.consentStats?.pending   ?? 0,
    },
    auditTrail: (raw.audit_trail ?? raw.auditTrail ?? []).map((e) => ({
      id:          e.id           ?? crypto.randomUUID(),
      action:      e.action       ?? '',
      performedBy: e.performed_by ?? e.performedBy ?? '',
      timestamp:   e.timestamp    ?? e.created_at  ?? '',
      details:     e.details      ?? '',
    })),
  };
}

/**
 * buildSitePayload — flattens the form into the snake_case wire shape.
 * Every field from the create/edit screen is included so the wire payload
 * is always complete and predictable; legacy spec fields (site_number,
 * principal_investigator, location_id, enrollment_target) are sent only
 * when populated, since the new form doesn't capture them.
 */
function buildSitePayload(data, _isCreate = false) {
  const payload = {
    // Site form (current screenshot)
    site_name:              data.siteName             ?? '',
    site_location:          data.siteLocation         ?? '',
    address:                data.address              ?? '',
    point_of_contact_name:  data.pointOfContactName   ?? '',
    email:                  data.email                ?? '',
    country_code:           data.countryCode          ?? '',
    contact_number:         data.contactNumber        ?? '',
    postal_code:            data.postalCode           ?? '',
    city:                   data.city                 ?? '',
    district:               data.district             ?? '',
    state:                  data.state                ?? '',
    country_id:             data.countryId            ?? '',
    status:                 data.status ?? (data.active === false ? 'Inactive' : 'Active'),
    is_locked:              data.isLocked ?? false,
  };

  // Legacy / optional spec fields — only attached when the caller actually
  // provided them (e.g. coming from import or older data).
  if (data.siteNumber || data.siteCode)              payload.site_number            = data.siteNumber ?? data.siteCode;
  if (data.locationId)                               payload.location_id            = data.locationId;
  if (data.principalInvestigator)                    payload.principal_investigator = data.principalInvestigator;
  if (data.enrollmentTarget != null)                 payload.enrollment_target      = Number(data.enrollmentTarget) || 0;
  else if (data.expectedEnrollments != null)         payload.enrollment_target      = Number(data.expectedEnrollments) || 0;

  return payload;
}

// ── Client ─────────────────────────────────────────────────────────────────────
//
// All methods accept `studyId` as the first argument for backwards compat with
// existing pages, but it is not needed by the network layer — sponsorAxiosClient
// injects study_id + environment from the persisted study context. The arg is
// still accepted so callers don't have to change today.

export const sponsorSitesClient = {
  /** GET /sites — list with optional filters. */
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters.status   && filters.status   !== 'All') params.status     = filters.status;
    if (filters.country  && filters.country  !== 'All') params.country_id = filters.country;
    if (filters.city)                                    params.city       = filters.city;
    if (filters.isLocked !== undefined && filters.isLocked !== 'All')
      params.is_locked = filters.isLocked;

    const res = await sponsorAxiosClient.get(BASE, { params });
    const arr = Array.isArray(res) ? res
            : (res?.sites ?? res?.items ?? res?.data ?? []);
    return arr.map(normalizeSite);
  },

  /** GET /sites/:siteId — detail. */
  async getById(_studyId, siteId) {
    const res = await sponsorAxiosClient.get(`${BASE}/${siteId}`);
    return normalizeSiteDetails(res?.item ?? res?.site ?? res ?? {});
  },

  /** POST /sites — create (current Site form §4.1).
   *
   * Every form field is sent, even when empty — JSON.stringify would otherwise
   * drop `undefined` keys and the wire payload would look incomplete. The
   * backend should treat empty strings the same as "unset" for optional fields.
   */
  async create(_studyId, data) {
    const res = await sponsorAxiosClient.post(BASE, buildSitePayload(data, /* isCreate */ true));
    return normalizeSite(res?.item ?? res?.site ?? res ?? {});
  },

  /** PATCH /sites/:siteId — update. Same payload shape as create. */
  async update(_studyId, siteId, data) {
    const res = await sponsorAxiosClient.patch(`${BASE}/${siteId}`, buildSitePayload(data, false));
    return normalizeSite(res?.item ?? res?.site ?? res ?? {});
  },

  /** DELETE /sites/:siteId. */
  async delete(_studyId, siteId) {
    await sponsorAxiosClient.delete(`${BASE}/${siteId}`);
  },

  /** POST /sites/:siteId/activate — spec §13.1 */
  async activate(_studyId, siteId) {
    const res = await sponsorAxiosClient.post(`${BASE}/${siteId}/activate`);
    return normalizeSite(res?.item ?? res ?? {});
  },

  // ── Not defined by spec §13.1 — retained for current UI. ──────────────────
  /** POST /sites/:siteId/lock — non-spec. */
  async lock(_studyId, siteId, reason) {
    const res = await sponsorAxiosClient.post(`${BASE}/${siteId}/lock`, { reason });
    return normalizeSite(res?.item ?? res ?? {});
  },

  /** POST /sites/:siteId/unlock — non-spec. */
  async unlock(_studyId, siteId, reason) {
    const res = await sponsorAxiosClient.post(`${BASE}/${siteId}/unlock`, { reason });
    return normalizeSite(res?.item ?? res ?? {});
  },

  /** GET /sites/export — non-spec. */
  async export(_studyId, format = 'csv', filters = {}) {
    const params = { format };
    if (filters.status  && filters.status  !== 'All') params.status     = filters.status;
    if (filters.country && filters.country !== 'All') params.country_id = filters.country;

    const res  = await sponsorAxiosClient.get(`${BASE}/export`, { params, responseType: 'blob' });
    const blob = res instanceof Blob ? res : new Blob([res], {
      type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
    });
    const ext  = format === 'xlsx' ? 'xlsx' : 'csv';
    const date = new Date().toISOString().slice(0, 10);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Sites_${date}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** POST /sites/import — non-spec. */
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

  /** GET /sites/countries — non-spec helper for the filter dropdown. */
  async getCountries(_studyId) {
    try {
      const res = await sponsorAxiosClient.get(`${BASE}/countries`);
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return arr.map((c) => (typeof c === 'string' ? c : (c.name ?? c.country ?? '')));
    } catch { return []; }
  },
};
