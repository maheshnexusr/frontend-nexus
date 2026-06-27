import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService }        from '@/services/authService';
import { sponsorAuthService, sponsorTokenStore } from '@/services/sponsorAuthService';
import { siteAuthClient } from '@/features/site/api/siteAuthClient';
import { profileService }     from '@/services/profileService';
// profileClient — scope-aware variant of profileService that picks the right
// Bearer token (sponsorView > sponsor > site > CRO). Use this in any login
// branch that has NOT yet written the CRO `accessToken` slot — e.g. a
// sponsor login, where the CRO-bound `profileService` call would 401 with
// "Authentication required" because no CRO token is set.
import { profileClient }      from '@/api/profileClient';
import { setSiteSession }     from '@/features/site/authStore';
import { PERMISSION_GROUPS }  from '@/features/cro/constants/permissionsSchema';
import axiosClient            from '@/api/axiosClient';

// Debug helper — `window.authDebug()` from the DevTools console dumps the
// auth state the app is currently operating on. Used to diagnose menu /
// permissions mismatches without making the user remember localStorage keys.
if (typeof window !== 'undefined') {
  window.authDebug = function authDebug() {
    const parse = (k) => {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); }
      catch { return localStorage.getItem(k); }
    };
    const out = {
      path:            window.location.pathname,
      accessToken:     localStorage.getItem('accessToken') ? '(present)' : '(missing)',
      authPermissions: parse('authPermissions'),
      authPermissionsTree: parse('authPermissionsTree'),
      authUser:        parse('authUser'),
    };
    // Group + table so it's readable in the console
    console.group('%c[authDebug]', 'color:#7c3aed;font-weight:bold');
    console.log('path:                ', out.path);
    console.log('accessToken:         ', out.accessToken);
    console.log('authPermissions:     ', out.authPermissions);
    console.log('authPermissionsTree: ', out.authPermissionsTree);
    console.log('authUser:            ', out.authUser);
    console.log('assignedStudies:     ', out.authUser?.assignedStudies);
    console.groupEnd();
    return out;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} fullName
 * @property {string} email
 * @property {string} role
 * @property {string|null} photograph
 * @property {string|null} contactNumber
 */

/**
 * @typedef {Object} GeoInfo
 * @property {string} ip
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} city
 */

/**
 * @typedef {Object} AuthState
 * @property {AuthUser|null} user
 * @property {string|null} accessToken
 * @property {string|null} refreshToken
 * @property {string[]} permissions
 * @property {boolean} isAuthenticated
 * @property {'idle'|'loading'|'succeeded'|'failed'} status
 * @property {string|null} error
 * @property {GeoInfo|null} geoInfo
 */

/** @type {AuthState} */
const _storedUser = (() => {
  try { return JSON.parse(localStorage.getItem('authUser')); } catch { return null; }
})();
const _storedPerms = (() => {
  try { return JSON.parse(localStorage.getItem('authPermissions')) ?? []; } catch { return []; }
})();

const _storedPermTree = (() => {
  try { return JSON.parse(localStorage.getItem('authPermissionsTree')) ?? null; } catch { return null; }
})();

// Sponsor and site sessions persist their user blob under separate keys
// (`sponsorAuthUser` / `siteAuthUser`) with workspace-specific field names.
// Read them too so `state.auth.user` survives a hard refresh in those scopes
// instead of going back to `null` until the next mutation.
const _storedSponsorUser = (() => {
  try { return JSON.parse(localStorage.getItem('sponsorAuthUser')) ?? null; } catch { return null; }
})();
const _storedSiteUser = (() => {
  try { return JSON.parse(localStorage.getItem('siteAuthUser')) ?? null; } catch { return null; }
})();
const _storedSiteContext = (() => {
  try { return JSON.parse(localStorage.getItem('siteStudyContext')) ?? null; } catch { return null; }
})();
const _storedSponsorContext = (() => {
  try { return JSON.parse(localStorage.getItem('sponsorStudyContext')) ?? null; } catch { return null; }
})();

/* Normalize a scope-specific user object to the shared shape consumers expect
   from `selectCurrentUser`. Different scopes store different field names
   (site uses `siteUserId`/`emailAddress`; sponsor varies by provider). We map
   them all to `{ id, email, fullName, username, role, photograph, ...raw }` so
   `currentUser?.id` / `.email` etc. work everywhere. The raw fields are kept
   too for backwards compatibility. Named `_hydrateUserShape` to avoid clashing
   with the richer `normalizeUser()` below that handles CRO login responses
   end-to-end (this one is only used at slice init for rehydration). */
function _hydrateUserShape(raw, scope) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    id:        raw.id        ?? raw.userId      ?? raw.siteUserId   ?? raw.sponsorUserId ?? raw.user_id ?? null,
    email:     raw.email     ?? raw.emailAddress ?? raw.email_address ?? null,
    fullName:  raw.fullName  ?? raw.full_name   ?? raw.name          ?? null,
    username:  raw.username  ?? raw.userName    ?? raw.user_name     ?? null,
    role:      raw.role      ?? raw.role_name   ?? raw.roleName      ?? null,
    photograph:raw.photograph?? raw.photo       ?? raw.avatar        ?? null,
    scope,
  };
}

// Scope-aware hydration: if a sponsor or site session is active in localStorage
// but the CRO `accessToken` is ALSO present, the CRO blob is almost certainly
// stale from a prior sign-in that was never explicitly logged out. Drop the CRO
// hydration so the CRO sidebar doesn't render with the previous user's tree
// while the current session belongs to a different scope.
const _hasCroAccess     = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
const _hasSponsorAccess = typeof window !== 'undefined' && !!localStorage.getItem('sponsorAccessToken');
const _hasSiteAccess    = typeof window !== 'undefined' && !!localStorage.getItem('siteAccessToken');
const _croScopeIsActive     = _hasCroAccess     && !_hasSponsorAccess && !_hasSiteAccess;
const _sponsorScopeIsActive = _hasSponsorAccess && !_hasSiteAccess; // sponsor wins over CRO when both present
const _siteScopeIsActive    = _hasSiteAccess;                       // site wins over both

if (typeof window !== 'undefined' && !_croScopeIsActive) {
  // Best-effort wipe — keeps siteAuthUser / sponsorAuthUser intact (those
  // belong to their own scopes), but removes anything the CRO scope reads on
  // boot so we never render the previous CRO menu while a different scope owns
  // the live session.
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('authPermissions');
    localStorage.removeItem('authPermissionsTree');
  } catch { /* ignore quota errors */ }
}

// Pick whichever scope owns the live session and hydrate Redux from its
// localStorage slots. Without this, sponsor/site sessions would land on a
// blank `state.auth.user` after a hard refresh until the next API call
// repopulates it, breaking anything that reads `currentUser` synchronously
// (e.g. "My Queries" toggle, header avatar, role-driven view checks).
const _hydratedScope = _siteScopeIsActive
  ? 'site'
  : _sponsorScopeIsActive
    ? 'sponsor'
    : _croScopeIsActive
      ? 'cro'
      : null;

const _hydratedUser =
  _hydratedScope === 'site'    ? _hydrateUserShape(_storedSiteUser,    'site')
  : _hydratedScope === 'sponsor' ? _hydrateUserShape(_storedSponsorUser, 'sponsor')
  : _hydratedScope === 'cro'    ? _hydrateUserShape(_storedUser,        'cro')
  : null;

