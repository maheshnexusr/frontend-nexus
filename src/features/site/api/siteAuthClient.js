/**
 * siteAuthClient — study-agnostic authentication for site personnel.
 *
 *   POST /api/v1/site/auth/login    { email_address, password }
 *        → { success, accessToken, refreshToken, scope, user, studies }
 *   POST /api/v1/site/auth/refresh  { refresh_token } → { accessToken }
 *   POST /api/v1/site/auth/logout   { refresh_token }
 *   GET  /api/v1/site/auth/me       → { user: { ...,  studies } }
 *
 * Login no longer takes study_id / environment — a site person is one
 * identity. The `studies` array drives the post-login study picker; switching
 * studies is done via siteStudyClient.choose(), not by logging in again.
 */

import siteAxiosClient from '@/api/siteAxiosClient';
import {
  setSiteSession,
  getSiteRefreshToken,
  clearSiteSession,
  setSiteStudies,
} from '../authStore';

const BASE = '/api/v1/site/auth';

export const siteAuthClient = {
  /** Study-agnostic sign-in. Persists the session + caches the picker list. */
  async login({ emailAddress, password }) {
    const res = await siteAxiosClient.post(`${BASE}/login`, {
      email_address: emailAddress,
      password,
    });
    setSiteSession(res);
    return {
      user:    res.user ?? null,
      studies: Array.isArray(res.studies) ? res.studies : [],
      scope:   res.scope ?? 'site',
    };
  },

  /** Sign out — revokes the refresh token server-side, clears all site keys. */
  async logout() {
    const refreshToken = getSiteRefreshToken();
    try {
      if (refreshToken) {
        await siteAxiosClient.post(`${BASE}/logout`, { refresh_token: refreshToken });
      }
    } finally {
      clearSiteSession();
    }
  },

  /** Current identity + a fresh assigned-studies list. Refreshes the cache. */
  async me() {
    const res = await siteAxiosClient.get(`${BASE}/me`);
    const user = res.user ?? res;
    if (Array.isArray(user?.studies)) setSiteStudies(user.studies);
    return user;
  },
};

export default siteAuthClient;
