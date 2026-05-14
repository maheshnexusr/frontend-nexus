/**
 * getRoleRedirect — returns the post-login destination path.
 *
 * Logic (token-scope first to prevent redirect loops):
 *
 *   1. siteAccessToken exists                        → site scope
 *      • with user.studyId → /sponsor/:studyId/dashboard
 *        (lands inside the sponsor workspace shell; sidebar gated by the
 *         user's role permissions in SponsorLayout)
 *      • otherwise → /site/dashboard
 *
 *   2. sponsorAccessToken or sponsorViewToken exists → sponsor scope
 *      • with user.studyId → /sponsor/:studyId/dashboard
 *      • otherwise → /sponsor/select-study
 *
 *   3. CRO accessToken only                          → /cro/dashboard
 *      Even when the role name looks like site personnel (e.g. Principal
 *      Investigator), we cannot enter sponsor routes without a sponsor-
 *      or site-scope token, so route to the matching CRO surface. Site
 *      personnel should sign in at the dedicated site sign-in
 *      (POST /api/v1/site/auth/login) once that's wired.
 *
 *   4. No token / unknown user                       → /signin
 *
 * @param {object|null|undefined} user
 * @returns {string}
 */

function readToken(key) {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); }
  catch { return null; }
}

const hasSiteToken    = () => !!readToken('siteAccessToken');
const hasSponsorToken = () => !!readToken('sponsorAccessToken') || !!readToken('sponsorViewToken');
const hasCroToken     = () => !!readToken('accessToken');

export function getRoleRedirect(user) {
  // 1. Site auth scope (activation flow or /api/v1/site/auth/login)
  if (hasSiteToken()) {
    if (user?.studyId) return `/sponsor/${user.studyId}/dashboard`;
    return '/site/dashboard';
  }

  // 2. Sponsor auth scope (direct sponsor login or CRO viewer entered)
  if (hasSponsorToken()) {
    if (user?.studyId) return `/sponsor/${user.studyId}/dashboard`;
    return '/sponsor/select-study';
  }

  // 3. CRO scope only — never redirect to sponsor routes without the token.
  if (hasCroToken()) return '/cro/dashboard';

  // 4. No tokens at all
  return '/signin';
}

/** True if the active scope should land in the sponsor workspace shell. */
export function isSponsorRole() {
  return hasSiteToken() || hasSponsorToken();
}