// Permissions tree by scope. Site session uses the per-study tree inside
// siteStudyContext (study-scoped) and falls back to user.permissions; sponsor
// uses sponsorStudyContext.permissions; CRO uses the persisted flat blob.
const _hydratedPermTree =
  _hydratedScope === 'site'    ? (_storedSiteContext?.permissions ?? _storedSiteUser?.permissions ?? null)
  : _hydratedScope === 'sponsor' ? (_storedSponsorContext?.permissions ?? _storedSponsorUser?.permissions ?? null)
  : _hydratedScope === 'cro'    ? _storedPermTree
  : null;

// Flat permissions array — only meaningful for the CRO sidebar's `Array.includes`
// checks. Sponsor/site sidebars read the tree directly, so leaving this empty
// for non-CRO scopes is correct.
const _hydratedPerms = _hydratedScope === 'cro' ? _storedPerms : [];

const _hydratedAccessToken =
  _hydratedScope === 'site'    ? (localStorage.getItem('siteAccessToken')    || null)
  : _hydratedScope === 'sponsor' ? (localStorage.getItem('sponsorAccessToken') || null)
  : _hydratedScope === 'cro'    ? (localStorage.getItem('accessToken')        || null)
  : null;

const initialState = {
  user:            _hydratedUser,
  accessToken:     _hydratedAccessToken,
  refreshToken:    _croScopeIsActive ? (localStorage.getItem('refreshToken') || null) : null,
  permissions:     _hydratedPerms,
  permissionsTree: _hydratedPermTree,
  isAuthenticated: Boolean(_hydratedUser && _hydratedAccessToken),
  status:          'idle',
  error:           null,
  geoInfo:         null,
};

