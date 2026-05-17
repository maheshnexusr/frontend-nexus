/**
 * applyPermissions — single entry point that takes the unified
 * `/api/v1/profile/me/permissions` response and writes it into the
 * appropriate scope's store, so the sidebar gates light up.
 *
 * Scope routing:
 *   • scope === 'cro'       → Redux auth.permissions (flat dot-notation) +
 *                             auth.user.assignedStudies for per-study lookup
 *   • scope === 'sponsor'   → localStorage.sponsorAuthUser (tree)
 *   • scope === 'site'      → localStorage.siteAuthUser    (tree, via authStore)
 *
 * Always safe to call multiple times — overwrites the destination store.
 */

import store from '@/app/store';
import { setRolePermissions, clearCroPermissions } from '@/features/auth/authSlice';
import { mergeSiteStudyContext } from '@/features/site/authStore';

function writeSponsorAuthUser(payload) {
  try {
    const existing = JSON.parse(localStorage.getItem('sponsorAuthUser') ?? 'null') ?? {};
    const merged = {
      ...existing,
      roleId:        payload.roleId        || existing.roleId,
      roleName:      payload.roleName      || existing.roleName,
      isSystemRole:  payload.isSystemRole ?? existing.isSystemRole ?? false,
      scope:         payload.scope         || 'sponsor',
      model:         payload.model         || 'tree',
      permissions:   payload.permissions   || existing.permissions || null,
      studyId:       payload.studyId       || existing.studyId,
      siteId:        payload.siteId        || existing.siteId,
      environment:   payload.environment   || existing.environment,
    };
    localStorage.setItem('sponsorAuthUser', JSON.stringify(merged));
  } catch { /* ignore quota / parse errors */ }
}

/**
 * Apply a normalized permissions response to the right scope's store.
 * @param {ReturnType<typeof normalizePermissionsResponse>} payload
 */
export function applyPermissions(payload) {
  if (!payload) return;

  const scope = (payload.scope ?? '').toLowerCase();

  if (scope === 'site') {
    // Site scope — permissions are study-scoped and owned by
    // POST /site/studies/choose, which writes siteStudyContext. Here we just
    // merge a refreshed permission tree into that context; tokens and the
    // session/user record stay untouched.
    mergeSiteStudyContext({
      roleId:       payload.roleId,
      roleName:     payload.roleName,
      permissions:  payload.permissions,
      studyId:      payload.studyId,
      siteId:       payload.siteId,
      environment:  payload.environment,
    });
    // Site user — wipe any stray CRO permissions so the CRO sidebar shows
    // nothing if they ever wander onto /cro/*.
    store.dispatch(clearCroPermissions());
    return;
  }

  if (scope === 'sponsor') {
    writeSponsorAuthUser(payload);
    // Sponsor user — same cleanup as above.
    store.dispatch(clearCroPermissions());
    return;
  }

  if (scope === 'cro') {
    // CRO scope — fold both the flat menu permissions AND the per-study
    // assignments into the Redux auth slice.
    store.dispatch(setRolePermissions({
      permissions:     payload.permissions,
      assignedStudies: payload.assignedStudies,
    }));
    return;
  }

  // Unknown scope — log so we notice
  // eslint-disable-next-line no-console
  console.warn('[applyPermissions] unknown scope in response:', payload.scope, payload);
}
