import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService }        from '@/services/authService';
import { sponsorAuthService, sponsorTokenStore } from '@/services/sponsorAuthService';
import { profileService }     from '@/services/profileService';
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
  };
}

/**
 * Convert API permissions (flat array of objects) → string array.
 * Handles all casing variants the backend has returned:
 *   featurename / feature_name / featureName
 *   canview / can_view / canView  … etc.
 * Each enabled permission becomes: 'groupKey.featureKey.permKey'
 * e.g. 'teamAdmin.teamMembers.view'
 */
function normalizePermissions(apiPerms) {
  if (!Array.isArray(apiPerms) || apiPerms.length === 0) return [];
  // Already a string array (cached from previous session) — pass through
  if (typeof apiPerms[0] === 'string') return apiPerms;

  const result = [];
  for (const p of apiPerms) {
    // Accept featurename / feature_name / featureName
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

/** Normalize + write user + permissions to state and localStorage */
function applyUser(state, raw) {
  const user = normalizeUser(raw.user);

  const rawPerms = raw.permissions ?? raw.permission;
  // No permissions from backend = system admin → grant full access via wildcard
  const permissions = (!rawPerms || rawPerms.length === 0)
    ? ['*']
    : normalizePermissions(rawPerms);

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
      // Sponsor scope — the shared Sidebar logout lives in both layouts,
      // so clear sponsor tokens/context here too (idempotent if unset).
      localStorage.removeItem('sponsorAccessToken');
      localStorage.removeItem('sponsorRefreshToken');
      localStorage.removeItem('sponsorAuthUser');
      localStorage.removeItem('sponsorStudyContext');
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

export const { logout, setGeoInfo, clearError, updateUser } = authSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectAuth            = (state) => state.auth;
export const selectCurrentUser     = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthStatus      = (state) => state.auth.status;
export const selectAuthError       = (state) => state.auth.error;
export const selectPermissions     = (state) => state.auth.permissions;
export const selectGeoInfo         = (state) => state.auth.geoInfo;

export default authSlice.reducer;
