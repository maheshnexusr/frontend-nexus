/**
 * fileUrl.js — resolve a stored upload reference to a loadable URL.
 *
 * Uploaded eCRF files (images, signatures, file fields) are stored on the
 * backend as relative paths like "/uploads/<env>/<study_id>/<file>". Those must
 * be prefixed with the API origin so the browser (running on the Vite dev
 * origin, or any front-end host) loads them from the backend, not itself.
 *
 * Pass-through for values that are already absolute (http/https), inline data
 * URLs (legacy base64 records) or blob URLs.
 */

const API_BASE = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

export function resolveFileUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default resolveFileUrl;
