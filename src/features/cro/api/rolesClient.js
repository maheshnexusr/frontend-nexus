/**
 * rolesClient — real API client for CRO Roles.
 *
 * The UI stores permissions as a nested object:
 *   { groupKey: { featureKey: { permKey: boolean } } }
 *
 * The API sends/receives permissions as a flat array:
 *   [{ feature_name: "Masters.EmailTemplates", can_view: true, can_create: false, … }]
 *
 * IMPORTANT: feature_name MUST be the canonical PascalCase key that the
 * backend's permission resolver recognises. Sending the human-readable
 * display label (e.g. "Email Templates") returns 200 OK but is silently
 * dropped — every leaf comes back `false` from /profile/me/permissions and
 * the role effectively has no access. The CANONICAL_FEATURE_NAMES table
 * below is the contract.
 *
 * This module converts between UI nested object and API flat array, and
 * keeps display labels and canonical keys cleanly separated.
 */

import axiosClient from '@/api/axiosClient';
import { PERMISSION_GROUPS, buildPermissions } from '@/features/cro/constants/permissionsSchema';

/* ── Canonical feature_name keys recognised by the backend ──────────────────
 *
 * Pattern: `{GroupLabelPascalCase}.{FeatureLabelPascalCase}` for most
 * features; ActivityLog and WorkspaceSelection are top-level (no group
 * prefix). These are exact, case-sensitive strings — see the backend's
 * "Fix: Role permission updates" memo. Mismatches are silently ignored
 * server-side, so the contract MUST be kept in sync here.
 *
 * Keyed by `${group.key}.${feature.key}` (the UI's nested-path identifier)
 * so the conversion is a single hash lookup in both directions.
 */
const CANONICAL_FEATURE_NAMES = {
  'dashboard.studyPortfolio':         'Dashboard.StudyPortfolioOverview',
  'dashboard.teamUtilization':        'Dashboard.CROTeamUtilization',
  'clinicalPrograms.sponsors':        'ClinicalPrograms.Sponsors',
  'clinicalPrograms.studies':         'ClinicalPrograms.Studies',
  'teamAdmin.teamMembers':            'CROTeamAdministration.TeamMembers',
  'teamAdmin.rolesPermissions':       'CROTeamAdministration.RolesPermissions',
  'masters.emailTemplates':           'Masters.EmailTemplates',
  'masters.studyPhases':              'Masters.StudyPhases',
  'masters.country':                  'Masters.Country',
  'masters.locations':                'Masters.Locations',
  'masters.regions':                  'Masters.Regions',
  'masters.annotations':              'Masters.Annotations',
  // Activity Log lives under Masters in the UI's PERMISSION_GROUPS but the
  // backend treats it as top-level — no group prefix.
  'masters.activityLog':              'ActivityLog',
};

/** Reverse lookup: canonical name → [groupKey, featureKey]. Built once. */
const CANONICAL_TO_NESTED_PATH = (() => {
  const out = new Map();
  for (const [path, canonical] of Object.entries(CANONICAL_FEATURE_NAMES)) {
    out.set(canonical, path.split('.'));
    // Tolerate any casing the backend round-trips — match case-insensitively.
    out.set(canonical.toLowerCase(), path.split('.'));
  }
  return out;
})();

