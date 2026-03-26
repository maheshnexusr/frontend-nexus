import axios from 'axios';

/**
 * Axios instance pre-configured for SclinNexus API.
 * - Reads accessToken from sessionStorage and injects it as Bearer on every request.
 * - On 401, clears session tokens (actual redirect is handled at the component/slice level).
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: strip session on 401 ────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
    }
    return Promise.reject(error);
  },
);

export default apiClient;
