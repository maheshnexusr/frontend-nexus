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
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
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
  window.location.href = '/login';
}

/* ── Request interceptor — attach Bearer token ────────────────────────────── */
axiosClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
  /* ─ Success: unwrap the payload ─ */
  (response) => response.data,

  /* ─ Error: refresh → retry → normalize ─ */
  async (error) => {
    const original = error.config;

    /* 401 handling — one refresh attempt per request */
    if (error.response?.status === 401 && !original._retry) {
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
          `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/auth/refresh-token`,
          { refreshToken: refresh },
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