// Centralised cross-scope cleanup. Called at the start of every login thunk's
// `fulfilled` handler so a prior session's tokens / user / permission tree can
// never shadow the freshly-minted one. The `keep` argument names the scope
// whose keys should be PRESERVED ('cro' | 'sponsor' | 'site'); everything else
// is dropped.
function clearOtherScopeStorage(keep) {
  const CRO     = ['accessToken', 'refreshToken', 'authUser', 'authPermissions', 'authPermissionsTree'];
  const SPONSOR = ['sponsorAccessToken', 'sponsorRefreshToken', 'sponsorAuthUser',
                   'sponsorStudyContext', 'sponsorViewToken', 'sponsorViewMeta', 'sponsorViewFlash'];
  const SITE    = ['siteAccessToken', 'siteRefreshToken', 'siteWorkspaceToken',
                   'siteAuthUser', 'siteStudies', 'siteStudyContext'];
  const groups = { cro: CRO, sponsor: SPONSOR, site: SITE };
  for (const [scope, keys] of Object.entries(groups)) {
    if (scope === keep) continue;
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Async thunks
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/v1/auth/activate */
export const activateAccountAsync = createAsyncThunk(
  'auth/activateAccount',
  async (payload, { rejectWithValue }) => {
    try {
      return await authService.activate(payload);
    } catch (err) {
      return rejectWithValue(err.message ?? 'Account activation failed.');
    }
  },
);

/** True when the login response user is a sponsor role. Sponsor users don't
 *  need CRO permissions — their sidebar is driven by study scope + config.
 *
 *  Backend signals (in priority order):
 *    1. `is_sponsor` / `isSponsor` flag — authoritative for both direct
 *       sponsor logins and sponsor-role CRO logins (set by loginCroUserWithPassword
 *       and sponsorAuthService.loginWithPassword).
 *    2. `scope === 'sponsor'` — set by the direct sponsor provider path.
 *    3. role_name substring — legacy fallback for older responses. Not
 *       reliable on its own because custom sponsor roles like "Verification
 *       Manager" don't contain the word "sponsor". */
const loginResIsSponsor = (loginRes) => {
  if (loginRes?.is_sponsor === true || loginRes?.isSponsor === true) return true;
  if (loginRes?.scope === 'sponsor') return true;
  if (loginRes?.user?.is_sponsor === true || loginRes?.user?.isSponsor === true) return true;
  const roleName = (
    loginRes?.user?.role_name ?? loginRes?.user?.roleName ?? ''
  ).toLowerCase();
  return roleName.includes('sponsor');
};

/**
 * Extract `{ accessToken, refreshToken, user }` from a login response,
 * tolerating multiple possible wrapper shapes:
 *
 *   { access_token, refresh_token, user }
 *   { accessToken, refreshToken, user }
 *   { item: { … }  }
 *   { data: { … }  }
 *   { tokens: { access, refresh }, user }
 *
 * Backend has been observed to switch between these. We accept all of
 * them to avoid silently dropping the token (which then never makes it
 * onto the Authorization header for downstream requests, surfacing as
 * "token not sending").
 */
/* Field names we recognise for access / refresh tokens, in priority order.
   Add more here if the backend ever returns a new variant. */
const ACCESS_KEYS  = ['accessToken', 'access_token', 'token', 'access', 'jwt', 'id_token', 'idToken', 'auth_token', 'authToken', 'bearer'];
const REFRESH_KEYS = ['refreshToken', 'refresh_token', 'refresh', 'refresh_jwt', 'refreshJwt'];

/** Walk an arbitrary JSON tree (BFS, depth ≤ 4) for the first string value
 *  whose key matches one of `keys`. Used when the backend nests the tokens
 *  inside a wrapper we don't otherwise recognise. */
function deepFind(root, keys) {
  if (!root || typeof root !== 'object') return null;
  const queue = [[root, 0]];
  while (queue.length) {
    const [node, depth] = queue.shift();
    if (!node || typeof node !== 'object' || depth > 4) continue;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (keys.includes(k) && typeof v === 'string' && v.length > 10) return v;
      if (v && typeof v === 'object') queue.push([v, depth + 1]);
    }
  }
  return null;
}

function extractAuthTokens(loginRes) {
  // 1) Quick win — check the common wrappers at the top level first.
  const candidates = [
    loginRes,
    loginRes?.item,
    loginRes?.data,
    loginRes?.result,
    loginRes?.payload,
    loginRes?.tokens,
    loginRes?.auth,
    loginRes?.session,
    loginRes?.body,
  ].filter(Boolean);

  let accessToken  = null;
  let refreshToken = null;
  let user         = loginRes?.user ?? null;

  for (const c of candidates) {
    for (const k of ACCESS_KEYS)  { if (!accessToken  && typeof c[k] === 'string' && c[k].length > 10) accessToken  = c[k]; }
    for (const k of REFRESH_KEYS) { if (!refreshToken && typeof c[k] === 'string' && c[k].length > 10) refreshToken = c[k]; }
    user = user || c.user || null;
    if (accessToken && refreshToken && user) break;
  }

  // 2) Still missing? Walk the entire response tree as a last resort.
  if (!accessToken)  accessToken  = deepFind(loginRes, ACCESS_KEYS);
  if (!refreshToken) refreshToken = deepFind(loginRes, REFRESH_KEYS);

  // 3) Dump the actual response shape so we can see what's really there.
  //    This fires once per login and is bounded to a single console line.
  if (!accessToken && typeof console !== 'undefined') {
    try {
      // Trim long values so we don't spam the console.
      const safe = JSON.parse(JSON.stringify(loginRes, (_, v) =>
        typeof v === 'string' && v.length > 80 ? `${v.slice(0, 40)}…(${v.length})` : v
      ));
      console.warn('[auth] login response shape (no access token found):', safe);
    } catch {
      console.warn('[auth] login response (raw):', loginRes);
    }
  }

  return { accessToken, refreshToken, user };
}

/** POST /api/v1/auth/login/password
 *
 *  The backend serves both CRO and sponsor scopes from this single endpoint.
 *  We detect the scope from the response's role and, for sponsor users, also
 *  mirror the tokens into sponsor-scope localStorage so sponsorAxiosClient
 *  can attach them to /sponsor/** requests. Sponsor users skip the CRO
 *  permissions fetch — their menu is driven by study scope + config. */
export const loginAsync = createAsyncThunk(
  'auth/login',
  async ({ emailAddress, password }, { rejectWithValue }) => {
    try {
      const loginRes = await authService.login({ emailAddress, password });

      // Site personnel — study-agnostic identity, separate scope. The backend
      // dispatched this via auth_identities. Persist into site-scope storage
      // only; do NOT touch the CRO accessToken or fetch CRO permissions.
      if (loginRes?.scope === 'site') {
        setSiteSession(loginRes);
        return { scope: 'site', user: loginRes.user };
      }

      // Multi-identity case — backend returns
      //   { success: true, requires_choice: true, choice_token: "...", identities: [...] }
      // when the same email + password unlocks more than one identity (e.g.
      // CRO + Site under the same email/password). NO access token is issued
      // at this step. The UI must render an identity picker and then call
      // `chooseIdentityAsync({ choiceToken, identityId })` which hits the
      // dedicated /auth/login/choose-identity endpoint and mints the real
      // session. The choice_token is short-lived (~2 min) — if the user
      // dawdles, choose-identity returns 401 and they go back to /signin.
      if (loginRes?.requires_choice || loginRes?.requiresChoice) {
        return {
          requiresChoice: true,
          choiceToken:    loginRes.choice_token ?? loginRes.choiceToken ?? null,
          identities:     loginRes.identities ?? loginRes.identity_options ?? [],
        };
      }

      // MFA-enabled account — backend emailed a 6-digit code and returned a
      // challenge token instead of a session. No tokens are issued at this
      // step; the UI renders the MFA code-entry view and then calls
      // verifyMfaAsync({ mfaToken, code }) to complete the sign-in.
      if (loginRes?.mfa_required || loginRes?.mfaRequired) {
        return {
          mfaRequired: true,
          mfaToken:    loginRes.mfa_token ?? loginRes.mfaToken ?? null,
          email:       loginRes.email ?? emailAddress,
        };
      }

      // Save tokens immediately so the next request has Authorization header.
      // Handles multiple backend wrapper shapes (item / data / tokens / …).
      const { accessToken, refreshToken } = extractAuthTokens(loginRes);

      // Surface the flat tokens on the returned object so downstream slices
      // and `sponsorTokenStore.saveTokens` see them at predictable keys.
      const flatRes = { ...loginRes, accessToken, refreshToken };
      const isSponsorScope = loginResIsSponsor(flatRes);

      // Wipe every OTHER scope's storage before writing the new session. Without
      // this, a stale CRO `accessToken` + `authPermissionsTree` from a previous
      // sign-in stays in localStorage, and CROLayout filters its sidebar against
      // the leftover sponsor tree (whose leaves overlap with CRO menu keys like
      // `studies`, `dashboard`) — so the CRO menu lights up after a sponsor login.
      clearOtherScopeStorage(isSponsorScope ? 'sponsor' : 'cro');

      // Only persist into the CRO `accessToken` slot when the session actually
      // belongs to the CRO scope. Sponsor tokens go through sponsorTokenStore
      // below — writing them to the CRO key was the bug that let a sponsor
      // user pass the CRO ProtectedRoute / load CROLayout on direct navigation.
      if (!isSponsorScope) {
        if (accessToken)  localStorage.setItem('accessToken',  accessToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      }

      if (isSponsorScope) {
        sponsorTokenStore.saveTokens(flatRes);
        if (flatRes.user) sponsorTokenStore.saveUser(flatRes.user);

        // Fetch the sponsor user's permission tree the same way CRO does.
        // Without this, the sponsor menu has no per-user gating to apply —
        // useSiteRolePermissions returns null (= unrestricted) and every
        // route's authorization middleware rejects the request because
        // it sees an empty permission set on the user.
        //
        // The token saved at the top of this thunk is picked up by the
        // request interceptor. If the endpoint doesn't accept the sponsor
        // token shape, we degrade cleanly (sponsor menu stays unrestricted).
        //
        // `scope: 'sponsor'` is set on the payload so loginAsync.fulfilled
        // routes through applySponsorFulfilled (which wipes stale CRO
        // permissions) instead of applyUser (which writes the sponsor's
        // permission tree into the CRO `authPermissionsTree` slot — the
        // exact bug that surfaced the previous CRO menu after sponsor login).
        try {
          // Use the scope-aware profileClient — it picks the sponsor token
          // from localStorage. profileService uses the CRO-only axios which
          // would 401 here because we deliberately don't write the CRO
          // `accessToken` slot for sponsor logins.
          const permRes = await profileClient.fetchMyPermissions();
          const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
          return {
            ...flatRes,
            scope: 'sponsor',
            permissions: perms,
            ...(permRes?.user ? { user: { ...(flatRes.user ?? {}), ...permRes.user } } : {}),
          };
        } catch {
          return { ...flatRes, scope: 'sponsor' };
        }
      }

      // Fire /profile/me/permissions immediately after login. The token
      // saved above is picked up by the request interceptor. If the
      // extractor failed to find a token (extractor logs a warning), the
      // call will 401 with "Authentication required." — the response
      // interceptor branches on that message and surfaces the rejection
      // gracefully, so this still degrades cleanly.
      //
      // /profile/me/permissions returns MORE than just `permissions`:
      // it also carries `assignedStudies` (CRO team-member's per-study
      // sponsor permission trees) and updated `user` fields. We must
      // forward those into the thunk payload so applyUser can merge them
      // — otherwise authUser.assignedStudies stays empty and the sponsor
      // workspace route guard rejects the user even though the data is
      // available on the wire.
      try {
        const permRes = await profileService.getPermissions();
        const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
        const assigned =
          permRes?.assignedStudies
          ?? permRes?.assigned_studies
          ?? permRes?.studies
          ?? null;
        return {
          ...flatRes,
          permissions: perms,
          ...(assigned ? { assignedStudies: assigned } : {}),
          // Prefer the user object from /profile/me/permissions when present —
          // it sometimes has fields (role_name, organization_id, etc.) the
          // login endpoint omits.
          ...(permRes?.user ? { user: { ...(flatRes.user ?? {}), ...permRes.user } } : {}),
        };
      } catch {
        return flatRes;
      }
    } catch (err) {
      return rejectWithValue(err.message ?? 'Sign-in failed.');
    }
  },
);

/**
 * GET /api/v1/auth/me/identities
 *
 * Returns the list of identities for the *currently authenticated user*.
 * Used by the in-app Workspace Switcher (the user already has one identity
 * active; this lists everything they could switch to).
 *
 * Falls back to [] on 404 so the UI degrades to "only one workspace
 * available" rather than crashing.
 */
export const fetchIdentitiesAsync = createAsyncThunk(
  'auth/fetchIdentities',
  async (_arg, { rejectWithValue }) => {
    try {
      const res = await axiosClient.get('/api/v1/auth/me/identities');
      const arr = Array.isArray(res) ? res : (res?.identities ?? res?.items ?? res?.data ?? []);
      return arr;
    } catch (err) {
      if (err?.response?.status === 404) return [];
      return rejectWithValue(err?.message ?? 'Failed to load workspaces.');
    }
  },
);

/**
 * Step 2 of the multi-identity login flow.
 *
 * POST /api/v1/auth/login/choose-identity
 *   body: { choice_token, identity_id }
 *
 * The choice_token was issued at Step 1 (the requires_choice response from
 * /auth/login/password). It carries the proof that the user passed the
 * password check, so this endpoint does NOT need the password again. The
 * token is short-lived (~2 minutes) — if it expires, the backend returns
 * 401 with "...selection has expired..." and the user must restart from
 * the email/password screen.
 *
 * Returns the same shape as a normal login (accessToken, refreshToken,
 * user, scope, permissions) for the chosen identity.
 *
 * Args: { identityId, choiceToken }
 */
/** Persist a minted-identity session (choose-identity / switch-identity) into
 *  the right scope's storage and return the thunk payload. Both endpoints
 *  return the same shape as a normal login. */
async function persistMintedSession(loginRes, label, rejectWithValue) {
  // MFA challenge — a picked identity may itself require MFA. No tokens yet;
  // surface the challenge so the UI can prompt for the code (verifyMfaAsync).
  if (loginRes?.mfa_required || loginRes?.mfaRequired) {
    return {
      mfaRequired: true,
      mfaToken:    loginRes.mfa_token ?? loginRes.mfaToken ?? null,
      email:       loginRes.email ?? null,
    };
  }
  // Site personnel scope — persist to site storage, not CRO. Drop CRO +
  // sponsor scope storage so a stale token from the previous workspace
  // doesn't shadow the new site session.
  if (loginRes?.scope === 'site') {
    clearOtherScopeStorage('site');
    setSiteSession(loginRes);
    return { scope: 'site', user: loginRes.user };
  }

  const { accessToken, refreshToken } = extractAuthTokens(loginRes);

  // If no token came back, the response is unusable. Reject so the UI shows
  // an error rather than silently writing nothing and bouncing to /signin.
  if (!accessToken) {
    console.warn(`[auth] ${label}: no access token in response`, loginRes);
    return rejectWithValue('No access token returned by the server. Please try again.');
  }

  const flatRes = { ...loginRes, accessToken, refreshToken };
  const isSponsorScope = loginResIsSponsor(flatRes);

  // Wipe stale tokens / permission caches from every OTHER scope. Sponsor
  // identities never use the CRO `accessToken` slot.
  clearOtherScopeStorage(isSponsorScope ? 'sponsor' : 'cro');
  if (!isSponsorScope) {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  }

  if (isSponsorScope) {
    sponsorTokenStore.saveTokens(flatRes);
    if (flatRes.user) sponsorTokenStore.saveUser(flatRes.user);

    // If the choose-identity response already includes the sponsor's
    // permission tree, use it. Otherwise fetch via /profile/me/permissions
    // so the sponsor menu has actual gating data (without this, the menu
    // falls back to "unrestricted" and the backend's per-route guards
    // reject everything). `scope: 'sponsor'` is set on the payload so the
    // reducer routes through applySponsorFulfilled and CRO state stays clean.
    if (loginRes?.permissions != null) return { ...flatRes, scope: 'sponsor' };
    try {
      // Sponsor branch — scope-aware profileClient picks the sponsor token.
      const permRes = await profileClient.fetchMyPermissions();
      const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
      return { ...flatRes, scope: 'sponsor', permissions: perms };
    } catch {
      return { ...flatRes, scope: 'sponsor' };
    }
  }

  // The response usually already carries `permissions` + `assignedStudies`
  // for the chosen identity (flatRes spreads them in). Only fall back to
  // /profile/me/permissions when `permissions` is absent.
  if (loginRes?.permissions != null) {
    return flatRes;
  }

  try {
    const permRes = await profileService.getPermissions();
    const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
    const assigned =
      permRes?.assignedStudies
      ?? permRes?.assigned_studies
      ?? permRes?.studies
      ?? null;
    return {
      ...flatRes,
      permissions: perms,
      ...(assigned ? { assignedStudies: assigned } : {}),
    };
  } catch {
    return flatRes;
  }
}

export const chooseIdentityAsync = createAsyncThunk(
  'auth/chooseIdentity',
  async ({ identityId, choiceToken }, { rejectWithValue }) => {
    try {
      const loginRes = await axiosClient.post('/api/v1/auth/login/choose-identity', {
        choice_token: choiceToken,
        identity_id:  identityId,
      });
      return await persistMintedSession(loginRes, 'choose-identity', rejectWithValue);
    } catch (err) {
      const status    = err?.status ?? err?.response?.status;
      const serverMsg = err?.response?.data?.message ?? err?.message;
      // 401 = the 2-minute choice_token genuinely expired → restart sign-in.
      if (status === 401) {
        return rejectWithValue('Your sign-in selection expired. Please sign in again.');
      }
      // 403 = an ACCESS issue, not a timeout — most often the picked identity is
      // now Inactive (role/site/personnel/CRO membership deactivated). Surface
      // the server's specific message ("You don't have access… contact your
      // administrator.") instead of the misleading "selection expired".
      if (status === 403) {
        return rejectWithValue(serverMsg || "You don't have access to this workspace. Please contact your administrator.");
      }
      return rejectWithValue(serverMsg ?? 'Failed to switch identity.');
    }
  },
);

/**
 * Finish an MFA login.
 *
 * POST /api/v1/auth/login/mfa/verify  body: { mfa_token, code }
 *
 * Returns the same shape as a normal login (accessToken/refreshToken/user/scope
 * for cro/sponsor, or a site session). Reuses persistMintedSession so the
 * resulting session is persisted into the right scope's storage.
 *
 * Args: { mfaToken, code }
 */
export const verifyMfaAsync = createAsyncThunk(
  'auth/verifyMfa',
  async ({ mfaToken, code }, { rejectWithValue }) => {
    try {
      const loginRes = await authService.verifyMfa({ mfaToken, code });
      return await persistMintedSession(loginRes, 'mfa-verify', rejectWithValue);
    } catch (err) {
      const serverMsg = err?.response?.data?.message ?? err?.message;
      return rejectWithValue(serverMsg ?? 'Verification failed. Please try again.');
    }
  },
);

/**
 * In-app workspace switch — NO password.
 *
 * POST /api/v1/auth/switch-identity   body: { identity_id }
 *
 * The caller is already authenticated; the backend authorises the switch by
 * matching the picked identity's email to the session's email, then mints the
 * target identity's session. Same response shape as a normal login.
 *
 * Args: { identityId }
 */
export const switchIdentityAsync = createAsyncThunk(
  'auth/switchIdentity',
  async ({ identityId }, { rejectWithValue }) => {
    try {
      const loginRes = await authService.switchIdentity(identityId);
      return await persistMintedSession(loginRes, 'switch-identity', rejectWithValue);
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      if (status === 401) {
        return rejectWithValue('Your session expired. Please sign in again.');
      }
      // 403 / 423 / etc. — surface the server's message; it is specific
      // ("Account is not active…", "…has been suspended.", "…locked…").
      return rejectWithValue(err?.message ?? 'Failed to switch workspace.');
    }
  },
);

/** POST /api/v1/auth/login/otp/request */
export const requestOtpAsync = createAsyncThunk(
  'auth/requestOtp',
  async ({ emailAddress }, { rejectWithValue }) => {
    try {
      return await authService.requestOtp({ emailAddress });
    } catch (err) {
      return rejectWithValue(err.message ?? 'Failed to send OTP.');
    }
  },
);

/** POST /api/v1/auth/login/otp/verify — same scope-detection as loginAsync. */
export const loginWithOtpAsync = createAsyncThunk(
  'auth/loginWithOtp',
  async ({ emailAddress, otp }, { rejectWithValue }) => {
    try {
      const loginRes = await authService.verifyOtp({ emailAddress, otp });

      // Site personnel — see loginAsync. (OTP for site is not enabled on the
      // backend yet, but guard the scope here so it routes correctly if it is.)
      if (loginRes?.scope === 'site') {
        setSiteSession(loginRes);
        return { scope: 'site', user: loginRes.user };
      }

      const { accessToken, refreshToken } = extractAuthTokens(loginRes);

      const flatRes = { ...loginRes, accessToken, refreshToken };
      const isSponsorScope = loginResIsSponsor(flatRes);

      // Same scope-segregation as loginAsync — sponsor token never lands in
      // the CRO `accessToken` slot, and the OTHER scope's leftover storage
      // gets cleared before the new session takes hold.
      clearOtherScopeStorage(isSponsorScope ? 'sponsor' : 'cro');
      if (!isSponsorScope) {
        if (accessToken)  localStorage.setItem('accessToken',  accessToken);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      }

      if (isSponsorScope) {
        sponsorTokenStore.saveTokens(flatRes);
        if (flatRes.user) sponsorTokenStore.saveUser(flatRes.user);
        try {
          // OTP login sponsor branch — same fix as the password branch.
          const permRes = await profileClient.fetchMyPermissions();
          const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
          return { ...flatRes, scope: 'sponsor', permissions: perms };
        } catch {
          return { ...flatRes, scope: 'sponsor' };
        }
      }

      try {
        const permRes = await profileService.getPermissions();
        const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
        const assigned =
          permRes?.assignedStudies
          ?? permRes?.assigned_studies
          ?? permRes?.studies
          ?? null;
        return {
          ...flatRes,
          permissions: perms,
          ...(assigned ? { assignedStudies: assigned } : {}),
        };
      } catch {
        return flatRes;
      }
    } catch (err) {
      return rejectWithValue(err.message ?? 'OTP verification failed.');
    }
  },
);

/**
 * POST /api/v1/sponsor/auth/login/password — sponsor-scope password login.
 * Persists tokens under the sponsor-scope keys via sponsorTokenStore so the
 * sponsorAxiosClient can attach them on workspace requests.
 *
 * Returns the normalized sponsor user (or null if the backend didn't include
 * one) so callers can route on role / study count.
 */
export const sponsorLoginAsync = createAsyncThunk(
  'auth/sponsorLogin',
  async ({ emailAddress, password }, { rejectWithValue }) => {
    try {
      const res = await sponsorAuthService.login({ emailAddress, password });
      // Drop CRO + site storage first — otherwise stale `accessToken` /
      // `authPermissionsTree` from a previous sign-in keep CROLayout's gates
      // alive and the sponsor user sees the prior CRO menu after sign-in.
      clearOtherScopeStorage('sponsor');
      sponsorTokenStore.saveTokens(res);
      if (res?.user) sponsorTokenStore.saveUser(res.user);
      return res;
    } catch (err) {
      return rejectWithValue(err.message ?? 'Sponsor sign-in failed.');
    }
  },
);

/** POST /api/v1/sponsor/auth/login/otp/request */
export const sponsorRequestOtpAsync = createAsyncThunk(
  'auth/sponsorRequestOtp',
  async ({ emailAddress }, { rejectWithValue }) => {
    try {
      return await sponsorAuthService.requestOtp({ emailAddress });
    } catch (err) {
      return rejectWithValue(err.message ?? 'Failed to send OTP.');
    }
  },
);

/** POST /api/v1/sponsor/auth/login/otp/verify */
export const sponsorLoginWithOtpAsync = createAsyncThunk(
  'auth/sponsorLoginWithOtp',
  async ({ emailAddress, otp }, { rejectWithValue }) => {
    try {
      const res = await sponsorAuthService.verifyOtp({ emailAddress, otp });
      clearOtherScopeStorage('sponsor');
      sponsorTokenStore.saveTokens(res);
      if (res?.user) sponsorTokenStore.saveUser(res.user);
      return res;
    } catch (err) {
      return rejectWithValue(err.message ?? 'OTP verification failed.');
    }
  },
);

/**
 * Logs the user out of whichever scopes currently hold a token (CRO, sponsor,
 * site, or any combination), then clears client state. Server calls are
 * best-effort — a failed revocation (expired token, offline) must still clear
 * the session locally.
 *
 * All three scopes call THEIR OWN /auth/logout endpoint so the server can
 * revoke the refresh token. Without the site branch, site personnel logging
 * out left their refresh token live on the server even though the FE cleared
 * the keys — and no logout audit row was written for the site scope.
 */
export const logoutAsync = createAsyncThunk(
  'auth/logoutAll',
  async (_, { dispatch }) => {
    const hasCRO     = !!localStorage.getItem('accessToken');
    const hasSponsor = !!localStorage.getItem('sponsorAccessToken');
    const hasSite    = !!localStorage.getItem('siteAccessToken');
    await Promise.allSettled([
      hasCRO     ? authService.logout()        : Promise.resolve(),
      hasSponsor ? sponsorAuthService.logout() : Promise.resolve(),
      hasSite    ? siteAuthClient.logout()     : Promise.resolve(),
    ]);
    dispatch(authSlice.actions.logout());
  },
);

/** POST /api/v1/auth/refresh */
export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const storedRefresh =
        getState().auth.refreshToken ?? localStorage.getItem('refreshToken');
      return await authService.refreshToken(storedRefresh);
    } catch (err) {
      return rejectWithValue(err.message ?? 'Session expired.');
    }
  },
);


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize raw API user object → camelCase */
function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id:            raw.user_id         ?? raw.id,
    fullName:      raw.full_name       ?? raw.fullName       ?? '',
    email:         raw.email_address   ?? raw.emailAddress   ?? raw.email ?? '',
    roleName:      raw.role_name       ?? raw.roleName       ?? '',
    roleId:        raw.role_id         ?? raw.roleId         ?? '',
    photograph:    raw.photograph_path ?? raw.photograph     ?? null,
    contactNumber: raw.contact_number  ?? raw.contactNumber  ?? '',
    isActive:      raw.is_active       ?? raw.isActive       ?? true,
    // CRO team members assigned to one or more sponsor studies carry a list
    // of per-study permission trees. When they enter a sponsor workspace
    // for any of these studies, the SponsorLayout looks up the matching
    // entry and gates the sidebar against `sponsorPermissions`.
    //
    // Shape: [
    //   { studyId, studyTitle?, sponsorId?, sponsorName?,
    //     sponsorPermissions: { [leafKey]: { view, … } } },
    //   …
    // ]
    assignedStudies: normalizeAssignedStudies(
      raw.assigned_studies ?? raw.assignedStudies ?? raw.studies ?? [],
    ),
  };
}

