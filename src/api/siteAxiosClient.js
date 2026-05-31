/**
 * siteAxiosClient.js
 * Site-personnel-scope Axios instance — separate from the CRO/sponsor clients.
 *
 * Two-token model:
 *  - Picker + auth routes (/site/studies, /site/studies/choose, /site/auth/me)
 *    send the SESSION token (siteAccessToken).
 *  - Tenant-DB routes (/site/studies/dashboard, /site/workspace/*) send the
 *    WORKSPACE token (siteWorkspaceToken) and auto-inject study_id +
 *    environment from siteStudyContext.
 *
 * 401 handling:
 *  - On a session-token route → silent refresh against /site/auth/refresh.
 *  - On a workspace-token route → silent re-mint against /site/studies/choose
 *    (idempotent for an active assignment). Falls back to the picker only if
 *    the re-mint itself fails (assignment revoked, session also dead, etc.).
 *    Without this, every 15-minute idle window kicked the user out of the
 *    study workspace they were in, even on a simple page refresh.
 */

import axios from 'axios';
import { normalizeError } from './apiHelpers';
import { handleLocked } from './apiInterceptors';
import { setSiteStudyContext } from '@/features/site/authStore';

const BASE_URL = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

const siteAxiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  },
});

/* ── Storage keys (kept in sync with features/site/authStore.js) ─────────── */
const SESSION_TOKEN_KEY   = 'siteAccessToken';
const REFRESH_TOKEN_KEY   = 'siteRefreshToken';
const WORKSPACE_TOKEN_KEY = 'siteWorkspaceToken';
const CONTEXT_KEY         = 'siteStudyContext';

const getSessionToken   = () => localStorage.getItem(SESSION_TOKEN_KEY);
const getRefreshToken   = () => localStorage.getItem(REFRESH_TOKEN_KEY);
const getWorkspaceToken = () => localStorage.getItem(WORKSPACE_TOKEN_KEY);

function readContext() {
  try { return JSON.parse(localStorage.getItem(CONTEXT_KEY) ?? 'null'); }
  catch { return null; }
}

/* ── camelCase → snake_case (same impl as the other clients) ─────────────── */
const toSnake = (s) => s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
function deepToSnake(obj) {
  if (Array.isArray(obj))        return obj.map(deepToSnake);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toSnake(k), deepToSnake(v)]),
  );
}

/** Routes that require the study-scoped WORKSPACE token (a chosen study). */
function needsWorkspaceToken(url = '') {
  return url.includes('/api/v1/site/studies/dashboard')
      || url.includes('/api/v1/site/workspace/');
}

/** Auth endpoints that must never trigger a refresh on 401. */
const SITE_AUTH_ENDPOINTS = [
  '/api/v1/site/auth/login',
  '/api/v1/site/auth/refresh',
  '/api/v1/site/invite/verify',
  '/api/v1/site/invite/activate',
];

