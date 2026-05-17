/**
 * getRoleRedirect — returns the post-login destination path.
 *
 * Logic (token-scope first to prevent redirect loops):
 *
 *   1. siteAccessToken exists                        → site scope
 *      Always → /site/dashboard. SiteLayout reads siteStudyContext and:
 *        - no chosen study → redirects to /site/studies (picker)
 *        - chosen study    → renders the dashboard inside the site shell
 *      Site users do NOT enter the sponsor workspace shell — they have
 *      their own SiteLayout with a permission-gated sidebar.
 *
 *   2. sponsorAccessToken or sponsorViewToken exists → sponsor scope
 *      • with user.studyId → /sponsor/:studyId/dashboard
 *      • otherwise → /sponsor/select-study
 *
 *   3. CRO accessToken only                          → /cro/dashboard
 *      Site personnel never reach here: the shared /signin page dispatches
 *      by auth_identities, and a `scope: 'site'` response is persisted into
 *      site-scope storage (siteAccessToken) by loginAsync — so they match
 *      rule 1, not this one.
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
  // 1. Site auth scope — always land in SiteLayout's dashboard. The layout
  //    itself bounces to /site/studies if no study has been chosen yet.
  if (hasSiteToken()) return '/site/dashboard';

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