/** Map snake_case → camelCase for each entry in the CRO user's study list. */
function normalizeAssignedStudies(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => ({
    studyId:           s.study_id          ?? s.studyId          ?? '',
    studyTitle:        s.study_title       ?? s.studyTitle       ?? '',
    sponsorId:         s.sponsor_id        ?? s.sponsorId        ?? '',
    sponsorName:       s.sponsor_name      ?? s.sponsorName      ?? '',
    sponsorPermissions: s.sponsor_permissions ?? s.sponsorPermissions ?? null,
  })).filter((s) => s.studyId);
}

/** snake_case → camelCase (clinical_programs → clinicalPrograms). Used only
 *  by the legacy 3-level-tree fallback path in normalizePermissions; the
 *  current backend shape is the flat 2-level leaf tree handled directly. */
const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** True if every value in `obj` is a leaf node `{ action: boolean }` rather
 *  than another tree. Used to detect the backend's 2-level shape. */
function isLeafActionTree(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.every((k) => {
    const v = obj[k];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    return Object.values(v).every((vv) => typeof vv === 'boolean');
  });
}

/** Find a node in `obj` whose key matches `targetKey` in any common casing:
 *  exact, snake_case form, lowercased. Returns the value or undefined. */
function lookupKey(obj, targetKey) {
  if (!obj || typeof obj !== 'object') return undefined;
  // 1. exact match (fast path)
  if (obj[targetKey] !== undefined) return obj[targetKey];
  // 2. snake_case match — convert each key to camelCase and compare
  const targetLower = targetKey.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (snakeToCamel(k) === targetKey) return obj[k];
    if (k.toLowerCase() === targetLower) return obj[k];
  }
  return undefined;
}

