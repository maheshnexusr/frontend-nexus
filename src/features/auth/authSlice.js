import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService } from '@/services/authService';

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

/** POST /api/v1/auth/register */
export const signupAsync = createAsyncThunk(
  'auth/signup',
  async (payload, { rejectWithValue }) => {
    try {
      return await authService.register(payload);
    } catch (err) {
      return rejectWithValue(err.message ?? 'Registration failed.');
    }
  },
);

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

/** POST /api/v1/auth/login/password */
export const loginAsync = createAsyncThunk(
  'auth/login',
  async ({ emailAddress, password }, { rejectWithValue }) => {
    try {
      return await authService.login({ emailAddress, password });
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

/** POST /api/v1/auth/login/otp/verify */
export const loginWithOtpAsync = createAsyncThunk(
  'auth/loginWithOtp',
  async ({ emailAddress, otp }, { rejectWithValue }) => {
    try {
      return await authService.verifyOtp({ emailAddress, otp });
    } catch (err) {
      return rejectWithValue(err.message ?? 'OTP verification failed.');
    }
  },
);

/** POST /api/v1/auth/verify-email */
export const verifyEmailAsync = createAsyncThunk(
  'auth/verifyEmail',
  async ({ token }, { rejectWithValue }) => {
    try {
      return await authService.verifyEmail({ token });
    } catch (err) {
      return rejectWithValue(err.message ?? 'Email verification failed.');
    }
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

/** Persist tokens to localStorage and update state */
function applyTokens(state, { accessToken, refreshToken }) {
  state.accessToken  = accessToken  ?? state.accessToken;
  state.refreshToken = refreshToken ?? state.refreshToken;
  if (accessToken)  localStorage.setItem('accessToken',  accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

/** Write user + auth flags to state and persist to localStorage */
function applyUser(state, { user, permissions }) {
  state.user            = user        ?? null;
  state.permissions     = permissions ?? [];
  state.isAuthenticated = Boolean(user);
  state.status          = 'succeeded';
  state.error           = null;
  if (user) {
    localStorage.setItem('authUser',        JSON.stringify(user));
    localStorage.setItem('authPermissions', JSON.stringify(permissions ?? []));
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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('authPermissions');
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
    // ── signupAsync ─────────────────────────────────────────────────────────
    builder
      .addCase(signupAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(signupAsync.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(signupAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

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

    // ── requestOtpAsync ─────────────────────────────────────────────────────
    builder
      .addCase(requestOtpAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(requestOtpAsync.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(requestOtpAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

    // ── verifyEmailAsync ─────────────────────────────────────────────────────
    builder
      .addCase(verifyEmailAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(verifyEmailAsync.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(verifyEmailAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });

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