/* ── Request interceptor ──────────────────────────────────────────────────── */
siteAxiosClient.interceptors.request.use(
  (config) => {
    const workspaceRoute = needsWorkspaceToken(config.url);
    const token = workspaceRoute
      ? (getWorkspaceToken() || getSessionToken())
      : getSessionToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Inject study context for tenant-DB routes (study_id + environment).
    if (workspaceRoute) {
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
function subscribe(cb)    { refreshSubscribers.push(cb); }
function notify(newToken) { refreshSubscribers.forEach((cb) => cb(newToken)); refreshSubscribers = []; }

// Parallel queue for the workspace-token re-mint flow. A page refresh fires
// many workspace requests in parallel; only the first triggers /studies/choose
// and the rest wait on it.
let rebinding         = false;
let rebindSubscribers = [];
function subscribeRebind(cb)   { rebindSubscribers.push(cb); }
function notifyRebind(newTok)  { rebindSubscribers.forEach((cb) => cb(newTok)); rebindSubscribers = []; }

function clearSiteSession() {
  [SESSION_TOKEN_KEY, REFRESH_TOKEN_KEY, WORKSPACE_TOKEN_KEY, CONTEXT_KEY, 'siteAuthUser', 'siteStudies']
    .forEach((k) => localStorage.removeItem(k));
}

function redirectToSignIn() {
  clearSiteSession();
  // Shared sign-in page — the backend routes by scope on login.
  window.location.href = '/signin';
}

/** Workspace token expired/invalid → drop study context, keep the session. */
function redirectToStudyPicker() {
  localStorage.removeItem(WORKSPACE_TOKEN_KEY);
  localStorage.removeItem(CONTEXT_KEY);
  window.location.href = '/site/studies';
}

/**
 * Silently re-mint the workspace token by replaying /site/studies/choose with
 * the cached study context. Returns the new token on success, or null on any
 * failure (no study context, session also expired AND refresh dead, assignment
 * revoked, study unpublished, network error, …).
 *
 * Uses siteAxiosClient rather than raw axios so the session-token refresh path
 * runs transparently: if both the workspace token AND the session token have
 * expired (common — they're both 15-min JWTs minted close together), the
 * client's own interceptor refreshes the session via siteRefreshToken first,
 * then retries this /choose call. Recursion is safe because /studies/choose
 * is NOT a workspace-token route — the response interceptor's workspace branch
 * won't fire on it, so it can't re-enter rebindWorkspaceToken from inside.
 */
async function rebindWorkspaceToken() {
  const ctx = readContext();
  if (!ctx?.studyId || !ctx?.environment) return null;
  if (!getSessionToken() && !getRefreshToken()) return null;
  try {
    const data = await siteAxiosClient.post(
      '/api/v1/site/studies/choose',
      { study_id: ctx.studyId, environment: ctx.environment },
    );
    // Re-use the same persister the picker uses on initial choose — it writes
    // the workspace token AND refreshes the cached permission tree so the
    // sidebar picks up any role changes that happened during idle.
    const persisted = setSiteStudyContext(data ?? {});
    const newToken  = localStorage.getItem(WORKSPACE_TOKEN_KEY);
    return persisted && newToken ? newToken : null;
  } catch {
    return null;
  }
}

siteAxiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = SITE_AUTH_ENDPOINTS.some((p) => original.url?.includes(p));

    if (error.response?.status === 423) {
      handleLocked(error);
      return Promise.reject(normalizeError(error));
    }

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      // Workspace-token route 401 → try a silent re-mint via /studies/choose
      // first (the common case is just 15-min JWT expiry; the assignment is
      // still good). Only bounce to the picker if the re-mint itself fails.
      if (needsWorkspaceToken(original.url)) {
        if (rebinding) {
          return new Promise((resolve, reject) => {
            subscribeRebind((newToken) => {
              if (newToken) {
                original.headers.Authorization = `Bearer ${newToken}`;
                resolve(siteAxiosClient(original));
              } else {
                reject(normalizeError(error));
              }
            });
          });
        }
        rebinding = true;
        try {
          const newToken = await rebindWorkspaceToken();
          notifyRebind(newToken);
          if (newToken) {
            original.headers.Authorization = `Bearer ${newToken}`;
            return siteAxiosClient(original);
          }
          redirectToStudyPicker();
          return Promise.reject(normalizeError(error));
        } finally {
          rebinding = false;
        }
      }

      const refresh = getRefreshToken();
      if (!refresh) { redirectToSignIn(); return Promise.reject(normalizeError(error)); }

      if (refreshing) {
        return new Promise((resolve, reject) => {
          subscribe((newToken) => {
            if (newToken) {
              original.headers.Authorization = `Bearer ${newToken}`;
              resolve(siteAxiosClient(original));
            } else {
              reject(normalizeError(error));
            }
          });
        });
      }

      refreshing = true;
      try {
        const { data } = await axios.post(
          `${BASE_URL}/api/v1/site/auth/refresh`,
          { refresh_token: refresh },
        );
        const newAccess = data?.accessToken ?? data?.access_token;
        if (newAccess) localStorage.setItem(SESSION_TOKEN_KEY, newAccess);
        notify(newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return siteAxiosClient(original);
      } catch {
        notify(null);
        redirectToSignIn();
        return Promise.reject(normalizeError(error));
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export default siteAxiosClient;
