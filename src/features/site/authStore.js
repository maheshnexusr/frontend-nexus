/**
 * Site auth store — tiny wrapper around localStorage for the `site` scope.
 *
 * Keys used:
 *   siteAccessToken   — Bearer for /api/v1/site/* and (via ProtectedRoute)
 *                       /api/v1/sponsor/* when the user is site personnel.
 *   siteRefreshToken
 *   siteAuthUser      — JSON: { roleId, roleName, studyId, siteId, environment,
 *                                permissions: { [leafKey]: { view, … } }, … }
 *
 * The whole point of `siteAuthUser.permissions` is to drive the sidebar
 * gating in SponsorLayout via useSiteRolePermissions.
 */

const TOKEN_KEY     = 'siteAccessToken';
const REFRESH_KEY   = 'siteRefreshToken';
const USER_KEY      = 'siteAuthUser';

function safeWrite(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore quota errors */ }
}
function safeRead(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * Persist whatever the backend returns into the `site` scope.
 *
 * Accepts the activate response, the login response, or a /me-style
 * "current role permissions" payload — anything with a permissions tree
 * (and ideally roleId / studyId / siteId / environment).
 *
 * Example input matches your contract:
 *   {
 *     success: true, scope: "site", model: "tree",
 *     roleId, roleName, description, isSystemRole,
 *     permissions: { dashboard: { view, export }, ... },
 *     studyId, environment, siteId,
 *     accessToken?, refreshToken?,        // optional — preserved if present
 *     user?: { ... }                       // optional — flat form preferred
 *   }
 */
export function setSiteSession(payload) {
  if (!payload || typeof payload !== 'object') return;

  const o = payload;
  // Accept user fields nested under `user` or flat at the top.
  const u = (o.user && typeof o.user === 'object') ? o.user : o;

  if (o.accessToken  || o.access_token)  safeWrite(TOKEN_KEY,   o.accessToken  ?? o.access_token);
  if (o.refreshToken || o.refresh_token) safeWrite(REFRESH_KEY, o.refreshToken ?? o.refresh_token);

  const user = {
    personnelId:   u.personnel_id    ?? u.personnelId   ?? u.id ?? '',
    fullName:      u.full_name       ?? u.fullName      ?? '',
    emailAddress:  u.email_address   ?? u.emailAddress  ?? u.email ?? '',
    siteId:        u.site_id         ?? u.siteId        ?? o.siteId ?? '',
    siteName:      u.site_name       ?? u.siteName      ?? '',
    studyId:       u.study_id        ?? u.studyId       ?? o.studyId ?? '',
    environment:   u.environment     ?? o.environment   ?? '',
    roleId:        u.role_id         ?? u.roleId        ?? o.roleId ?? '',
    roleName:      u.role_name       ?? u.roleName      ?? o.roleName ?? '',
    description:   u.description     ?? o.description   ?? '',
    isSystemRole:  u.is_system_role  ?? u.isSystemRole  ?? o.isSystemRole ?? false,
    scope:         u.scope           ?? o.scope         ?? 'site',
    model:         u.model           ?? o.model         ?? 'tree',
    permissions:   u.permissions     ?? o.permissions   ?? null,
  };

  safeWrite(USER_KEY, JSON.stringify(user));
  return user;
}

export function getSiteAccessToken()  { return safeRead(TOKEN_KEY); }
export function getSiteRefreshToken() { return safeRead(REFRESH_KEY); }
export function getSiteAuthUser() {
  try {
    const raw = safeRead(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** True when a site-scope session is active. */
export function isSiteSession() {
  return !!safeRead(TOKEN_KEY) || !!safeRead(USER_KEY);
}

/** Drop site-scope session — does not touch CRO or sponsor scopes. */
export function clearSiteSession() {
  safeRemove(TOKEN_KEY);
  safeRemove(REFRESH_KEY);
  safeRemove(USER_KEY);
}
