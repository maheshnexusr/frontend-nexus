/**
 * protectedFile.js — load PRIVATE uploads (e.g. consent documents) that are no
 * longer served by the public /uploads static mount.
 *
 * These files are reachable only through the authenticated backend route
 *   GET /api/v1/form-files/view?path=<relative path after /uploads/>
 * so a plain <img src> / <a href> (which don't send the auth header) won't work.
 * We fetch the bytes with the active workspace token and hand back a short-lived
 * object URL the browser can render/download.
 */

import axios from 'axios';
import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

// Same token priority the other workspace clients use — only one is ever live.
function pickToken() {
  return localStorage.getItem('siteWorkspaceToken')
      || localStorage.getItem('sponsorViewToken')
      || localStorage.getItem('sponsorAccessToken')
      || localStorage.getItem('accessToken')
      || null;
}

/** True for stored refs that must be streamed through the authenticated route. */
export function isProtectedUrl(url) {
  return typeof url === 'string' && /\/consent_forms\//.test(url);
}

/** Fetch a private upload and return an object URL (caller must revoke it). */
export async function fetchProtectedObjectUrl(storedUrl) {
  const token = pickToken();
  const rel = String(storedUrl).replace(/^\/?(uploads\/)?/, '');
  const res = await axios.get(`${API_BASE}/api/v1/form-files/view`, {
    params: { path: rel },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    responseType: 'blob',
    timeout: 60_000,
  });
  return URL.createObjectURL(res.data);
}

/** Force a browser download of a private upload. */
export async function downloadProtectedFile(storedUrl, filename) {
  const objUrl = await fetchProtectedObjectUrl(storedUrl);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

/**
 * React hook: resolve a stored upload ref to a usable object URL. Protected
 * refs are streamed via the authenticated route; everything else passes through
 * unchanged. Returns { src, loading, error }. Revokes the object URL on unmount.
 */
export function useProtectedFileUrl(storedUrl) {
  const [state, setState] = useState({ src: null, loading: false, error: null });

  useEffect(() => {
    if (!storedUrl) { setState({ src: null, loading: false, error: null }); return undefined; }
    if (!isProtectedUrl(storedUrl)) { setState({ src: storedUrl, loading: false, error: null }); return undefined; }

    let alive = true;
    let created = null;
    setState({ src: null, loading: true, error: null });
    fetchProtectedObjectUrl(storedUrl)
      .then((url) => { if (alive) { created = url; setState({ src: url, loading: false, error: null }); } })
      .catch((err) => { if (alive) setState({ src: null, loading: false, error: err?.message ?? 'Failed to load file.' }); });

    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [storedUrl]);

  return state;
}
