/**
 * sponsorViewTokenStore.js
 *
 * Token + metadata storage for the CRO "view sponsor workspace as read-only"
 * flow. This is a THIRD scope, separate from:
 *   - CRO session       (accessToken / refreshToken)
 *   - Sponsor login     (sponsorAccessToken / sponsorRefreshToken)
 *
 * Issued by POST /api/v1/workspace/sponsors/:sponsorId/enter and consumed by
 * sponsorAxiosClient when a /api/v1/sponsor/* call is made and the user is in
 * read-only viewer mode.
 *
 * Clearing this store does NOT touch the CRO session.
 */

const TOKEN_KEY = 'sponsorViewToken';
const META_KEY  = 'sponsorViewMeta';   // { sponsor, user, studies, isReadOnly }
const FLASH_KEY = 'sponsorViewFlash';  // one-shot message after eviction

export const sponsorViewTokenStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),

  setSession: ({ accessToken, sponsor, user, studies }) => {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(META_KEY, JSON.stringify({
      sponsor:    sponsor    ?? null,
      user:       user       ?? null,
      studies:    studies    ?? [],
      isReadOnly: true,
    }));
  },

  getMeta: () => {
    try { return JSON.parse(localStorage.getItem(META_KEY) ?? 'null'); }
    catch { return null; }
  },

  isActive: () => !!localStorage.getItem(TOKEN_KEY),

  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(META_KEY);
  },

  setFlash: (message) => {
    if (message) localStorage.setItem(FLASH_KEY, message);
  },
  consumeFlash: () => {
    const msg = localStorage.getItem(FLASH_KEY);
    if (msg) localStorage.removeItem(FLASH_KEY);
    return msg;
  },
};
