/**
 * formsAxiosClient — Axios instance for /api/v1/forms/*.
 *
 * Per backend spec §0: this surface accepts either token.
 * Token priority for outgoing requests:
 *   1. sponsorViewToken (CRO viewing sponsor as read-only via /enter)
 *   2. sponsorAccessToken (direct sponsor login)
 *   3. accessToken      (CRO login)
 *
 * Inherits the same 401-silent-refresh logic as the CRO client (only the CRO
 * refresh path is supported here — sponsor refresh is the sponsor client's
 * job; if a 401 hits while only a sponsor token is active, we surface it
 * instead of silently refreshing).
 *
 * 423 + 403 are routed through the shared apiInterceptors helper so all
 * clients have identical lock / read-only behavior.
 */

import axios from 'axios';
import { normalizeError } from './apiHelpers';
import { handleLocked, handleReadOnlyForbidden } from './apiInterceptors';

const BASE_URL = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

const formsAxiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

/* ── Token resolution ────────────────────────────────────────────────────── */
function pickToken() {
  return (
    localStorage.getItem('sponsorViewToken')   ||
    localStorage.getItem('sponsorAccessToken') ||
    localStorage.getItem('accessToken')        ||
    null
  );
}

function isInReadOnlyView() {
  return !!localStorage.getItem('sponsorViewToken');
}

/* ── camelCase → snake_case (shared idiom across our clients) ────────────── */
const toSnake = (s) => s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
function deepToSnake(obj) {
  if (Array.isArray(obj))                     return obj.map(deepToSnake);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toSnake(k), deepToSnake(v)]),
  );
}

/* ── Request interceptor ─────────────────────────────────────────────────── */
formsAxiosClient.interceptors.request.use(
  (config) => {
    const token = pickToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (config.data && typeof config.data === 'object') {
      config.data = deepToSnake(config.data);
    }
    return config;
  },
  (error) => Promise.reject(normalizeError(error)),
);

/* ── Response interceptor ────────────────────────────────────────────────── */
formsAxiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 423) {
      handleLocked(error);
      return Promise.reject(normalizeError(error));
    }
    if (error.response?.status === 403 && isInReadOnlyView()) {
      handleReadOnlyForbidden(error);
      return Promise.reject(normalizeError(error));
    }
    // 401 here means the active token is stale; the owning client's silent
    // refresh will rotate it on its next request, so bubble up.
    return Promise.reject(normalizeError(error));
  },
);

export default formsAxiosClient;
