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

import store from '@/app/store';
import siteAxiosClient    from '@/api/siteAxiosClient';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import axiosClient        from '@/api/axiosClient';

// Pick the workspace client whose session is active, in the same priority order
// the app uses elsewhere (site → sponsor/view → CRO). Only one session is ever
// live at a time. Delegating to the SCOPED client (instead of a bare axios with
// a hand-attached token) means the upload inherits that client's 401 → silent
// refresh / re-mint + retry. The previous bare-axios upload could not refresh,
// so once the 15-minute access token expired mid-capture, uploads 401'd with no
// recovery (the file/image/signature would just fail to attach).
function pickClient() {
  if (localStorage.getItem('siteWorkspaceToken') || localStorage.getItem('siteAccessToken')) {
    return siteAxiosClient;
  }
  if (localStorage.getItem('sponsorViewToken') || localStorage.getItem('sponsorAccessToken')) {
    return sponsorAxiosClient;
  }
  return axiosClient; // CRO designer / preview
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
 *
 * `category` chooses the studies/study_<id>/<category>/ subfolder on disk
 * (e.g. images, reports, consent_forms, protocol). Omit it to fall to "files".
 */
export async function uploadFormFile(file, category) {
  const ctx = activeStudyContext();
  if (!ctx) {
    throw new Error('No active study context — cannot upload file.');
  }
  const client = pickClient();

  // study_id + category MUST precede the file: the backend computes the
  // destination folder inside multer's file handler, which only sees fields
  // parsed earlier in the multipart stream. (environment is sent for
  // back-compat; the backend now derives the tier from its own UPLOAD_ROOT.)
  const fd = new FormData();
  fd.append('study_id', ctx.studyId);
  fd.append('environment', ctx.environment);
  if (category) fd.append('category', category);
  fd.append('file', file);

  // The scoped clients attach their own auth token + exempt FormData from the
  // snake-case transform, and their response interceptor unwraps to res.data —
  // so this resolves to { success, file }, not the raw axios response.
  const data = await client.post('/api/v1/form-files', fd, { timeout: 60_000 });
  return data.file; // { url, name, type, size }
}

export default uploadFormFile;
