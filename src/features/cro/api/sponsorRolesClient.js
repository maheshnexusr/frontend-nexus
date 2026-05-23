/**
 * sponsorRolesClient — API client for Sponsor Roles (/api/v1/sponsor-roles).
 *
 * The form UI stores permissions as a nested object:
 *   { groupKey: { featureKey: { permKey: boolean } } }
 * The API sends/receives a flat array:
 *   [{ feature_name, can_view, can_create, … }]
 *
 * Sponsor feature_name values are the leaf keys directly (dashboard,
 * data_capture, …) — no PascalCase canonical mapping like CRO roles.
 */

import axiosClient from '@/api/axiosClient';
import {
  SPONSOR_PERMISSION_GROUPS,
  buildPermissions,
} from '@/features/cro/constants/sponsorPermissionsSchema';

// featureKey → groupKey, built once.
const FEATURE_TO_GROUP = (() => {
  const out = {};
  for (const group of SPONSOR_PERMISSION_GROUPS) {
    for (const feature of group.features) out[feature.key] = group.key;
  }
  return out;
})();

/* ── API flat array → nested UI object ──────────────────────────────────── */
export function apiPermsToNested(apiPerms) {
  const result = buildPermissions(false);
  if (!Array.isArray(apiPerms)) return result;

  for (const p of apiPerms) {
    const name = p.feature_name ?? p.featureName ?? p.featurename ?? '';
    const groupKey = FEATURE_TO_GROUP[name];
    if (!groupKey) continue;

    const am = {
      view:      p.can_view      ?? p.canView      ?? p.canview      ?? false,
      create:    p.can_create    ?? p.canCreate    ?? p.cancreate    ?? false,
      edit:      p.can_edit      ?? p.canEdit      ?? p.canedit      ?? false,
      delete:    p.can_delete    ?? p.canDelete    ?? p.candelete    ?? false,
      export:    p.can_export    ?? p.canExport    ?? p.canexport    ?? false,
      import:    p.can_import    ?? p.canImport    ?? p.canimport    ?? false,
      publish:   p.can_publish   ?? p.canPublish   ?? p.canpublish   ?? false,
      approve:   p.can_approve   ?? p.canApprove   ?? p.canapprove   ?? false,
      lock:      p.can_lock      ?? p.canLock      ?? p.canlock      ?? false,
      configure: p.can_configure ?? p.canConfigure ?? p.canconfigure ?? false,
      verify:    p.can_verify    ?? p.canVerify    ?? p.canverify    ?? false,
      sign:      p.can_sign      ?? p.canSign      ?? p.cansign      ?? false,
      freeze:    p.can_freeze    ?? p.canFreeze    ?? p.canfreeze    ?? false,
    };

    const feature = SPONSOR_PERMISSION_GROUPS
      .find((g) => g.key === groupKey)
      .features.find((f) => f.key === name);
    result[groupKey][name] = result[groupKey][name] ?? {};
    feature.perms.forEach(({ key }) => {
      result[groupKey][name][key] = Boolean(am[key]);
    });
  }
  return result;
}

/* ── Nested UI object → API flat array ──────────────────────────────────── */
export function nestedPermsToApi(permsObj) {
  const result = [];
  for (const group of SPONSOR_PERMISSION_GROUPS) {
    for (const feature of group.features) {
      const fp = permsObj?.[group.key]?.[feature.key] ?? {};
      result.push({
        feature_name:  feature.key,
        can_view:      Boolean(fp.view),
        can_create:    Boolean(fp.create),
        can_edit:      Boolean(fp.edit),
        can_delete:    Boolean(fp.delete),
        can_export:    Boolean(fp.export),
        can_import:    Boolean(fp.import),
        can_publish:   Boolean(fp.publish),
        can_approve:   Boolean(fp.approve),
        can_lock:      Boolean(fp.lock),
        can_configure: Boolean(fp.configure),
        can_verify:    Boolean(fp.verify),
        can_sign:      Boolean(fp.sign),
        can_freeze:    Boolean(fp.freeze),
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
export const sponsorRolesClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/sponsor-roles');
    return extractList(res);
  },

  async getById(id) {
    const res = await axiosClient.get(`/api/v1/sponsor-roles/${id}`);
    return normalize(res?.item ?? res);
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/sponsor-roles', {
      role_name:   data.name,
      description: data.description ?? '',
      permissions: nestedPermsToApi(data.permissions),
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/sponsor-roles/${id}`, {
      role_name:   data.name,
      description: data.description ?? '',
      permissions: nestedPermsToApi(data.permissions),
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/sponsor-roles/${id}`);
  },

  // Backend enforces uniqueness + in-use checks; these keep the form/list
  // call-sites identical to the CRO rolesClient.
  nameExists: () => Promise.resolve(false),
  isInUse:    () => Promise.resolve(false),
};
