import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService }        from '@/services/authService';
import { sponsorAuthService, sponsorTokenStore } from '@/services/sponsorAuthService';
import { profileService }     from '@/services/profileService';
import { setSiteSession }     from '@/features/site/authStore';
import { PERMISSION_GROUPS }  from '@/features/cro/constants/permissionsSchema';

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

const initialState = {
  user:            _storedUser,
  accessToken:     localStorage.getItem('accessToken')  || null,
  refreshToken:    localStorage.getItem('refreshToken') || null,
  permissions:     _storedPerms,
  isAuthenticated: Boolean(_storedUser && localStorage.getItem('accessToken')),
  status:          'idle',
  error:           null,
  geoInfo:         null,
};

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
 *  need CRO permissions — their sidebar is driven by study scope + config. */
const loginResIsSponsor = (loginRes) => {
  const roleName = (
    loginRes?.user?.role_name ?? loginRes?.user?.roleName ?? ''
  ).toLowerCase();
  return roleName.includes('sponsor');
};

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

      // Save token immediately so the next request has Authorization header
      const token = loginRes.accessToken ?? loginRes.access_token;
      if (token) localStorage.setItem('accessToken', token);

      if (loginResIsSponsor(loginRes)) {
        sponsorTokenStore.saveTokens(loginRes);
        if (loginRes.user) sponsorTokenStore.saveUser(loginRes.user);
        return loginRes;
      }

      try {
        const permRes = await profileService.getPermissions();
        const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
        return { ...loginRes, permissions: perms };
      } catch {
        return loginRes;
      }
    } catch (err) {
      return rejectWithValue(err.message ?? 'Sign-in failed.');
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

      const token = loginRes.accessToken ?? loginRes.access_token;
      if (token) localStorage.setItem('accessToken', token);

      if (loginResIsSponsor(loginRes)) {
        sponsorTokenStore.saveTokens(loginRes);
        if (loginRes.user) sponsorTokenStore.saveUser(loginRes.user);
        return loginRes;
      }

      try {
        const permRes = await profileService.getPermissions();
        const perms   = permRes?.permissions ?? permRes?.items ?? permRes ?? [];
        return { ...loginRes, permissions: perms };
      } catch {
        return loginRes;
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
 * or both), then clears client state. Server calls are best-effort — a failed
 * revocation (expired token, offline) must still clear the session locally.
 */
export const logoutAsync = createAsyncThunk(
  'auth/logoutAll',
  async (_, { dispatch }) => {
    const hasCRO     = !!localStorage.getItem('accessToken');
    const hasSponsor = !!localStorage.getItem('sponsorAccessToken');
    await Promise.allSettled([
      hasCRO     ? authService.logout()        : Promise.resolve(),
      hasSponsor ? sponsorAuthService.logout() : Promise.resolve(),
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

/**
 * Convert API permissions to the flat dot-notation array the CRO sidebar
 * expects (`groupKey.featureKey.permKey`, e.g. `teamAdmin.teamMembers.view`).
 *
 * Accepts three input shapes the backend has used:
 *   1. Flat object array (legacy): [ { featurename, canview, … }, … ]
 *   2. 3-level tree (current spec):
 *      { teamAdmin: { teamMembers: { view: true, create: false, … }, … }, … }
 *   3. Cached string array from a previous session — pass through.
 *
 * Anything else returns []. Unknown groups / features are silently ignored.
 */
function normalizePermissions(apiPerms) {
  // Empty input
  if (apiPerms == null) return [];

  // (3) Cached string array — pass through
  if (Array.isArray(apiPerms) && apiPerms.length === 0) return [];
  if (Array.isArray(apiPerms) && typeof apiPerms[0] === 'string') return apiPerms;

  // (2) 3-level tree: { groupKey: { featureKey: { perm: bool } } }
  if (!Array.isArray(apiPerms) && typeof apiPerms === 'object') {
    const result = [];
    for (const group of PERMISSION_GROUPS) {
      const gNode = apiPerms[group.key];
      if (!gNode || typeof gNode !== 'object') continue;
      for (const feature of group.features) {
        const fNode = gNode[feature.key];
        if (!fNode || typeof fNode !== 'object') continue;
        feature.perms.forEach(({ key }) => {
          if (fNode[key]) result.push(`${group.key}.${feature.key}.${key}`);
        });
      }
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
  const user = normalizeUser(raw.user);

  const rawPerms = raw.permissions ?? raw.permission;

  let permissions;
  if (rawPerms === '*' || rawPerms === true) {
    permissions = ['*'];
  } else if (Array.isArray(rawPerms) && rawPerms.length > 0) {
    permissions = normalizePermissions(rawPerms);
  } else if (rawPerms && typeof rawPerms === 'object' && Object.keys(rawPerms).length > 0) {
    permissions = normalizePermissions(rawPerms);
  } else {
    permissions = [];   // no CRO access — explicit
  }

  state.user            = user;
  state.permissions     = permissions;
  state.isAuthenticated = Boolean(user);
  state.status          = 'succeeded';
  state.error           = null;
  if (user) {
    localStorage.setItem('authUser',        JSON.stringify(user));
    localStorage.setItem('authPermissions', JSON.stringify(permissions));
  }
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
      if (permissions === '*' || permissions === true) {
        flat = ['*'];
      } else if (Array.isArray(permissions) && permissions.length > 0) {
        flat = normalizePermissions(permissions);
      } else if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
        flat = normalizePermissions(permissions);
      } else {
        flat = [];
      }
      state.permissions = flat;

      if (state.user) {
        state.user.assignedStudies = Array.isArray(assignedStudies)
          ? assignedStudies
          : (state.user.assignedStudies ?? []);
      }
      localStorage.setItem('authPermissions', JSON.stringify(state.permissions));
      if (state.user) {
        localStorage.setItem('authUser', JSON.stringify(state.user));
      }
    },

    /**
     * Wipe the CRO permission array. Called by applyPermissions when the
     * dynamic /profile/me/permissions endpoint indicates the user is in
     * a different scope (site or sponsor) so the CRO sidebar shows nothing
     * accidentally.
     */
    clearCroPermissions(state) {
      state.permissions = [];
      localStorage.setItem('authPermissions', JSON.stringify([]));
    },
    logout(state) {
      state.user            = null;
      state.accessToken     = null;
      state.refreshToken    = null;
      state.permissions     = [];
      state.isAuthenticated = false;
      state.status          = 'idle';
      state.error           = null;
      // CRO scope
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('authPermissions');
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

    // ── loginAsync ──────────────────────────────────────────────────────────
    builder
      .addCase(loginAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(loginAsync.fulfilled, (state, { payload }) => {
        applyTokens(state, payload);
        applyUser(state, payload);
      })
      .addCase(loginAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── loginWithOtpAsync ───────────────────────────────────────────────────
    builder
      .addCase(loginWithOtpAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(loginWithOtpAsync.fulfilled, (state, { payload }) => {
        applyTokens(state, payload);
        applyUser(state, payload);
      })
      .addCase(loginWithOtpAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── sponsor login (password + OTP) ──────────────────────────────────────
    // Sponsor tokens live in localStorage under sponsor-scope keys (handled by
    // sponsorTokenStore inside the thunk). The sponsor user overwrites state.user
    // so the header/profile reflect the logged-in sponsor identity.
    const applySponsorFulfilled = (state, { payload }) => {
      const user = normalizeUser(payload?.user);
      state.user            = user;
      state.permissions     = payload?.permissions ?? state.permissions;
      state.isAuthenticated = Boolean(user);
      state.status          = 'succeeded';
      state.error           = null;
      if (user) localStorage.setItem('authUser', JSON.stringify(user));
    };
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
      });

  },
});

export const {
  logout,
  setGeoInfo,
  clearError,
  updateUser,
  setRolePermissions,
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
export const selectGeoInfo         = (state) => state.auth.geoInfo;

export default authSlice.reducer;