/**
 * Convert API permissions to the flat dot-notation array the CRO sidebar
 * expects (`groupKey.featureKey.permKey`, e.g. `teamAdmin.teamMembers.view`).
 *
 * Accepts four input shapes the backend has used:
 *   1. Flat object array (legacy): [ { featurename, canview, … }, … ]
 *   2. 3-level tree — keys may be camelCase OR snake_case OR mixed:
 *      { teamAdmin:  { teamMembers:  { view: true, … } } }
 *      { team_admin: { team_members: { view: true, … } } }
 *   3. Cached string array from a previous session — pass through.
 *   4. Single-level flat object: { "teamAdmin.teamMembers.view": true, … }
 *
 * Unknown groups / features are silently ignored, but if the input tree had
 * keys and we matched NOTHING, we log a warning so casing bugs are visible.
 */
function normalizePermissions(apiPerms) {
  // Empty input
  if (apiPerms == null) return [];

  // (3) Cached string array — pass through
  if (Array.isArray(apiPerms) && apiPerms.length === 0) return [];
  if (Array.isArray(apiPerms) && typeof apiPerms[0] === 'string') return apiPerms;

  // (2) 3-level tree: { groupKey: { featureKey: { perm: bool } } }
  if (!Array.isArray(apiPerms) && typeof apiPerms === 'object') {
    // (4) Try single-level flat-object first — if every key contains a `.`
    // and maps to a truthy boolean, treat it as { "a.b.c": true, ... }.
    const keys = Object.keys(apiPerms);
    if (keys.length && keys.every((k) => k.includes('.') && typeof apiPerms[k] !== 'object')) {
      return keys.filter((k) => !!apiPerms[k]);
    }

    // (5) Backend's 2-level leaf shape: { studies: { view: true }, … }.
    // Emit "{leaf}.{action}" strings directly. The CRO sidebar, dashboard
    // guard, etc. now read leaves by their snake_case keys (matching the
    // shape returned by /api/v1/profile/me/permissions) — no group/feature
    // translation needed on the consumer side. The tree is still stored at
    // state.permissionsTree for `can(tree, leaf, action)` lookups.
    if (isLeafActionTree(apiPerms)) {
      const result = [];
      for (const leaf of keys) {
        const node = apiPerms[leaf];
        for (const [action, allowed] of Object.entries(node)) {
          if (allowed) result.push(`${leaf}.${action}`);
        }
      }
      return result;
    }

    const result = [];
    for (const group of PERMISSION_GROUPS) {
      const gNode = lookupKey(apiPerms, group.key);
      if (!gNode || typeof gNode !== 'object') continue;
      for (const feature of group.features) {
        const fNode = lookupKey(gNode, feature.key);
        if (!fNode || typeof fNode !== 'object') continue;
        feature.perms.forEach(({ key }) => {
          if (lookupKey(fNode, key)) result.push(`${group.key}.${feature.key}.${key}`);
        });
      }
    }

    // Diagnostic: tree had keys but nothing matched — almost certainly a
    // schema mismatch between backend keys and PERMISSION_GROUPS.
    if (result.length === 0 && keys.length > 0 && typeof console !== 'undefined') {
      console.warn(
        '[auth] permissions tree had keys but none matched PERMISSION_GROUPS — sidebar will look empty.',
        { receivedTopLevelKeys: keys, expectedTopLevelKeys: PERMISSION_GROUPS.map((g) => g.key) },
      );
    }
    return result;
  }

  // (1) Flat object array: [ { featurename, canview, … }, … ]
  if (!Array.isArray(apiPerms)) return [];
  const result = [];
  for (const p of apiPerms) {
    const featureName = (p.featurename ?? p.feature_name ?? p.featureName ?? '').toLowerCase();
    for (const group of PERMISSION_GROUPS) {
      for (const feature of group.features) {
        if (feature.label.toLowerCase() === featureName) {
          const permMap = {
            view:          p.canview      ?? p.can_view      ?? p.canView      ?? false,
            create:        p.cancreate    ?? p.can_create    ?? p.canCreate    ?? false,
            edit:          p.canedit      ?? p.can_edit      ?? p.canEdit      ?? false,
            delete:        p.candelete    ?? p.can_delete    ?? p.canDelete    ?? false,
            export:        p.canexport    ?? p.can_export    ?? p.canExport    ?? false,
            duplicate:     p.canduplicate ?? p.can_duplicate ?? p.canDuplicate ?? false,
            locked:        p.canlock      ?? p.can_lock      ?? p.canLock      ?? false,
            import:        p.canimport    ?? p.can_import    ?? p.canImport    ?? false,
            configuration: p.canconfigure ?? p.can_configure ?? p.canConfigure ?? false,
            publish:       p.canpublish   ?? p.can_publish   ?? p.canPublish   ?? false,
          };
          feature.perms.forEach(({ key }) => {
            if (permMap[key]) result.push(`${group.key}.${feature.key}.${key}`);
          });
        }
      }
    }
  }
  return result;
}

