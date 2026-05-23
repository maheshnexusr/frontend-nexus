/**
 * studiesClient — real API client for Studies.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';
import { nestedPermsToApi, apiPermsToNested } from '@/features/cro/api/sponsorRolesClient';

/* ── snake_case → camelCase (used when hydrating persisted form structure) ── */
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function deepToCamel(value) {
  if (Array.isArray(value)) return value.map(deepToCamel);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [toCamel(k), deepToCamel(v)]),
  );
} 

/**
 * pickBool — first boolean across multiple sources, preserving `undefined`
 * when none exists. Used for Step 3 module toggles where a *missing* flag
 * must not be confused with an explicit `false`.
 *
 * Usage: pickBool(cfg, raw, 'enable_query_manager', 'enableQueryManager')
 *   1. cfg[snake]   2. cfg[camel]   3. raw[snake]   4. raw[camel]
 */
function pickBool(cfg, raw, snake, camel) {
  for (const src of [cfg, raw]) {
    if (!src) continue;
    if (typeof src[snake] === 'boolean') return src[snake];
    if (typeof src[camel] === 'boolean') return src[camel];
  }
  return undefined;
}

/* ── region_covered → { type, id } ──────────────────────────────────────────
 * Backend stores coverage as "REGION:<id>" (EDC) or "COUNTRY:<id>" (Survey/ePRO).
 */
function parseCoverage(raw) {
  if (typeof raw !== 'string' || !raw.includes(':')) return { type: '', id: '' };
  const [type, id] = raw.split(':');
  return { type, id };
}

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  // Single-select scope: pick the first true flag (EDC > Survey > ePRO).
  let scope = '';
  if (raw.scope_edc    ?? raw.scopeEdc)    scope = 'EDC';
  else if (raw.scope_survey ?? raw.scopeSurvey) scope = 'Survey';
  else if (raw.scope_epro   ?? raw.scopeEpro)   scope = 'ePRO';

  const coverage = parseCoverage(raw.region_covered ?? raw.regionCovered ?? '');

  const cfg = raw.configuration ?? {};

  return {
    id:                  raw.study_id           ?? raw.id,
    studyId:             raw.protocol_number    ?? raw.protocolNumber ?? raw.studyId ?? '',
    protocolNumber:      raw.protocol_number    ?? raw.protocolNumber ?? '',
    studyTitle:          raw.study_title        ?? raw.studyTitle ?? '',
    studyPhaseId:        raw.study_phase_id     ?? raw.studyPhaseId ?? '',
    studyPhaseName:      raw.phase_name         ?? raw.studyPhaseName ?? '',
    scope,
    scopeEdc:            Boolean(raw.scope_edc    ?? raw.scopeEdc),
    scopeSurvey:         Boolean(raw.scope_survey ?? raw.scopeSurvey),
    scopeEpro:           Boolean(raw.scope_epro   ?? raw.scopeEpro),
    therapeuticArea:     raw.therapeutic_area   ?? raw.therapeuticArea ?? '',
    studyDescription:    raw.study_description  ?? raw.studyDescription ?? '',
    sponsorId:           raw.sponsor_id         ?? raw.sponsorId ?? '',
    sponsorName:         raw.sponsor_name       ?? raw.sponsorName ?? '',
    // Per-study sponsor workspace permissions (Study Wizard Step 1) — nested
    // matrix shape for the FE. Empty array → all-false matrix.
    sponsorPermissions:  apiPermsToNested(raw.sponsor_permissions ?? raw.sponsorPermissions ?? []),
    startDate:           raw.start_date         ?? raw.startDate ?? '',
    expectedEndDate:     raw.expected_end_date  ?? raw.expectedEndDate ?? '',
    maxSites:            raw.max_sites          ?? raw.maxSites ?? null,
    maxEnrollments:      raw.max_enrollments    ?? raw.maxEnrollments ?? null,
    regionCovered:       raw.region_covered     ?? raw.regionCovered ?? '',
    coverageType:        coverage.type,
    coverageId:          coverage.id,
    regionId:            coverage.type === 'REGION'  ? coverage.id : '',
    countryId:           coverage.type === 'COUNTRY' ? coverage.id : '',
    randomizationMethod: raw.randomization_method ?? raw.randomizationMethod ?? '',
    status:              raw.status             ?? 'Draft',
    lastCompletedStep:   raw.last_completed_step ?? raw.lastCompletedStep ?? 0,
    currentEnvironment:  raw.current_environment ?? raw.currentEnvironment ?? '',
    tenantDbName:        raw.tenant_db_name     ?? raw.tenantDbName ?? '',
    // Flat module toggles from Step 3.
    //
    // CAUTION: do NOT eagerly coerce to a boolean with `Boolean(value)` —
    // that turns a *missing* field (undefined / null) into `false`, which
    // the downstream gating (studyConfigGating.readConfigFlag) then reads
    // as an explicit "disabled" instead of falling through to its default
    // ("missing → enabled"). The bug surfaces in the team-member
    // permissions matrix as enabled-in-Step-3 modules still being hidden.
    //
    // We accept the flag from any of these locations (in order):
    //   1. `raw.configuration.enable_*`            (snake_case)
    //   2. `raw.configuration.enable*Manager`      (camelCase)
    //   3. `raw.enable_*` / `raw.enable*Manager`   (top-level on `raw`)
    // and only normalise to a real boolean when one of those is itself a
    // boolean. Otherwise we leave it `undefined`.
    consentManager:      pickBool(cfg, raw, 'enable_consent_manager',      'enableConsentManager'),
    queryManager:        pickBool(cfg, raw, 'enable_query_manager',        'enableQueryManager'),
    dataManager:         pickBool(cfg, raw, 'enable_data_manager',         'enableDataManager'),
    verificationManager: pickBool(cfg, raw, 'enable_verification_manager', 'enableVerificationManager'),
    navigationBar:       pickBool(cfg, raw, 'enable_navigation_bar',       'enableNavigationBar'),
    configuration:       raw.configuration      ?? null,
    formId:              raw.form_definition?.form_id ?? raw.formDefinition?.formId ?? null,
    formDefinition:      normalizeFormDefinition(raw.form_definition ?? raw.formDefinition),
    triggers:            raw.triggers           ?? [],
    teamAssignments:     raw.team_assignments   ?? raw.teamAssignments ?? [],
    assignments:         normalizeAssignments(raw.team_assignments ?? raw.teamAssignments),
    versions:            (raw.versions ?? []).map(normalizeVersion),
    createdAt:           raw.created_at         ?? raw.createdAt,
    updatedAt:           raw.updated_at         ?? raw.updatedAt, 
  };
}

