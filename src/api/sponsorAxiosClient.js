/**
 * sponsorAxiosClient.js
 * Sponsor-scope Axios instance — separate from the CRO axiosClient per spec §11/§13.
 *
 * Responsibilities:
 *  - Attach the sponsor Bearer token (stored under sponsorAccessToken)
 *  - For /api/v1/sponsor/workspace/* calls, auto-inject study_id + environment
 *    from sponsorStudyContextStore (set by sponsorStudiesService.choose)
 *    into the query string (GET/DELETE) or body (POST/PUT/PATCH)
 *  - camelCase → snake_case JSON body conversion
 *  - Silent refresh on 401 against /api/v1/sponsor/auth/refresh
 *  - On unrecoverable 401, clear sponsor session and bounce to the sponsor login
 */

import axios from 'axios';
import { normalizeError } from './apiHelpers';
import { handleLocked, handleReadOnlyForbidden } from './apiInterceptors';

/* ── Base URL — shared with the CRO client ───────────────────────────────── */
const BASE_URL = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

const sponsorAxiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  },
});

/* ── Token + context storage keys ────────────────────────────────────────── */
const SPONSOR_ACCESS_KEY  = 'sponsorAccessToken';
const SPONSOR_REFRESH_KEY = 'sponsorRefreshToken';
const SPONSOR_CONTEXT_KEY = 'sponsorStudyContext'; // { studyId, environment, studyContextToken? }

// CRO-as-read-only-viewer token. Separate scope: clearing it must NOT touch
// the CRO accessToken or the sponsor login token.
const SPONSOR_VIEW_TOKEN_KEY = 'sponsorViewToken';
const SPONSOR_VIEW_META_KEY  = 'sponsorViewMeta';
const SPONSOR_VIEW_FLASH_KEY = 'sponsorViewFlash';

const getSponsorViewToken    = () => localStorage.getItem(SPONSOR_VIEW_TOKEN_KEY);
const getSponsorAccessToken  = () => localStorage.getItem(SPONSOR_ACCESS_KEY);
const getSponsorRefreshToken = () => localStorage.getItem(SPONSOR_REFRESH_KEY);

/**
 * Active sponsor-scope token: prefer the read-only viewer token (issued by
 * /api/v1/workspace/sponsors/:id/enter) over a normal sponsor login token.
 */
function getActiveSponsorToken() {
  return getSponsorViewToken() || getSponsorAccessToken();
}

function isInReadOnlyView() {
  return !!getSponsorViewToken();
}

function readContext() {
  try { return JSON.parse(localStorage.getItem(SPONSOR_CONTEXT_KEY) ?? 'null'); }
  catch { return null; }
}

/* ── camelCase → snake_case (same impl as CRO client) ────────────────────── */
const toSnake = (s) => s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
function deepToSnake(obj) {
  if (Array.isArray(obj))        return obj.map(deepToSnake);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toSnake(k), deepToSnake(v)]),
  );
}

/** True if the URL targets a workspace endpoint that requires study context. */
function needsStudyContext(url = '') {
  return url.includes('/api/v1/sponsor/workspace/');
}

/** Auth endpoints that should never trigger a refresh on 401. */
const SPONSOR_AUTH_ENDPOINTS = [
  '/api/v1/sponsor/auth/login/password',
  '/api/v1/sponsor/auth/login/otp/request',
  '/api/v1/sponsor/auth/login/otp/verify',
  '/api/v1/sponsor/auth/refresh',
  '/api/v1/sponsor/auth/activate',
];

