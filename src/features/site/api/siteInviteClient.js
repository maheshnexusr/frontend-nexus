/**
 * siteInviteClient — public endpoints used by the PI activation page.
 *
 * Both endpoints are unauthenticated; they're hit from /site/invite/:token
 * (the link in the invitation email).
 *
 *   GET  /api/v1/site/invite/verify?token=...
 *        → { success, valid, email, fullName, siteName, roleName, studyId,
 *            environment, siteId }
 *
 *   POST /api/v1/site/invite/activate
 *        body: { token, password }
 *        → { success, accessToken, refreshToken, user: { personnelId,
 *            fullName, emailAddress, siteId, siteName, studyId,
 *            environment, roleId, roleName } }
 *
 * Errors: 404 → invitation not found, 410 → expired / already used.
 */

import axiosClient from '@/api/axiosClient';

const BASE = '/api/v1/site/invite';

function normalizeVerify(raw) {
  const o = raw?.item ?? raw?.data ?? raw ?? {};
  return {
    valid:        o.valid ?? true,
    siteName:     o.site_name     ?? o.siteName     ?? '',
    siteId:       o.site_id       ?? o.siteId       ?? '',
    studyTitle:   o.study_title   ?? o.studyTitle   ?? '',
    studyId:      o.study_id      ?? o.studyId      ?? '',
    environment:  o.environment   ?? '',
    fullName:     o.full_name     ?? o.fullName     ?? '',
    // Backend returns `email`; older shapes used `email_address`.
    emailAddress: o.email         ?? o.email_address ?? o.emailAddress ?? '',
    role:         o.role_name     ?? o.roleName     ?? o.role          ?? '',
    expiresAt:    o.expires_at    ?? o.expiresAt    ?? null,
    message:      o.message       ?? '',
  };
}

function normalizeActivate(raw) {
  const o = raw?.item ?? raw?.data ?? raw ?? {};
  // Backend may return user fields either nested under `user` OR flat at the
  // top of the response (the newer scope-tagged shape with `scope: "site"`
  // and `model: "tree"`). Pick whichever has data.
  const u = (o.user && typeof o.user === 'object') ? o.user : o;

  const user = {
    personnelId:  u.personnel_id   ?? u.personnelId   ?? u.id ?? '',
    fullName:     u.full_name      ?? u.fullName      ?? '',
    emailAddress: u.email_address  ?? u.emailAddress  ?? u.email ?? '',
    siteId:       u.site_id        ?? u.siteId        ?? '',
    siteName:     u.site_name      ?? u.siteName      ?? '',
    studyId:      u.study_id       ?? u.studyId       ?? '',
    environment:  u.environment    ?? '',
    roleId:       u.role_id        ?? u.roleId        ?? '',
    roleName:     u.role_name      ?? u.roleName      ?? '',
    description:  u.description    ?? '',
    isSystemRole: u.is_system_role ?? u.isSystemRole  ?? false,
    scope:        u.scope          ?? o.scope         ?? 'site',
    model:        u.model          ?? o.model         ?? 'tree',
    // Tree-shape permissions: { [leafKey]: { view, create, edit, ... } }
    // Drives the sponsor sidebar gating via useSiteRolePermissions.
    permissions:  u.permissions    ?? o.permissions   ?? null,
  };

  // If nothing user-shaped came back, drop the wrapper so callers know.
  const haveAny =
       !!user.personnelId
    || !!user.fullName
    || !!user.emailAddress
    || !!user.roleId
    || !!user.studyId
    || !!user.permissions;

  return {
    accessToken:  o.access_token  ?? o.accessToken  ?? null,
    refreshToken: o.refresh_token ?? o.refreshToken ?? null,
    user:         haveAny ? user : null,
    siteId:       user.siteId,
    studyId:      user.studyId,
    environment:  user.environment,
  };
}

export const siteInviteClient = {
  /** Validate the token (used on mount of the activation page). */
  async verify(token) {
    const res = await axiosClient.get(`${BASE}/verify`, { params: { token } });
    return normalizeVerify(res);
  },

  /** Set a password + flip status to Active; returns a site-personnel JWT. */
  async activate({ token, password }) {
    const res = await axiosClient.post(`${BASE}/activate`, { token, password });
    return normalizeActivate(res);
  },
};
