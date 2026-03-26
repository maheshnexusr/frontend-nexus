import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiClient from '@/lib/api-client';

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
const initialState = {
  user:            null,
  accessToken:     sessionStorage.getItem('accessToken')  || null,
  refreshToken:    sessionStorage.getItem('refreshToken') || null,
  permissions:     [],
  isAuthenticated: false,
  status:          'idle',
  error:           null,
  geoInfo:         null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Async thunks
// ─────────────────────────────────────────────────────────────────────────────

export const signupAsync = createAsyncThunk(
  'auth/signup',
  async ({ fullName, email, password }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/signup', { fullName, email, password });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

// ── DEV-only mock users (removed automatically in production builds) ──────────
const DEV_MOCK_USERS = import.meta.env.DEV
  ? {
      'robert@domain.com':  { password: 'password123', role: 'cro_admin' },
      'user@example.com':   { password: 'password123', role: 'cro'       },
      'admin@sclin.com':    { password: 'Admin@123',   role: 'admin'     },
      'sponsor@sclin.com':  { password: 'Sponsor@123', role: 'sponsor', studyId: 'st-101' },
    }
  : null;

export const loginAsync = createAsyncThunk(
  'auth/login',
  async ({ email, password, geoInfo }, { rejectWithValue }) => {
    // DEV: short-circuit with mock credentials so the UI works without a backend
    if (import.meta.env.DEV && DEV_MOCK_USERS) {
      const mockUser = DEV_MOCK_USERS[email?.toLowerCase()];
      if (mockUser) {
        if (mockUser.password !== password) {
          return rejectWithValue('Incorrect password. Please try again.');
        }
        const session = {
          accessToken:  'dev-mock-access-token',
          refreshToken: 'dev-mock-refresh-token',
          user: {
            id:            'dev-001',
            fullName:      email.split('@')[0],
            email,
            role:          mockUser.role,
            studyId:       mockUser.studyId ?? null,
            photograph:    null,
            contactNumber: null,
          },
          permissions: ['team:read', 'masters:read', 'sponsors:read', 'studies:read'],
        };
        localStorage.setItem('dev_mock_session', JSON.stringify(session));
        return session;
      }
    }

    try {
      const { data } = await apiClient.post('/auth/signin', { email, password, geoInfo });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

export const loginWithOtpAsync = createAsyncThunk(
  'auth/loginWithOtp',
  async ({ email, otp, geoInfo }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/verify-otp', { email, otp, geoInfo });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

export const requestOtpAsync = createAsyncThunk(
  'auth/requestOtp',
  async ({ email }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/request-otp', { email });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

export const verifyEmailAsync = createAsyncThunk(
  'auth/verifyEmail',
  async ({ token }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/verify-email', { token });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const storedRefresh =
        getState().auth.refreshToken ?? sessionStorage.getItem('refreshToken');
      const { data } = await apiClient.post('/auth/refresh-token', {
        refreshToken: storedRefresh,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

export const fetchCurrentUserAsync = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    // DEV: restore mock session from localStorage without hitting the API
    if (import.meta.env.DEV) {
      const stored = localStorage.getItem('dev_mock_session');
      if (stored) {
        try { return JSON.parse(stored); } catch { /* fall through */ }
      }
    }
    try {
      const { data } = await apiClient.get('/auth/me');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

export const changePasswordAsync = createAsyncThunk(
  'auth/changePassword',
  async ({ oldPassword, newPassword }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.put('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Persist tokens to sessionStorage and update state */
function applyTokens(state, { accessToken, refreshToken }) {
  state.accessToken  = accessToken  ?? state.accessToken;
  state.refreshToken = refreshToken ?? state.refreshToken;
  if (accessToken)  sessionStorage.setItem('accessToken',  accessToken);
  if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
}

/** Write user + auth flags to state */
function applyUser(state, { user, permissions }) {
  state.user            = user        ?? null;
  state.permissions     = permissions ?? [];
  state.isAuthenticated = Boolean(user);
  state.status          = 'succeeded';
  state.error           = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user            = null;
      state.accessToken     = null;
      state.refreshToken    = null;
      state.permissions     = [];
      state.isAuthenticated = false;
      state.status          = 'idle';
      state.error           = null;
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      localStorage.removeItem('dev_mock_session');
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

    // ── verifyEmailAsync ────────────────────────────────────────────────────
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
        // Treat failed refresh as a session expiry
        state.status          = 'failed';
        state.error           = payload;
        state.isAuthenticated = false;
        state.accessToken     = null;
        state.refreshToken    = null;
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        localStorage.removeItem('dev_mock_session');
      });

    // ── fetchCurrentUserAsync ───────────────────────────────────────────────
    builder
      .addCase(fetchCurrentUserAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchCurrentUserAsync.fulfilled, (state, { payload }) => {
        applyUser(state, payload);
      })
      .addCase(fetchCurrentUserAsync.rejected,  (state, { payload }) => {
        state.status          = 'failed';
        state.error           = payload;
        state.isAuthenticated = false;
      });

    // ── changePasswordAsync ─────────────────────────────────────────────────
    builder
      .addCase(changePasswordAsync.pending,   (state) => { state.status = 'loading'; state.error = null; })
      .addCase(changePasswordAsync.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(changePasswordAsync.rejected,  (state, { payload }) => { state.status = 'failed'; state.error = payload; });
  },
});

export const { logout, setGeoInfo, clearError } = authSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectAuth            = (state) => state.auth;
export const selectCurrentUser     = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthStatus      = (state) => state.auth.status;
export const selectAuthError       = (state) => state.auth.error;
export const selectPermissions     = (state) => state.auth.permissions;
export const selectGeoInfo         = (state) => state.auth.geoInfo;

export default authSlice.reducer;
