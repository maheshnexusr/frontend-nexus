/**
 * formFileClient — uploads eCRF-captured files (image/file fields and
 * signatures) to the backend, which stores them on disk under
 * /var/www/uploads/<env>/<study_id>/ and returns a small reference.
 *
 * The form value then keeps only { url, name, type, size } instead of an inline
 * base64 blob.
 *
 * The endpoint POST /api/v1/form-files is reachable from every workspace
 * (authenticateAny). We attach whichever access token is active — site,
 * sponsor (or CRO-as-sponsor view), or CRO — and append the active study
 * context (study_id + environment) so the backend can scope the storage folder.
 */

import axios from 'axios';
import store from '@/app/store';

const API_BASE = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

// Active access token, in the same priority order the workspace clients use:
// a site session has only the site token; a sponsor/CRO session has the
// sponsor/view/CRO tokens. Only one of these is ever present at a time.
function pickToken() {
  return localStorage.getItem('siteWorkspaceToken')
      || localStorage.getItem('sponsorViewToken')
      || localStorage.getItem('sponsorAccessToken')
      || localStorage.getItem('accessToken')
      || null;
}

// Active study context — whichever session is live. Site and sponsor each store
// { studyId, environment } under their own key.
function activeStudyContext() {
  for (const key of ['siteStudyContext', 'sponsorStudyContext']) {
    try {
      const ctx = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (ctx?.studyId && ctx?.environment) return ctx;
    } catch { /* ignore malformed context */ }
  }
  // Fallback for sessions that drive study context through Redux rather than a
  // localStorage context blob (e.g. sponsor study picker, CRO designer preview).
  try {
    const ws = store.getState()?.workspace;
    if (ws?.activeStudyId && ws?.activeEnvironment) {
      return { studyId: ws.activeStudyId, environment: ws.activeEnvironment };
    }
  } catch { /* store not ready */ }
  return null;
}

/**
 * Upload a single File. Resolves to { url, name, type, size }.
 * Throws if no active study context (study_id + environment) is available.
 */
export async function uploadFormFile(file) {
  const ctx = activeStudyContext();
  if (!ctx) {
    throw new Error('No active study context — cannot upload file.');
  }
  const token = pickToken();

  // study_id + environment MUST precede the file: the backend computes the
  // destination folder inside multer's file handler, which only sees fields
  // parsed earlier in the multipart stream.
  const fd = new FormData();
  fd.append('study_id', ctx.studyId);
  fd.append('environment', ctx.environment);
  fd.append('file', file);

  const res = await axios.post(`${API_BASE}/api/v1/form-files`, fd, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    timeout: 60_000,
  });
  return res.data.file; // { url, name, type, size }
}

export default uploadFormFile;
