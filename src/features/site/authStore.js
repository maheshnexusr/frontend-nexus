/**
 * Site auth store — localStorage wrapper for the `site` scope.
 *
 * Two-token model (mirrors the backend, see siteAuthMiddleware.js):
 *
 *   siteAccessToken    — SESSION token. Study-agnostic { siteUserId }.
 *                        Used for the study picker (/site/studies, /choose)
 *                        and /site/auth/me. Refreshed silently via
 *                        /site/auth/refresh + siteRefreshToken.
 *   siteRefreshToken   — refresh token for the session token.
 *   siteWorkspaceToken — WORKSPACE token. Study-scoped, minted by
 *                        POST /site/studies/choose. Required for any tenant-DB
 *                        request. Not silently refreshable — re-obtained by
 *                        calling /choose again (i.e. picking the study).
 *
 *   siteAuthUser       — JSON { siteUserId, fullName, emailAddress, status }
 *   siteStudies        — JSON array of study cards (the picker list)
 *   siteStudyContext   — JSON of the chosen study: { studyId, environment,
 *                        siteId, siteName, personnelId, roleId, roleName,
 *                        studyTitle, scope, permissions, ... }
 *
 * "Switching study/DB" = clearSiteStudyContext() then choose again. The
 * session token stays valid the whole time — no re-login.
 */

const SESSION_TOKEN_KEY   = 'siteAccessToken';
const REFRESH_TOKEN_KEY   = 'siteRefreshToken';
const WORKSPACE_TOKEN_KEY = 'siteWorkspaceToken';
const USER_KEY            = 'siteAuthUser';
const STUDIES_KEY         = 'siteStudies';
const CONTEXT_KEY         = 'siteStudyContext';

