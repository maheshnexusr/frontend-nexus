/**
 * profileClient — calls /api/v1/profile/me/* against whichever scope's
 * token is currently active.
 *
 * Token priority (matches formsAxiosClient):
 *   1. sponsorViewToken    (CRO viewing a sponsor workspace)
 *   2. sponsorAccessToken  (direct sponsor login)
 *   3. siteAccessToken     (site personnel — PI / Coordinator / etc.)
 *   4. accessToken         (CRO)
 *
 * The single endpoint /profile/me/permissions returns a unified response
 * (see normalize) covering CRO, sponsor, and site scopes — the backend
 * decides which based on the Bearer token presented.
 */

import axios from 'axios';
import { normalizeError } from './apiHelpers';

const BASE_URL = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

function pickToken() {
  return (
    localStorage.getItem('sponsorViewToken')   ||
    localStorage.getItem('sponsorAccessToken') ||
    localStorage.getItem('siteAccessToken')    ||
    localStorage.getItem('accessToken')        ||
    null
  );
}

client.interceptors.request.use((config) => {
  const token = pickToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (err) => Promise.reject(normalizeError(err)));

client.interceptors.response.use(
  (response) => response.data,
  (error)    => Promise.reject(normalizeError(error)),
);

/* ── Normalizer ─────────────────────────────────────────────────────────── */

function normalizeAssignedStudies(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => ({
    studyId:            s.study_id           ?? s.studyId           ?? '',
    studyTitle:         s.study_title        ?? s.studyTitle        ?? '',
    sponsorId:          s.sponsor_id         ?? s.sponsorId         ?? '',
    sponsorName:        s.sponsor_name       ?? s.sponsorName       ?? '',
    sponsorPermissions: s.sponsor_permissions ?? s.sponsorPermissions ?? null,
  })).filter((s) => s.studyId);
}

/**
 * Normalize the unified permissions response. Scope-agnostic — returns the
 * full payload with consistent camelCase keys; callers apply it to the
 * appropriate scope store.
 */
export function normalizePermissionsResponse(raw) {
  const o = raw?.item ?? raw?.data ?? raw ?? {};
  return {
    success:        o.success ?? true,
    scope:          o.scope ?? null,                    // 'cro' | 'sponsor' | 'site'
    model:          o.model ?? 'tree',
    roleId:         o.role_id        ?? o.roleId        ?? '',
    roleName:       o.role_name      ?? o.roleName      ?? '',
    description:    o.description    ?? '',
    isSystemRole:   o.is_system_role ?? o.isSystemRole  ?? false,
    permissions:    o.permissions    ?? null,
    studyId:        o.study_id       ?? o.studyId       ?? '',
    siteId:         o.site_id        ?? o.siteId        ?? '',
    environment:    o.environment    ?? '',
    assignedStudies: normalizeAssignedStudies(
      o.assigned_studies ?? o.assignedStudies ?? [],
    ),
  };
}

export const profileClient = {
  /**
   * GET /api/v1/profile/me/permissions
   *
   * Returns the unified, normalized permissions payload for whichever scope
   * the active Bearer token belongs to. Call this:
   *   • once after every login
   *   • on app boot when a token exists
   *   • after any role/study assignment change
   */
  async fetchMyPermissions() {
    const res = await client.get('/api/v1/profile/me/permissions');
    return normalizePermissionsResponse(res);
  },
};

export default profileClient;
