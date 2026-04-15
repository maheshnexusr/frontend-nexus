/**
 * rolesClient — real API client for CRO Roles.
 *
 * The UI stores permissions as a nested object:
 *   { groupKey: { featureKey: { permKey: boolean } } }
 *
 * The API sends/receives permissions as a flat array:
 *   [{ feature_name: "Sponsors", can_view: true, can_create: false, … }]
 *
 * This module converts between the two formats.
 */

import axiosClient from '@/api/axiosClient';
import { PERMISSION_GROUPS, buildPermissions } from '@/features/cro/constants/permissionsSchema';

/* ── Permissions: API flat array → nested UI object ─────────────────────── */
function apiPermsToNested(apiPerms) {
  if (!Array.isArray(apiPerms) || apiPerms.length === 0) return buildPermissions(false);

  const result = buildPermissions(false);

  for (const p of apiPerms) {
    const featureName = (p.featureName ?? p.feature_name ?? '').toLowerCase();
    for (const group of PERMISSION_GROUPS) {
      for (const feature of group.features) {
        if (feature.label.toLowerCase() === featureName) {
          result[group.key][feature.key] = {};
          feature.perms.forEach(({ key }) => {
            // Map API field names to internal perm keys
            const apiMap = {
              view:          p.canView      ?? p.can_view      ?? false,
              create:        p.canCreate    ?? p.can_create    ?? false,
              edit:          p.canEdit      ?? p.can_edit      ?? false,
              delete:        p.canDelete    ?? p.can_delete    ?? false,
              export:        p.canExport    ?? p.can_export    ?? false,
              duplicate:     p.canDuplicate ?? p.can_duplicate ?? false,
              locked:        p.canLock      ?? p.can_lock      ?? false,
              import:        p.canImport    ?? p.can_import    ?? false,
              configuration: p.canConfigure ?? p.can_configure ?? false,
              publish:       p.canPublish   ?? p.can_publish   ?? false,
            };
            result[group.key][feature.key][key] = apiMap[key] ?? false;
          });
        }
      }
    }
  }

  return result;
}

/* ── Permissions: nested UI object → API flat array ─────────────────────── */
function nestedPermsToApi(permsObj) {
  const result = [];
  for (const group of PERMISSION_GROUPS) {
    for (const feature of group.features) {
      const fp = permsObj?.[group.key]?.[feature.key] ?? {};
      result.push({
        feature_name:  feature.label,
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
