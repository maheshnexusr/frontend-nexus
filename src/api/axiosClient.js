/**
 * axiosClient.js
 * Single, project-wide Axios instance.
 *
 * Responsibilities:
 *  - Base URL from env (VITE_API_BASE_URL)
 *  - Attach JWT on every outgoing request
 *  - Unwrap `response.data` so services receive the payload directly
 *  - Attempt a silent token refresh on 401
 *  - Clear session + redirect to /login on unrecoverable 401
 *  - Normalize all errors into a consistent shape via normalizeError()
 */

import axios from 'axios';
import { normalizeError } from './apiHelpers';

/* ── Instance ─────────────────────────────────────────────────────────────── */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

// Print the active API server on every page load so you know where calls go
console.info(`%c[API] Connected to: ${BASE_URL}`, 'color:#7c3aed;font-weight:bold');

const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  },
});

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const TOKEN_KEY   = 'accessToken';
const REFRESH_KEY = 'refreshToken';

const getAccessToken  = () => localStorage.getItem(TOKEN_KEY);
const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
const saveTokens      = ({ accessToken, refreshToken }) => {
  if (accessToken)  localStorage.setItem(TOKEN_KEY,   accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
};
const clearSession    = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('dev_mock_session');
};

/** Navigate without a full-page reload where possible. */
function redirectToLogin() {
  clearSession();
  window.location.href = '/signin';
}

/** Auth endpoints that should never trigger a token refresh on 401. */
const AUTH_ENDPOINTS = [
  '/api/v1/auth/login/password',
  '/api/v1/auth/login/otp/request',
  '/api/v1/auth/login/otp/verify',
  '/api/v1/auth/refresh',
  '/api/v1/auth/register',
  '/api/v1/auth/activate',
];

/* ── Debug logger (only active when VITE_API_DEBUG=true) ─────────────────── */
const DEBUG = import.meta.env.VITE_API_DEBUG === 'true';

function logRequest(config) {
  if (!DEBUG) return;
  console.groupCollapsed(`%c ▶ ${config.method?.toUpperCase()} ${config.url}`, 'color:#2563eb;font-weight:bold');
  console.log('Base URL :', config.baseURL);
  console.log('Full URL :', `${config.baseURL}${config.url}`);
  if (config.params)  console.log('Params   :', config.params);
  if (config.data)    console.log('Body     :', config.data);
  console.groupEnd();
}

function logResponse(response) {
  if (!DEBUG) return;
  console.groupCollapsed(`%c ✔ ${response.config?.method?.toUpperCase()} ${response.config?.url} — ${response.status}`, 'color:#16a34a;font-weight:bold');
  console.log('Data     :', response.data);
  console.groupEnd();
}

function logError(error) {
  if (!DEBUG) return;
  const status = error.response?.status ?? 'Network';
  const url    = error.config?.url ?? '';
  console.groupCollapsed(`%c ✖ ${error.config?.method?.toUpperCase()} ${url} — ${status}`, 'color:#dc2626;font-weight:bold');
  console.log('Status  :', status);
  console.log('Message :', error.response?.data?.message ?? error.message);
  console.log('Full    :', error);
  console.groupEnd();
}

/* ── Request interceptor — attach Bearer token + debug log ───────────────── */
axiosClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    logRequest(config);
    return config;
  },
  (error) => Promise.reject(normalizeError(error)),
);

/* ── Response interceptor — unwrap data + handle auth errors ─────────────── */

/** Tracks whether a token refresh is already in progress. */
let refreshing         = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}
function notifySubscribers(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

axiosClient.interceptors.response.use(
  /* ─ Success: log + unwrap the payload ─ */
  (response) => { logResponse(response); return response.data; },

  /* ─ Error: log + refresh → retry → normalize ─ */
  async (error) => {
    logError(error);
    const original = error.config;

    /* 401 handling — one refresh attempt per request.
       Skip for auth endpoints: a 401 there means wrong credentials, not expired session. */
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => original.url?.includes(p));
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      const refresh = getRefreshToken();
      if (!refresh) { redirectToLogin(); return Promise.reject(normalizeError(error)); }

      /* If a refresh is already underway, queue this request behind it */
      if (refreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (newToken) {
              original.headers.Authorization = `Bearer ${newToken}`;
              resolve(axiosClient(original));
            } else {
              reject(normalizeError(error));
            }
          });
        });
      }

      refreshing = true;

      try {
        /* Raw axios call — bypass our interceptors to avoid infinite loops */
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/api/v1/auth/refresh`,
          { refresh_token: refresh },
        );
        saveTokens(data);
        notifySubscribers(data.accessToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosClient(original);
      } catch {
        notifySubscribers(null);
        redirectToLogin();
        return Promise.reject(normalizeError(error));
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export default axiosClient;
