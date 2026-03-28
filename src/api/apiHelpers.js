/**
 * apiHelpers.js
 * Pure utility functions shared by the Axios client and the service layer.
 * No React imports — usable in any context.
 */

/* ── HTTP status → human message ─────────────────────────────────────────── */
const STATUS_MESSAGES = {
  400: 'Bad request. Please check your input.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  408: 'Request timed out. Please try again.',
  409: 'A conflict occurred. This record may already exist.',
  422: 'Validation failed. Please review your input.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'A server error occurred. Please try again later.',
  502: 'Bad gateway. The service may be restarting.',
  503: 'Service temporarily unavailable. Please try again shortly.',
  504: 'Gateway timeout. Please check your connection.',
};

/**
 * Convert any Axios error into a plain, predictable error shape.
 *
 * Normalized shape:
 * {
 *   status:  number   — HTTP status (0 = network error, -1 = unknown)
 *   message: string   — human-readable summary
 *   errors:  object|null — field-level validation errors (422 responses)
 *   raw:     Error    — original Axios error for debugging
 * }
 */
export function normalizeError(error) {
  // Server responded (4xx, 5xx)
  if (error?.response) {
    const { status, data } = error.response;
    return {
      status,
      message: data?.message ?? STATUS_MESSAGES[status] ?? 'Something went wrong.',
      errors:  data?.errors  ?? null,
      raw:     error,
    };
  }

  // Request was made but no response received (offline, CORS, timeout)
  if (error?.request) {
    return {
      status:  0,
      message: 'Network error. Please check your internet connection.',
      errors:  null,
      raw:     error,
    };
  }

  // Cancelled via AbortController — not a real error, let callers handle it
  if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
    return {
      status:  -2,
      message: 'Request cancelled.',
      errors:  null,
      raw:     error,
      cancelled: true,
    };
  }

  // Anything else (e.g. misconfiguration)
  return {
    status:  -1,
    message: error?.message ?? 'An unexpected error occurred.',
    errors:  null,
    raw:     error,
  };
}

/**
 * Build a query string from a plain params object.
 * Skips null / undefined / empty-string values.
 * @param {Record<string, any>} params
 * @returns {string}  e.g. "?status=Active&page=2"
 */
export function buildQueryString(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

/**
 * Generate an export filename with the current timestamp.
 * @param {string} prefix  e.g. "Activity_Log"
 * @param {string} ext     e.g. "csv"
 * @returns {string}       e.g. "Activity_Log_20260328_143022.csv"
 */
export function buildExportFilename(prefix, ext = 'csv') {
  const now   = new Date();
  const date  = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time  = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `${prefix}_${date}_${time}.${ext}`;
}