function safeWrite(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore quota errors */ }
}
function safeRead(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
function readJson(key) {
  try {
    const raw = safeRead(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ── Session (login / activate) ───────────────────────────────────────────── */

/**
 * Persist a login or activate response: session token + refresh token + the
 * study-agnostic user record + the assigned-studies list for the picker.
 * Does NOT touch the workspace token / study context — that comes from choose.
 */
export function setSiteSession(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload;
  const u = (o.user && typeof o.user === 'object') ? o.user : o;

  const accessToken  = o.accessToken  ?? o.access_token;
  const refreshToken = o.refreshToken ?? o.refresh_token;
  if (accessToken)  safeWrite(SESSION_TOKEN_KEY, accessToken);
  if (refreshToken) safeWrite(REFRESH_TOKEN_KEY, refreshToken);

  const user = {
    siteUserId:   u.site_user_id  ?? u.siteUserId  ?? u.id ?? '',
    fullName:     u.full_name     ?? u.fullName    ?? '',
    emailAddress: u.email_address ?? u.emailAddress ?? u.email ?? '',
    status:       u.status        ?? 'Active',
  };
  safeWrite(USER_KEY, JSON.stringify(user));

  if (Array.isArray(o.studies)) {
    safeWrite(STUDIES_KEY, JSON.stringify(o.studies));
  }
  return user;
}

export function getSiteAccessToken()  { return safeRead(SESSION_TOKEN_KEY); }
export function getSiteRefreshToken() { return safeRead(REFRESH_TOKEN_KEY); }
export function getSiteAuthUser()     { return readJson(USER_KEY); }
export function getSiteStudies()      { return readJson(STUDIES_KEY) ?? []; }

/** Refresh just the session access token (called by the 401 interceptor). */
export function setSiteAccessToken(token) {
  if (token) safeWrite(SESSION_TOKEN_KEY, token);
}

/** Replace the cached picker list (e.g. after /site/auth/me). */
export function setSiteStudies(studies) {
  if (Array.isArray(studies)) safeWrite(STUDIES_KEY, JSON.stringify(studies));
}

/* ── Study context (choose / switch) ──────────────────────────────────────── */

/**
 * Persist a POST /site/studies/choose response: the study-scoped workspace
 * token + the chosen-study context (tenant routing keys, role, permissions).
 */
export function setSiteStudyContext(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload;

  const workspaceToken = o.workspaceToken ?? o.workspace_token;
  if (workspaceToken) safeWrite(WORKSPACE_TOKEN_KEY, workspaceToken);

  const context = {
    studyId:       o.studyId       ?? o.study_id       ?? '',
    environment:   o.environment   ?? '',
    siteId:        o.siteId        ?? o.site_id        ?? '',
    siteName:      o.siteName      ?? o.site_name      ?? '',
    personnelId:   o.personnelId   ?? o.personnel_id   ?? '',
    roleId:        o.roleId        ?? o.role_id        ?? '',
    roleName:      o.roleName      ?? o.role_name      ?? '',
    studyTitle:    o.studyTitle    ?? o.study_title    ?? '',
    protocolNumber:o.protocolNumber?? o.protocol_number?? '',
    sponsorId:     o.sponsorId     ?? o.sponsor_id     ?? '',
    sponsorName:   o.sponsorName   ?? o.sponsor_name   ?? '',
    organizationLogo: o.organizationLogo ?? o.organization_logo_path ?? null,
    versionNumber: o.versionNumber ?? o.version_number ?? '',
    scope:         o.scope         ?? { edc: false, survey: false, epro: false },
    // Step-3 study-configuration toggles (consentManager / consentApproval /
    // queryManager / verificationManager) — drive the optional-module menus
    // (e.g. Consent Review & Approval). null → resolveStudyConfig fail-open.
    config:        o.config        ?? null,
    permissions:   o.permissions   ?? {},
    // Per-role dashboard whitelist (site_roles.dashboard_widget_keys). null →
    // use default category-leaf gating; array (possibly empty) → explicit
    // whitelist. Source: backend buildSiteView → /sponsor-or-site studies/choose
    // and /profile/me/permissions both include it under user.dashboard_widget_keys.
    dashboardWidgetKeys:
      o.dashboard_widget_keys ?? o.dashboardWidgetKeys
      ?? o.user?.dashboard_widget_keys ?? o.user?.dashboardWidgetKeys
      ?? null,
  };
  safeWrite(CONTEXT_KEY, JSON.stringify(context));
  return context;
}

export function getSiteWorkspaceToken() { return safeRead(WORKSPACE_TOKEN_KEY); }
export function getSiteStudyContext()   { return readJson(CONTEXT_KEY); }
export function hasSiteStudyContext()   { return !!safeRead(WORKSPACE_TOKEN_KEY); }

/**
 * Shallow-merge fields into the stored study context (e.g. a refreshed
 * permission tree from /profile/me/permissions). No-op shape if there is no
 * context yet — the workspace token is what choose() owns.
 */
export function mergeSiteStudyContext(partial) {
  if (!partial || typeof partial !== 'object') return null;
  const current = readJson(CONTEXT_KEY) ?? {};
  const merged = { ...current, ...partial };
  safeWrite(CONTEXT_KEY, JSON.stringify(merged));
  return merged;
}

/** Drop the chosen study — used by "Switch study" (back to the picker). */
export function clearSiteStudyContext() {
  safeRemove(WORKSPACE_TOKEN_KEY);
  safeRemove(CONTEXT_KEY);
}

/* ── Whole session ────────────────────────────────────────────────────────── */

/** True when a site-scope session is active (signed in, study or not). */
export function isSiteSession() {
  return !!safeRead(SESSION_TOKEN_KEY) || !!safeRead(USER_KEY);
}

/** Full sign-out — does not touch CRO or sponsor scopes. */
export function clearSiteSession() {
  [
    SESSION_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    WORKSPACE_TOKEN_KEY,
    USER_KEY,
    STUDIES_KEY,
    CONTEXT_KEY,
  ].forEach(safeRemove);
}