/** Persist tokens to localStorage — handles both camelCase and snake_case API responses */
function applyTokens(state, raw) {
  const accessToken  = raw.accessToken  ?? raw.access_token;
  const refreshToken = raw.refreshToken ?? raw.refresh_token;
  state.accessToken  = accessToken  ?? state.accessToken;
  state.refreshToken = refreshToken ?? state.refreshToken;
  if (accessToken)  localStorage.setItem('accessToken',  accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

/** Normalize + write user + permissions to state and localStorage.
 *
 *  - `rawPerms` missing/empty       → no access  (state.permissions = [])
 *  - rawPerms === '*' OR true       → wildcard   (system admin — explicit)
 *  - rawPerms array of strings      → pass through
 *  - rawPerms array of objects      → flatten via normalizePermissions
 *  - rawPerms tree (object of objs) → flatten via normalizePermissions
 *
 *  Wildcard is NEVER granted as a fallback — backend must say so explicitly
 *  (`permissions: '*'` or `permissions: true`). This prevents a site or
 *  sponsor user, who happens to authenticate through the CRO sign-in form,
 *  from accidentally seeing the entire CRO menu when their CRO permissions
 *  are simply absent.
 */
function applyUser(state, raw) {
  // The backend may put `assigned_studies` either on the user object OR at
  // the top level of the login response (currently top-level via
  // /auth/login/choose-identity). normalizeUser only knows about the user
  // object, so merge the top-level field in before normalizing — otherwise
  // a CRO team-member's per-study sponsor permissions never land on
  // state.user.assignedStudies, and the sponsor sidebar falls back to
  // "unrestricted" (which looks like the default menu).
  const userRaw = raw?.user ? { ...raw.user } : raw?.user;
  if (userRaw && typeof userRaw === 'object') {
    if (!userRaw.assigned_studies && !userRaw.assignedStudies) {
      const topLevel = raw.assigned_studies ?? raw.assignedStudies ?? raw.studies;
      if (Array.isArray(topLevel) && topLevel.length) {
        userRaw.assignedStudies = topLevel;
      }
    }
  }
  const user = normalizeUser(userRaw);

  const rawPerms = raw.permissions ?? raw.permission;

  // Diagnostic — surface the shape of permissions exactly once per login.
  // Trimmed to first-level keys so the console doesn't get spammed for big
  // payloads. Set window.__AUTH_DEBUG = false to silence.
  try {
    if (typeof window === 'undefined' || window.__AUTH_DEBUG !== false) {
      const shape =
        rawPerms == null               ? 'null/undefined'
      : rawPerms === '*'               ? "'*' (wildcard)"
      : rawPerms === true              ? 'true (wildcard)'
      : Array.isArray(rawPerms)        ? `array(len=${rawPerms.length}, first=${typeof rawPerms[0]})`
      : typeof rawPerms === 'object'   ? `object(keys=${Object.keys(rawPerms).join(',')})`
                                       : typeof rawPerms;
      console.info('[auth] applyUser → permissions shape:', shape, rawPerms);
    }
  } catch { /* ignore */ }

  let permissions;
  let permissionsTree;
  if (rawPerms === '*' || rawPerms === true) {
    permissions     = ['*'];
    permissionsTree = '*';
  } else if (Array.isArray(rawPerms) && rawPerms.length > 0) {
    permissions     = normalizePermissions(rawPerms);
    permissionsTree = null;             // array shape — no tree to expose
  } else if (rawPerms && typeof rawPerms === 'object' && Object.keys(rawPerms).length > 0) {
    permissions     = normalizePermissions(rawPerms);
    permissionsTree = rawPerms;         // raw backend tree — usePermissions consumes this
  } else {
    permissions     = [];               // no CRO access — explicit
    permissionsTree = null;
  }

  state.user            = user;
  state.permissions     = permissions;
  state.permissionsTree = permissionsTree;
  state.isAuthenticated = Boolean(user);
  state.status          = 'succeeded';
  state.error           = null;
  if (user) {
    localStorage.setItem('authUser',            JSON.stringify(user));
    localStorage.setItem('authPermissions',     JSON.stringify(permissions));
    localStorage.setItem('authPermissionsTree', JSON.stringify(permissionsTree));
  }
}

/**
 * Apply a sponsor-scoped login payload to Redux + localStorage. Defined at
 * module scope (rather than inside extraReducers) so loginAsync.fulfilled and
 * the identity-switch reducers can route sponsor responses through here too.
 *
 * Critical: a previous CRO session may have populated `state.permissions`,
 * `state.permissionsTree`, `accessToken`, `refreshToken` and `authUser` in
 * Redux + localStorage. Sponsor login must clear ALL of those — otherwise
 * CROLayout filters its sidebar against the stale tree and the sponsor user
 * sees the previous CRO menu (overlapping leaf keys like `studies.view`,
 * `dashboard.view`, `query_manager.view` are the smoking gun).
 */
function applySponsorFulfilled(state, { payload }) {
  const user = normalizeUser(payload?.user);
  state.user            = user;
  state.accessToken     = null;   // CRO token slot — sponsor uses sponsorAccessToken
  state.refreshToken    = null;
  state.permissions     = [];     // wipe stale CRO permissions
  state.permissionsTree = null;   // wipe stale CRO tree
  state.isAuthenticated = Boolean(user);
  state.status          = 'succeeded';
  state.error           = null;
  if (user) localStorage.setItem('authUser', JSON.stringify(user));
  // Mirror the Redux wipe into localStorage so a page reload doesn't
  // re-hydrate the CRO state from the previous session.
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.setItem('authPermissions',     JSON.stringify([]));
  localStorage.setItem('authPermissionsTree', JSON.stringify(null));
}

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateUser(state, { payload }) {
      if (state.user) {
        state.user = { ...state.user, ...payload };
      }
    },
    /**
     * Apply the unified /profile/me/permissions response to the CRO scope.
     * Flattens the tree to the dot-notation array CROLayout expects, and
     * updates the user's assignedStudies for per-study sponsor lookup.
     *
     * Empty / missing permissions = no CRO access (no wildcard fallback).
     */
    setRolePermissions(state, { payload }) {
      const { permissions, assignedStudies } = payload ?? {};

      let flat;
      let tree;
      if (permissions === '*' || permissions === true) {
        flat = ['*'];
        tree = '*';
      } else if (Array.isArray(permissions) && permissions.length > 0) {
        flat = normalizePermissions(permissions);
        tree = null;
      } else if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
        flat = normalizePermissions(permissions);
        tree = permissions;
      } else {
        flat = [];
        tree = null;
      }
      state.permissions     = flat;
      state.permissionsTree = tree;

      if (state.user) {
        state.user.assignedStudies = Array.isArray(assignedStudies)
          ? assignedStudies
          : (state.user.assignedStudies ?? []);
      }
      localStorage.setItem('authPermissions',     JSON.stringify(state.permissions));
      localStorage.setItem('authPermissionsTree', JSON.stringify(state.permissionsTree));
      if (state.user) {
        localStorage.setItem('authUser', JSON.stringify(state.user));
      }
    },

    /**
     * Refresh ONLY the per-study assignedStudies list (and persist it),
     * without touching state.permissions. Used by applyPermissions when a
     * sponsor-scope /profile/me/permissions response carries the CRO viewer's
     * assignedStudies — so the sponsor sidebar/gates stay current on refresh,
     * not just on switch.
     */
    setAssignedStudies(state, { payload }) {
      if (!state.user) return;
      state.user.assignedStudies = Array.isArray(payload) ? payload : [];
      localStorage.setItem('authUser', JSON.stringify(state.user));
    },

    /**
     * Wipe the CRO permission array. Called by applyPermissions when the
     * dynamic /profile/me/permissions endpoint indicates the user is in
     * a different scope (site or sponsor) so the CRO sidebar shows nothing
     * accidentally.
     */
    clearCroPermissions(state) {
      state.permissions     = [];
      state.permissionsTree = null;
      localStorage.setItem('authPermissions',     JSON.stringify([]));
      localStorage.setItem('authPermissionsTree', JSON.stringify(null));
    },
    logout(state) {
      state.user            = null;
      state.accessToken     = null;
      state.refreshToken    = null;
      state.permissions     = [];
      state.permissionsTree = null;
      state.isAuthenticated = false;
      state.status          = 'idle';
      state.error           = null;
      // CRO scope
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('authPermissions');
      localStorage.removeItem('authPermissionsTree');
      // Sponsor scope
      localStorage.removeItem('sponsorAccessToken');
      localStorage.removeItem('sponsorRefreshToken');
      localStorage.removeItem('sponsorAuthUser');
      localStorage.removeItem('sponsorStudyContext');
      localStorage.removeItem('sponsorViewToken');
      localStorage.removeItem('sponsorViewMeta');
      localStorage.removeItem('sponsorViewFlash');
      // Site scope — must be cleared too or a stale siteStudyContext from a
      // prior PI session will incorrectly restrict the next sponsor login's
      // menu via useSiteRolePermissions.
      localStorage.removeItem('siteAccessToken');
      localStorage.removeItem('siteRefreshToken');
      localStorage.removeItem('siteWorkspaceToken');
      localStorage.removeItem('siteAuthUser');
      localStorage.removeItem('siteStudies');
      localStorage.removeItem('siteStudyContext');
    },
    setGeoInfo(state, action) {
      state.geoInfo = action.payload;
    },
    clearError(state) {
      state.error  = null;
      state.status = 'idle';
    },
  },

  extraReducers: (builder) => {
    // ── activateAccountAsync ─────────────────────────────────────────────────
    builder
      .addCase(activateAccountAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(activateAccountAsync.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(activateAccountAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // The shared /auth/login/password endpoint serves CRO, sponsor, and (via
    // the choose/switch flows) site identities — the response payload carries
    // `scope` to tell us which one. Sponsor + site MUST NOT flow through
    // applyUser, or the sponsor/site permission tree would land in the CRO
    // `authPermissionsTree` slot and CROLayout would render a stale menu.
    const applyByScope = (state, { payload }) => {
      // MFA challenge carries no tokens/user — leave state untouched; the UI
      // prompts for the code and verifyMfaAsync applies the real session.
      if (payload?.mfaRequired) { state.status = 'succeeded'; return; }
      const scope = (payload?.scope ?? '').toLowerCase();
      if (scope === 'sponsor') {
        applySponsorFulfilled(state, { payload });
        return;
      }
      if (scope === 'site') {
        // Site session — tokens + permissions belong to siteAuthStore (the
        // SiteLayout reads them directly). But the shared header/profile UI
        // reads `state.user.fullName` for the avatar + display name, so we
        // still normalize the user into Redux. Without this, site users
        // signed in via the unified /auth/login/password show a blank name.
        //
        // Permission slots stay empty so CROLayout never renders for a site
        // session.
        const user = normalizeUser(payload?.user);
        state.user            = user;
        state.accessToken     = null;
        state.refreshToken    = null;
        state.permissions     = [];
        state.permissionsTree = null;
        state.isAuthenticated = Boolean(user);
        state.status          = 'succeeded';
        state.error           = null;
        if (user) localStorage.setItem('authUser', JSON.stringify(user));
        return;
      }
      applyTokens(state, payload);
      applyUser(state, payload);
    };

    // ── loginAsync ──────────────────────────────────────────────────────────
    builder
      .addCase(loginAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(loginAsync.fulfilled, (state, action) => {
        // requires_choice response carries no tokens or final user — skip
        // applying it (otherwise an in-app workspace switch would null
        // out the currently authenticated user mid-flow). The component
        // will call chooseIdentityAsync next, which DOES apply state.
        if (action.payload?.requiresChoice) { state.status = 'succeeded'; return; }
        if (action.payload?.mfaRequired) { state.status = 'succeeded'; return; }
        applyByScope(state, action);
      })
      .addCase(loginAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── loginWithOtpAsync ───────────────────────────────────────────────────
    builder
      .addCase(loginWithOtpAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(loginWithOtpAsync.fulfilled, applyByScope)
      .addCase(loginWithOtpAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── chooseIdentityAsync ─────────────────────────────────────────────────
    // Step 2 of multi-identity login. Must update Redux state the same way
    // loginAsync does — otherwise isAuthenticated stays false and the
    // ProtectedRoute bounces the user to /signin even though the token is
    // already in localStorage.
    builder
      .addCase(chooseIdentityAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(chooseIdentityAsync.fulfilled, applyByScope)
      .addCase(chooseIdentityAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── verifyMfaAsync ──────────────────────────────────────────────────────
    // Completes a 2FA login; applies the real session via applyByScope.
    builder
      .addCase(verifyMfaAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(verifyMfaAsync.fulfilled, applyByScope)
      .addCase(verifyMfaAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── switchIdentityAsync ─────────────────────────────────────────────────
    // In-app no-password workspace switch — applies state exactly like
    // chooseIdentityAsync (a minted session for one of the user's identities).
    builder
      .addCase(switchIdentityAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(switchIdentityAsync.fulfilled, applyByScope)
      .addCase(switchIdentityAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── sponsor login (password + OTP) ──────────────────────────────────────
    // Sponsor tokens live in localStorage under sponsor-scope keys (handled by
    // sponsorTokenStore inside the thunk). The sponsor user overwrites state.user
    // so the header/profile reflect the logged-in sponsor identity.
    //
    // The shared `applySponsorFulfilled` (defined at module scope above) wipes
    // any stale CRO permissions / tokens that would otherwise cause CROLayout
    // to render a stale menu under the sponsor session.
    builder
      .addCase(sponsorLoginAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(sponsorLoginAsync.fulfilled, applySponsorFulfilled)
      .addCase(sponsorLoginAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });
    builder
      .addCase(sponsorRequestOtpAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(sponsorRequestOtpAsync.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(sponsorRequestOtpAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });
    builder
      .addCase(sponsorLoginWithOtpAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(sponsorLoginWithOtpAsync.fulfilled, applySponsorFulfilled)
      .addCase(sponsorLoginWithOtpAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── requestOtpAsync ─────────────────────────────────────────────────────
    builder
      .addCase(requestOtpAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(requestOtpAsync.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(requestOtpAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

// ── refreshTokenAsync ───────────────────────────────────────────────────
    builder
      .addCase(refreshTokenAsync.pending,   (state) => { state.status = 'loading'; })
      .addCase(refreshTokenAsync.fulfilled, (state, { payload }) => {
        applyTokens(state, payload);
        state.status = 'succeeded';
      })
      .addCase(refreshTokenAsync.rejected,  (state, { payload }) => {
        state.status          = 'failed';
        state.error           = payload;
        state.isAuthenticated = false;
        state.accessToken     = null;
        state.refreshToken    = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('authUser');
        localStorage.removeItem('authPermissions');
        localStorage.removeItem('authPermissionsTree');
      });

  },
});

export const {
  logout,
  setGeoInfo,
  clearError,
  updateUser,
  setRolePermissions,
  setAssignedStudies,
  clearCroPermissions,
} = authSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectAuth            = (state) => state.auth;
export const selectCurrentUser     = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthStatus      = (state) => state.auth.status;
export const selectAuthError       = (state) => state.auth.error;
/** Per-study sponsor permissions for a CRO team member assigned to studies. */
export const selectAssignedStudies = (state) => state.auth.user?.assignedStudies ?? [];
export const selectPermissions     = (state) => state.auth.permissions;
/** Raw backend permissions tree (e.g. { studies: { view: true } }). Use this
 *  with `usePermissions` / `hasPerm` for `{leaf}.{action}` lookups. Falls
 *  back to selectPermissions for code paths that only care about wildcard. */
export const selectPermissionsTree = (state) => state.auth.permissionsTree;
export const selectGeoInfo         = (state) => state.auth.geoInfo;

export default authSlice.reducer;
