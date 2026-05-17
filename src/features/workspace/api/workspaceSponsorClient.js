/**
 * workspaceSponsorClient — CRO-side endpoints for entering a sponsor's
 * workspace in READ-ONLY mode.
 *
 * Endpoints:
 *   GET  /api/v1/workspace/sponsors                 → list viewable sponsors
 *   POST /api/v1/workspace/sponsors/:sponsorId/enter → mint a sponsor view token
 *
 * Both calls are authenticated with the CRO accessToken (uses axiosClient).
 * The returned sponsor view token is then stored separately and used for any
 * subsequent /api/v1/sponsor/* calls (see sponsorAxiosClient).
 */

import axiosClient from '@/api/axiosClient';

/* ── List response normalizer (snake_case API → camelCase UI) ────────────── */
function normalizeSponsorRow(raw) {
  return {
    id:               raw.sponsor_id          ?? raw.id,
    fullName:         raw.full_name           ?? raw.fullName         ?? '',
    organizationName: raw.organization_name   ?? raw.organizationName ?? '',
    email:            raw.email_address       ?? raw.email            ?? '',
    photograph:       raw.photograph_url      ?? raw.photograph_path  ?? raw.photograph ?? null,
    status:           raw.status              ?? 'Active',
    activeStudies:    raw.active_studies_count
                       ?? raw.activeStudiesCount
                       ?? raw.studies_count
                       ?? raw.studyCount
                       ?? null,
  };
}

function extractList(res) {
  const arr = Array.isArray(res)
    ? res
    : (res?.items ?? res?.sponsors ?? res?.data ?? []);
  return arr.map(normalizeSponsorRow);
}

/* ── /enter response normalizer ──────────────────────────────────────────── */
function normalizeEnterResponse(res) {
  const root = res?.item ?? res?.data ?? res;

  const accessToken = root?.access_token ?? root?.accessToken ?? null;

  const sponsorRaw = root?.sponsor ?? null;
  const sponsor = sponsorRaw ? {
    id:               sponsorRaw.sponsor_id        ?? sponsorRaw.id,
    fullName:         sponsorRaw.full_name         ?? sponsorRaw.fullName         ?? '',
    organizationName: sponsorRaw.organization_name ?? sponsorRaw.organizationName ?? '',
    email:            sponsorRaw.email_address     ?? sponsorRaw.email            ?? '',
    photograph:       sponsorRaw.photograph_url    ?? sponsorRaw.photograph_path  ?? sponsorRaw.photograph ?? null,
    status:           sponsorRaw.status            ?? 'Active',
  } : null;

  const userRaw = root?.user ?? null;
  const user = userRaw ? {
    id:       userRaw.user_id     ?? userRaw.id,
    fullName: userRaw.full_name   ?? userRaw.fullName ?? '',
    email:    userRaw.email_address ?? userRaw.email  ?? '',
    role:     userRaw.role_name   ?? userRaw.role     ?? 'Read-only Viewer',
  } : null;

  const studiesRaw = root?.studies ?? [];
  const studies = (Array.isArray(studiesRaw) ? studiesRaw : []).map((s) => ({
    id:              s.study_id        ?? s.id,
    title:           s.study_title     ?? s.title           ?? '',
    protocolNumber:  s.protocol_number ?? s.protocolNumber  ?? '',
    environment:     s.environment     ?? s.env             ?? null,
    status:          s.study_status    ?? s.status          ?? 'Active',
    therapeuticArea: s.therapeutic_area ?? s.therapeuticArea ?? '',
  }));

  return { accessToken, sponsor, user, studies };
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const workspaceSponsorClient = {
  /**
   * GET /api/v1/workspace/sponsors[?search=...]
   * Returns the list of sponsors the current CRO user can view.
   */
  async list({ search } = {}) {
    const params = search ? { search } : undefined;
    const res = await axiosClient.get('/api/v1/workspace/sponsors', { params });
    return extractList(res);
  },

  /**
   * POST /api/v1/workspace/sponsors/:sponsorId/enter
   * Mints a sponsor-view token (read-only) and returns sponsor + user + studies.
   */
  async enter(sponsorId) {
    const res = await axiosClient.post(
      `/api/v1/workspace/sponsors/${sponsorId}/enter`,
    );
    return normalizeEnterResponse(res);
  },
};