/**
 * Reshape the persisted form_definition payload for the study form slice.
 * Backend shape: { form_id, form_structure: { blocks, submission_controls }, version, ... }
 * Slice expects:  { blocks, submissionControls, triggers, comments }
 * Nested field keys (help_text, default_value, min_length, etc.) are also
 * deep-converted to camelCase to round-trip cleanly with the snake-case
 * request interceptor on save.
 */
function normalizeFormDefinition(raw) {
  if (!raw) return null;
  const struct = raw.form_structure ?? raw.formStructure ?? {};
  const blocks             = deepToCamel(struct.blocks ?? []);
  const submissionControls = deepToCamel(struct.submission_controls ?? struct.submissionControls ?? {});
  return {
    blocks,
    submissionControls,
    triggers: deepToCamel(struct.triggers ?? raw.triggers ?? []),
    comments: deepToCamel(struct.comments ?? raw.comments ?? []),
  };
}

function normalizeAssignments(list) {
  if (!Array.isArray(list)) return [];
  return list.map((a) => ({
    id:           a.assignmentId ?? a.assignment_id ?? a.id,
    memberId:     a.teamMemberId ?? a.team_member_id ?? a.memberId ?? '',
    memberName:   a.fullName     ?? a.full_name     ?? a.memberName ?? '',
    memberEmail:  a.emailAddress ?? a.email_address ?? a.memberEmail ?? '',
    croRole:      a.croRole      ?? a.cro_role      ?? a.roleName ?? '',
    studyRole:    a.studyRole    ?? a.study_role    ?? '',
    assignedDate: a.assignedDate ?? a.assigned_date ?? a.createdAt ?? a.created_at ?? '',
  }));
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

/* Coerce single-string scope to the array shape the backend expects. */
function toScopes(data) {
  if (Array.isArray(data.scopes)) return data.scopes;
  if (Array.isArray(data.scope))  return data.scope;
  if (data.scope) return [data.scope];
  return [];
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

  // ── Step 1: Create study (POST) ──────────────────────────────────────────
  async create(data) {
    const res = await axiosClient.post('/api/v1/studies/step-1', {
      protocol_number:   data.studyId          ?? data.protocolNumber,
      study_title:       data.studyTitle,
      study_phase_id:    data.studyPhaseId,
      sponsor_id:        data.sponsorId,
      scopes:            toScopes(data),
      therapeutic_area:  data.therapeuticArea  || undefined,
      study_description: data.studyDescription || undefined,
      sponsor_permissions: data.sponsorPermissions
        ? nestedPermsToApi(data.sponsorPermissions)
        : undefined,
    });
    return normalize(res?.item ?? res);
  },

  // ── Step 1: Update basic info (PUT) ──────────────────────────────────────
  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/studies/${id}/step-1`, {
      protocol_number:   data.studyId          ?? data.protocolNumber,
      study_title:       data.studyTitle,
      study_phase_id:    data.studyPhaseId,
      sponsor_id:        data.sponsorId,
      scopes:            toScopes(data),
      therapeutic_area:  data.therapeuticArea  || undefined,
      study_description: data.studyDescription || undefined,
      sponsor_permissions: data.sponsorPermissions
        ? nestedPermsToApi(data.sponsorPermissions)
        : undefined,
    });
    return normalize(res?.item ?? res);
  },

  // ── Step 2: Timeline & Coverage ───────────────────────────────────────────
  async step2(id, data) {
    // coverage_type: 'REGION' for EDC, 'COUNTRY' for Survey/ePRO
    const res = await axiosClient.put(`/api/v1/studies/${id}/step-2`, {
      start_date:        data.startDate,
      expected_end_date: data.expectedEndDate,
      max_enrollments:   Number(data.maxEnrollments),
      coverage_type:     data.coverageType,          // 'COUNTRY' | 'REGION'
      coverage_id:       data.coverageId,
      max_sites:         data.maxSites ? Number(data.maxSites) : undefined,
    });
    return normalize(res?.item ?? res);
  },

  // ── Step 3: Module toggles ────────────────────────────────────────────────
  async step3(id, data) {
    const res = await axiosClient.put(`/api/v1/studies/${id}/step-3`, {
      enable_consent_manager:      Boolean(data.consentManager),
      enable_query_manager:        Boolean(data.queryManager),
      enable_data_manager:         Boolean(data.dataManager),
      enable_verification_manager: Boolean(data.verificationManager),
      enable_navigation_bar:       Boolean(data.navigationBar),
    });
    return normalize(res?.item ?? res);
  },

  // ── Step 4: Form structure + triggers ────────────────────────────────────
  async step4(id, data) {
    const res = await axiosClient.put(`/api/v1/studies/${id}/step-4`, {
      form_structure: data.formStructure ?? data.formDefinition ?? null,
      version:        data.version       ?? 1,
      triggers: (data.triggers ?? []).map((t) => ({
        trigger_condition:  t.triggerCondition,
        trigger_action:     t.triggerAction,      // 'Email' | 'Notification' | 'Both'
        trigger_recipients: t.triggerRecipients   ?? [],
        email_template_id:  t.emailTemplateId     ?? null,
        is_active:          t.isActive            ?? true,
      })),
    });
    return normalize(res?.item ?? res);
  },

  // ── Publish ───────────────────────────────────────────────────────────────
  async publish(studyId, publishConfig) {
    const res = await axiosClient.post(`/api/v1/studies/${studyId}/publish`, {
      environment: publishConfig.environment,
      status:      publishConfig.status || undefined,
    });
    return res?.item ?? res;
  },

  // ── Invitations ───────────────────────────────────────────────────────────
  async sendInvitations(studyId, payload) {
    // payload: { version_id, environment, recipients: [{ email, recipient_type }] }
    return axiosClient.post(`/api/v1/studies/${studyId}/invitations`, payload);
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

  // Validation stub — backend enforces uniqueness
  studyIdExists: () => Promise.resolve(false),
};
