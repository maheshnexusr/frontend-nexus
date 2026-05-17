/**
 * sponsorAuthService.js
 * Sponsor-scope authentication API — /api/v1/sponsor/auth/*
 *
 * Per spec section 11: sponsor tokens are a separate scope from CRO tokens
 * and cannot be swapped. Tokens issued here should be stored under
 * sponsor-specific keys (see sponsorTokenStore below) and attached to any
 * request that targets /api/v1/sponsor/** routes.
 *
 * All request payloads use snake_case per API spec.
 */

import axiosClient        from '@/api/axiosClient';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';

/* ── Scope-separated token storage ──────────────────────────────────────── */
const SPONSOR_ACCESS_KEY  = 'sponsorAccessToken';
const SPONSOR_REFRESH_KEY = 'sponsorRefreshToken';
const SPONSOR_USER_KEY    = 'sponsorAuthUser';
const SPONSOR_CONTEXT_KEY = 'sponsorStudyContext';

export const sponsorTokenStore = {
  getAccessToken:  () => localStorage.getItem(SPONSOR_ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(SPONSOR_REFRESH_KEY),
  saveTokens: (data) => {
    const access  = data?.accessToken  ?? data?.access_token;
    const refresh = data?.refreshToken ?? data?.refresh_token;
    if (access)  localStorage.setItem(SPONSOR_ACCESS_KEY,  access);
    if (refresh) localStorage.setItem(SPONSOR_REFRESH_KEY, refresh);
  },
  saveUser: (user) => {
    if (user) localStorage.setItem(SPONSOR_USER_KEY, JSON.stringify(user));
  },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem(SPONSOR_USER_KEY) ?? 'null'); }
    catch { return null; }
  },
  clear: () => {
    localStorage.removeItem(SPONSOR_ACCESS_KEY);
    localStorage.removeItem(SPONSOR_REFRESH_KEY);
    localStorage.removeItem(SPONSOR_USER_KEY);
    localStorage.removeItem(SPONSOR_CONTEXT_KEY);
  },
};

/**
 * Persisted study context for sponsor workspace requests.
 * Set via sponsorStudiesService.choose(); consumed by sponsorAxiosClient to
 * auto-inject study_id + environment into /api/v1/sponsor/workspace/* calls.
 */
export const sponsorStudyContextStore = {
  get: () => {
    try { return JSON.parse(localStorage.getItem(SPONSOR_CONTEXT_KEY) ?? 'null'); }
    catch { return null; }
  },
  set: ({ studyId, environment, studyContextToken }) => {
    if (!studyId || !environment) return;
    localStorage.setItem(SPONSOR_CONTEXT_KEY, JSON.stringify({
      studyId, environment, studyContextToken: studyContextToken ?? null,
    }));
  },
  clear: () => localStorage.removeItem(SPONSOR_CONTEXT_KEY),
};

/* ── Service ────────────────────────────────────────────────────────────── */
export const sponsorAuthService = {
  /**
   * POST /api/v1/sponsor/auth/invite    (CRO-only, spec §1.1)
   * Auth: CRO Bearer, feature ClinicalPrograms.Sponsors.create
   * Required: sponsor_id, email_address
   * Optional: full_name, contact_number, job_title, role_id, study_id,
   *           environment ('UAT'|'LIVE'), study_title, protocol_number,
   *           is_primary_contact
   * Response: { success, userId, invitationId, emailSent, emailWarning }
   */
  invite: ({
    sponsorId, emailAddress, fullName, contactNumber, jobTitle, roleId,
    studyId, environment, studyTitle, protocolNumber, isPrimaryContact,
  }) =>
    axiosClient.post('/api/v1/sponsor/auth/invite', {
      sponsor_id:         sponsorId,
      email_address:      emailAddress,
      full_name:          fullName         || undefined,
      contact_number:     contactNumber    || undefined,
      job_title:          jobTitle         || undefined,
      role_id:            roleId           ?? undefined,
      study_id:           studyId          || undefined,
      environment:        environment      || undefined,
      study_title:        studyTitle       || undefined,
      protocol_number:    protocolNumber   || undefined,
      is_primary_contact: typeof isPrimaryContact === 'boolean' ? isPrimaryContact : undefined,
    }),

  /**
   * POST /api/v1/sponsor/auth/activate   (public)
   * Body: { token, password, confirm_password }
   */
  activate: ({ token, password, confirmPassword }) =>
    axiosClient.post('/api/v1/sponsor/auth/activate', {
      token,
      password,
      confirm_password: confirmPassword,
    }),

  /** POST /api/v1/auth/login/password (public) — shared with CRO login */
  login: ({ emailAddress, password }) =>
    axiosClient.post('/api/v1/auth/login/password', {
      email_address: emailAddress,
      password,
    }),

  /** POST /api/v1/auth/login/otp/request (public) */
  requestOtp: ({ emailAddress }) =>
    axiosClient.post('/api/v1/auth/login/otp/request', {
      email_address: emailAddress,
    }),

  /** POST /api/v1/auth/login/otp/verify (public) */
  verifyOtp: ({ emailAddress, otp }) =>
    axiosClient.post('/api/v1/auth/login/otp/verify', {
      email_address: emailAddress,
      otp,
    }),

  /** POST /api/v1/sponsor/auth/refresh (public) */
  refreshToken: (refreshToken) =>
    axiosClient.post('/api/v1/sponsor/auth/refresh', {
      refresh_token: refreshToken,
    }),

  /**
   * POST /api/v1/sponsor/auth/logout
   * Auth: sponsor Bearer token (attached automatically by sponsorAxiosClient).
   */
  logout: () => sponsorAxiosClient.post('/api/v1/sponsor/auth/logout'),
};