/* ── Request interceptor ──────────────────────────────────────────────────── */
sponsorAxiosClient.interceptors.request.use(
  (config) => {
    const token = getActiveSponsorToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Study context injection (workspace endpoints only)
    if (needsStudyContext(config.url)) {
      const ctx = readContext();
      if (ctx?.studyId && ctx?.environment) {
        const method = (config.method || 'get').toLowerCase();
        if (method === 'get' || method === 'delete') {
          config.params = {
            study_id:    ctx.studyId,
            environment: ctx.environment,
            ...(config.params || {}),
          };
        } else if (!(config.data instanceof FormData)) {
          config.data = {
            study_id:    ctx.studyId,
            environment: ctx.environment,
            ...(config.data || {}),
          };
        } else {
          // FormData — append context fields if not already set
          if (!config.data.has('study_id'))    config.data.append('study_id',    ctx.studyId);
          if (!config.data.has('environment')) config.data.append('environment', ctx.environment);
        }
      }
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (config.data && typeof config.data === 'object') {
      config.data = deepToSnake(config.data);
    }
    return config;
  },
  (error) => Promise.reject(normalizeError(error)),
);

/* ── Response interceptor (silent refresh on 401) ────────────────────────── */
let refreshing         = false;
let refreshSubscribers = [];

function subscribe(cb)       { refreshSubscribers.push(cb); }
function notify(newToken)    { refreshSubscribers.forEach((cb) => cb(newToken)); refreshSubscribers = []; }

function clearSponsorSession() {
  localStorage.removeItem(SPONSOR_ACCESS_KEY);
  localStorage.removeItem(SPONSOR_REFRESH_KEY);
  localStorage.removeItem('sponsorAuthUser');
  localStorage.removeItem(SPONSOR_CONTEXT_KEY);
}

function clearSponsorView() {
  localStorage.removeItem(SPONSOR_VIEW_TOKEN_KEY);
  localStorage.removeItem(SPONSOR_VIEW_META_KEY);
  localStorage.removeItem(SPONSOR_CONTEXT_KEY);
}

function redirectToSponsorLogin() {
  clearSponsorSession();
  // The app currently shares a single /signin page for both scopes; when a
  // dedicated sponsor sign-in route is added, update this redirect.
  window.location.href = '/signin';
}

/**
 * In read-only viewer mode the CRO session is still valid — only the sponsor
 * view token expired/was revoked. Drop the viewer state and bounce to the CRO
 * dashboard with a one-shot flash message; do NOT touch the CRO token.
 */
function exitSponsorViewToCroDashboard(message) {
  clearSponsorView();
  if (message) localStorage.setItem(SPONSOR_VIEW_FLASH_KEY, message);
  window.location.href = '/cro/dashboard';
}

sponsorAxiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = SPONSOR_AUTH_ENDPOINTS.some((p) => original.url?.includes(p));

    // 423 — Study/Site/Subject locked. Shared toast + broadcast a window
    // event so the sponsor workspace forms can refresh + disable Save.
    if (error.response?.status === 423) {
      handleLocked(error);
      return Promise.reject(normalizeError(error));
    }

    // 403 in read-only viewer mode = a write was attempted with the
    // sponsorViewToken. Surface a toast and abort — no retry, no logout.
    if (error.response?.status === 403 && isInReadOnlyView()) {
      handleReadOnlyForbidden(error);
      return Promise.reject(normalizeError(error));
    }

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      // Read-only viewer mode: /enter does not return a refresh token — there
      // is nothing to silently refresh. Drop the viewer state and route the
      // CRO user back to their dashboard. Their CRO session stays intact.
      if (isInReadOnlyView()) {
        exitSponsorViewToCroDashboard('Your read-only sponsor view expired. Please re-enter the workspace.');
        return Promise.reject(normalizeError(error));
      }

      const refresh = getSponsorRefreshToken();
      if (!refresh) { redirectToSponsorLogin(); return Promise.reject(normalizeError(error)); }

      if (refreshing) {
        return new Promise((resolve, reject) => {
          subscribe((newToken) => {
            if (newToken) {
              original.headers.Authorization = `Bearer ${newToken}`;
              resolve(sponsorAxiosClient(original));
            } else {
              reject(normalizeError(error));
            }
          });
        });
      }

      refreshing = true;
      try {
        const { data } = await axios.post(
          `${BASE_URL}/api/v1/sponsor/auth/refresh`,
          { refresh_token: refresh },
        );
        const newAccess  = data?.accessToken  ?? data?.access_token;
        const newRefresh = data?.refreshToken ?? data?.refresh_token;
        if (newAccess)  localStorage.setItem(SPONSOR_ACCESS_KEY,  newAccess);
        if (newRefresh) localStorage.setItem(SPONSOR_REFRESH_KEY, newRefresh);
        notify(newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return sponsorAxiosClient(original);
      } catch {
        notify(null);
        redirectToSponsorLogin();
        return Promise.reject(normalizeError(error));
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export default sponsorAxiosClient;