/* ── Permissions: API flat array → nested UI object ─────────────────────── */
function apiPermsToNested(apiPerms) {
  if (!Array.isArray(apiPerms) || apiPerms.length === 0) return buildPermissions(false);

  const result = buildPermissions(false);

  for (const p of apiPerms) {
    const rawName = p.featurename ?? p.featureName ?? p.feature_name ?? '';
    // Prefer canonical-key match. Fall back to legacy display-label match for
    // any rows that pre-date the canonical contract (so existing data still
    // displays correctly while old labels are being migrated).
    let groupKey, featureKey;
    const canonicalHit = CANONICAL_TO_NESTED_PATH.get(rawName) ?? CANONICAL_TO_NESTED_PATH.get(rawName.toLowerCase());
    if (canonicalHit) {
      [groupKey, featureKey] = canonicalHit;
    } else {
      const lower = rawName.toLowerCase();
      outer: for (const group of PERMISSION_GROUPS) {
        for (const feature of group.features) {
          if (feature.label.toLowerCase() === lower) {
            groupKey   = group.key;
            featureKey = feature.key;
            break outer;
          }
        }
      }
    }
    if (!groupKey || !featureKey) continue;

    const apiMap = {
      view:          p.canview      ?? p.canView      ?? p.can_view      ?? false,
      create:        p.cancreate    ?? p.canCreate    ?? p.can_create    ?? false,
      edit:          p.canedit      ?? p.canEdit      ?? p.can_edit      ?? false,
      delete:        p.candelete    ?? p.canDelete    ?? p.can_delete    ?? false,
      export:        p.canexport    ?? p.canExport    ?? p.can_export    ?? false,
      duplicate:     p.canduplicate ?? p.canDuplicate ?? p.can_duplicate ?? false,
      locked:        p.canlock      ?? p.canLock      ?? p.can_lock      ?? false,
      import:        p.canimport    ?? p.canImport    ?? p.can_import    ?? false,
      configuration: p.canconfigure ?? p.canConfigure ?? p.can_configure ?? false,
      publish:       p.canpublish   ?? p.canPublish   ?? p.can_publish   ?? false,
    };

    result[groupKey][featureKey] = result[groupKey][featureKey] ?? {};
    const group = PERMISSION_GROUPS.find((g) => g.key === groupKey);
    const feature = group?.features.find((f) => f.key === featureKey);
    feature?.perms.forEach(({ key }) => {
      result[groupKey][featureKey][key] = apiMap[key] ?? false;
    });
  }

  return result;
}

/* ── Permissions: nested UI object → API flat array ──────────────────────
 *
 * Backend expects strict snake_case keys: feature_name, can_view, can_create,
 * can_edit, can_delete, can_export, can_duplicate, can_lock, can_import,
 * can_configure, can_publish. Missing can_* keys are treated as false.
 *
 * `feature_name` MUST be the canonical PascalCase key from
 * CANONICAL_FEATURE_NAMES (e.g. "Masters.EmailTemplates", "ActivityLog"),
 * NOT the human-readable display label. Sending the display label returns
 * 200 OK but is silently ignored server-side.
 *
 * Two action-name mismatches between UI and API:
 *   UI `locked`        → API `can_lock`
 *   UI `configuration` → API `can_configure`
 *
 * Write keys as snake_case literals (not camelCase) so the axiosClient
 * deepToSnake interceptor is a no-op on them.
 */
function nestedPermsToApi(permsObj) {
  const result = [];
  for (const group of PERMISSION_GROUPS) {
    for (const feature of group.features) {
      const canonical = CANONICAL_FEATURE_NAMES[`${group.key}.${feature.key}`];
      // Skip any feature without a known canonical mapping — sending the
      // raw label would be silently dropped server-side AND produce a
      // misleading "I saved" toast in the UI.
      if (!canonical) continue;

      const fp = permsObj?.[group.key]?.[feature.key] ?? {};
      result.push({
        feature_name:  canonical,
        can_view:      fp.view          ?? false,
        can_create:    fp.create        ?? false,
        can_edit:      fp.edit          ?? false,
        can_delete:    fp.delete        ?? false,
        can_export:    fp.export        ?? false,
        can_duplicate: fp.duplicate     ?? false,
        can_lock:      fp.locked        ?? false,
        can_import:    fp.import        ?? false,
        can_configure: fp.configuration ?? false,
        can_publish:   fp.publish       ?? false,
      });
    }
  }
  return result;
}

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:          raw.role_id        ?? raw.id,
    name:        raw.role_name      ?? raw.name ?? '',
    description: raw.description    ?? '',
    isSystem:    raw.is_system_role ?? raw.isSystem ?? false,
    // Convert API flat array → nested UI object so the form can consume it
    permissions: apiPermsToNested(raw.permissions ?? []),
    createdAt:   raw.created_at     ?? raw.createdAt,
    updatedAt:   raw.updated_at     ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? res?.roles ?? []);
  return arr.map(normalize);
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const rolesClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/roles');
    return extractList(res);
  },

  async getById(id) {
    const res = await axiosClient.get(`/api/v1/roles/${id}`);
    return normalize(res?.item ?? res);
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/roles', {
      role_name:   data.name,
      description: data.description ?? '',
      // data.permissions is the nested UI object — convert to API array
      permissions: nestedPermsToApi(data.permissions),
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/roles/${id}`, {
      role_name:   data.name,
      description: data.description ?? '',
      permissions: nestedPermsToApi(data.permissions),
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/roles/${id}`);
  },

  // Validation stubs — backend enforces uniqueness
  nameExists: () => Promise.resolve(false),
  isInUse:    () => Promise.resolve(false),
};