/* ── Sponsor Studies (section 12) ───────────────────────────────────────── */

/**
 * Normalize a sponsor study assignment from the /sponsor/studies response.
 *
 * Backend shape (per controller):
 *   { assignmentId, studyId, protocolNumber, studyTitle, therapeuticArea,
 *     environment, studyStatus, scope: { edc, survey, epro }, versionNumber,
 *     publishedAt, roleId, roleName, sponsorId, sponsorName,
 *     accessStartsAt, accessEndsAt }
 *
 * UI expects a flat record with a single `scope` label ('EDC'|'ePRO'|'Survey')
 * derived from the scope-flag bag. Config is not in the list response; it
 * arrives later via POST /choose or the dashboard endpoint, so defaults to null
 * here. SponsorLayout falls back to all-enabled when config is null.
 */
function deriveScopeLabel(scope) {
  if (!scope || typeof scope !== 'object') return 'EDC';
  if (scope.edc)    return 'EDC';
  if (scope.epro)   return 'ePRO';
  if (scope.survey) return 'Survey';
  return 'EDC';
}

function normalizeStudyAssignment(raw) {
  const env = raw.environment ?? raw.env;
  return {
    id:              raw.studyId          ?? raw.study_id,
    assignmentId:    raw.assignmentId     ?? raw.assignment_id,
    title:           raw.studyTitle       ?? raw.study_title       ?? '',
    protocolId:      raw.protocolNumber   ?? raw.protocol_number   ?? '',
    therapeuticArea: raw.therapeuticArea  ?? raw.therapeutic_area  ?? '',
    environment:     env,
    environments:    env ? [env] : [],
    status:          raw.studyStatus      ?? raw.study_status      ?? 'Active',
    scope:           deriveScopeLabel(raw.scope),
    scopeFlags:      raw.scope ?? { edc: false, epro: false, survey: false },
    versionNumber:   raw.versionNumber    ?? raw.version_number    ?? null,
    publishedAt:     raw.publishedAt      ?? raw.published_at      ?? null,
    roleId:          raw.roleId           ?? raw.role_id           ?? null,
    roleName:        raw.roleName         ?? raw.role_name         ?? '',
    sponsorId:       raw.sponsorId        ?? raw.sponsor_id        ?? null,
    sponsorName:     raw.sponsorName      ?? raw.sponsor_name      ?? '',
    accessStartsAt:  raw.accessStartsAt   ?? raw.access_starts_at  ?? null,
    accessEndsAt:    raw.accessEndsAt     ?? raw.access_ends_at    ?? null,
    config:          null,
  };
}

function extractStudyList(res) {
  const arr = Array.isArray(res)
    ? res
    : (res?.studies ?? res?.items ?? res?.data ?? []);
  return arr.map(normalizeStudyAssignment);
}

export const sponsorStudiesService = {
  /**
   * GET /api/v1/sponsor/studies
   * Auth: sponsor Bearer. Returns the assignments the sponsor user can enter.
   */
  list: async () => {
    const res = await sponsorAxiosClient.get('/api/v1/sponsor/studies');
    return extractStudyList(res);
  },

  /**
   * POST /api/v1/sponsor/studies/choose (spec §3.2)
   * Body: { study_id, environment: 'UAT' | 'LIVE' }
   * Returns: { success, studyContextToken, study }
   * Side effect: persists { studyId, environment, studyContextToken } so that
   * subsequent /sponsor/workspace/* calls auto-include study context.
   */
  choose: async (id, { environment }) => {
    const res = await sponsorAxiosClient.post(
      '/api/v1/sponsor/studies/choose',
      { study_id: id, environment },
    );
    sponsorStudyContextStore.set({
      studyId:           id,
      environment,
      studyContextToken: res?.studyContextToken ?? res?.study_context_token,
    });
    return res;
  },

  /** GET /api/v1/sponsor/studies/dashboard?study_id=...&environment=UAT|LIVE (spec §3.3) */
  metrics: (id, { environment, ...extra } = {}) =>
    sponsorAxiosClient.get('/api/v1/sponsor/studies/dashboard', {
      params: { study_id: id, environment, ...extra },
    }),
};
