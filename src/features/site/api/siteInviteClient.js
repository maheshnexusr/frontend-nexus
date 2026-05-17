/**
 * siteInviteClient — public endpoints for the site-personnel activation page,
 * hit from the invitation email link (/site/activate?token=...).
 *
 *   GET  /api/v1/site/invite/verify?token=...
 *        → { success, valid, email, fullName, studies: [ ...study cards ] }
 *
 *   POST /api/v1/site/invite/activate  { token, password }
 *        → { success, accessToken, refreshToken, scope, user, studies }
 *
 * Activation now sets the password on the ONE master_site_users identity and
 * returns a study-agnostic session — the same shape as login. After activating
 * the UI goes to the study picker (it does not drop straight into a study).
 *
 * Errors: 404 → not found / already used, 410 → expired / already active.
 */

import siteAxiosClient from '@/api/siteAxiosClient';
import { setSiteSession } from '../authStore';

const BASE = '/api/v1/site/invite';

function normalizeVerify(raw) {
  const o = raw?.item ?? raw?.data ?? raw ?? {};
  return {
    valid:        o.valid ?? true,
    fullName:     o.full_name ?? o.fullName ?? '',
    emailAddress: o.email ?? o.email_address ?? o.emailAddress ?? '',
    // Studies the person has already been assigned to (shown as context on
    // the set-password screen). Each is a study card from siteStudyService.
    studies:      Array.isArray(o.studies) ? o.studies : [],
    message:      o.message ?? '',
  };
}

export const siteInviteClient = {
  /** Validate the activation token (on mount of the activation page). */
  async verify(token) {
    const res = await siteAxiosClient.get(`${BASE}/verify`, { params: { token } });
    return normalizeVerify(res);
  },

  /**
   * Set the password, activate the master account, and start a session.
   * Persists the session via setSiteSession; returns { user, studies }.
   */
  async activate({ token, password }) {
    const res = await siteAxiosClient.post(`${BASE}/activate`, { token, password });
    setSiteSession(res);
    return {
      user:    res.user ?? null,
      studies: Array.isArray(res.studies) ? res.studies : [],
      scope:   res.scope ?? 'site',
    };
  },
};

export default siteInviteClient;
