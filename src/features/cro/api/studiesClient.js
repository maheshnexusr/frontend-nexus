/**
 * studiesClient — real API client for Studies.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:                  raw.study_id           ?? raw.id,
    studyId:             raw.protocol_number    ?? raw.protocolNumber ?? raw.studyId ?? '',
    protocolNumber:      raw.protocol_number    ?? raw.protocolNumber ?? '',
    studyTitle:          raw.study_title        ?? raw.studyTitle ?? '',
    studyPhaseId:        raw.study_phase_id     ?? raw.studyPhaseId ?? '',
    studyPhaseName:      raw.phase_name         ?? raw.studyPhaseName ?? '',
    scopeEdc:            raw.scope_edc          ?? false,
    scopeSurvey:         raw.scope_survey       ?? false,
    scopeEpro:           raw.scope_epro         ?? false,
    therapeuticArea:     raw.therapeutic_area   ?? raw.therapeuticArea ?? '',
    studyDescription:    raw.study_description  ?? raw.studyDescription ?? '',
    sponsorId:           raw.sponsor_id         ?? raw.sponsorId ?? '',
    sponsorName:         raw.sponsor_name       ?? raw.sponsorName ?? '',
    startDate:           raw.start_date         ?? raw.startDate ?? '',
    expectedEndDate:     raw.expected_end_date  ?? raw.expectedEndDate ?? '',
    maxSites:            raw.max_sites          ?? raw.maxSites ?? null,
    maxEnrollments:      raw.max_enrollments    ?? raw.maxEnrollments ?? null,
    regionCovered:       raw.region_covered     ?? raw.regionCovered ?? '',
    randomizationMethod: raw.randomization_method ?? raw.randomizationMethod ?? '',
    status:              raw.status             ?? 'Draft',
    lastCompletedStep:   raw.last_completed_step ?? raw.lastCompletedStep ?? 0,
    currentEnvironment:  raw.current_environment ?? raw.currentEnvironment ?? '',
    tenantDbName:        raw.tenant_db_name     ?? raw.tenantDbName ?? '',
    configuration:       raw.configuration      ?? null,
    formDefinition:      raw.form_definition    ?? null,
    triggers:            raw.triggers           ?? [],
    teamAssignments:     raw.team_assignments   ?? [],
    versions:            (raw.versions ?? []).map(normalizeVersion),
    createdAt:           raw.created_at         ?? raw.createdAt,
    updatedAt:           raw.updated_at         ?? raw.updatedAt,
  };
}

function normalizeVersion(v) {
  return {
    id:            v.version_id     ?? v.id,
    studyId:       v.study_id       ?? v.studyId,
    versionNumber: v.version_number ?? v.versionNumber,
    environment:   v.environment    ?? '',
    status:        v.status         ?? '',
    description:   v.description    ?? '',
    databaseName:  v.database_name  ?? v.databaseName ?? '',
    uatLink:       v.uat_link       ?? v.uatLink ?? null,
    liveLink:      v.live_link      ?? v.liveLink ?? null,
    publishedBy:   v.published_by   ?? v.publishedBy ?? '',
    publishedAt:   v.published_at   ?? v.publishedAt ?? '',
    isCurrent:     v.is_current     ?? false,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? res?.studies ?? []);
  return arr.map(normalize);
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const studiesClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/studies');
    return extractList(res);
  },

  async getById(id) {
    const res = await axiosClient.get(`/api/v1/studies/${id}`);
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/studies/${id}`);
  },

  // Step 1 create
  async create(data) {
    const res = await axiosClient.post('/api/v1/studies/step-1', {
      protocol_number:    data.protocolNumber ?? data.studyId,
      study_title:        data.studyTitle,
      study_phase_id:     data.studyPhaseId,
      sponsor_id:         data.sponsorId,
      scopes:             data.scopes ?? [],
      therapeutic_area:   data.therapeuticArea  || undefined,
      study_description:  data.studyDescription || undefined,
    });
    return normalize(res?.item ?? res);
  },

  // Generic step update
  async saveStep(id, step, data) {
    const res = await axiosClient.put(`/api/v1/studies/${id}/step-${step}`, data);
    return normalize(res?.item ?? res);
  },

  // Convenience aliases kept for wizard steps
  async update(id, data) {
    return studiesClient.saveStep(id, 1, {
      protocol_number:   data.protocolNumber ?? data.studyId,
      study_title:       data.studyTitle,
      study_phase_id:    data.studyPhaseId,
      sponsor_id:        data.sponsorId,
      scopes:            data.scopes ?? [],
      therapeutic_area:  data.therapeuticArea  || undefined,
      study_description: data.studyDescription || undefined,
    });
  },

  // Publish
  async publish(studyId, publishConfig) {
    const res = await axiosClient.post(`/api/v1/studies/${studyId}/publish`, {
      environment: publishConfig.environment,
      status:      publishConfig.status      || undefined,
      description: publishConfig.description || undefined,
    });
    return res?.item ?? res;
  },

  // Releases
  async getReleasesByStudyId(studyId) {
    const study = await studiesClient.getById(studyId);
    return study?.versions ?? [];
  },

  async getReleasesByProtocolId(protocolId) {
    const all = await studiesClient.list();
    const study = all.find((s) => s.protocolNumber === protocolId);
    return study?.versions ?? [];
  },

  async updateReleaseStatus(releaseId, status) {
    return axiosClient.patch(`/api/v1/studies/releases/${releaseId}`, { status });
  },

  // Invitations
  async sendInvitation(studyId, payload) {
    return axiosClient.post(`/api/v1/studies/${studyId}/invitations`, payload);
  },

  // Validation stub — backend enforces uniqueness
  studyIdExists: () => Promise.resolve(false),
};
