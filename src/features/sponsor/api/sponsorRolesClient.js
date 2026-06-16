/**
 * sponsorRolesClient — Site Roles for the active sponsor study.
 *
 * Spec §13.2 — /api/v1/sponsor/workspace/site-roles (CRUD).
 * Sponsor Bearer + (study_id, environment) context auto-attached by
 * sponsorAxiosClient.
 *
 * `duplicate` and `toggleStatus` are non-spec extensions preserved for the UI.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import { buildEmptyPermissions } from '../components/roles/permissionsTree';

const BASE = '/api/v1/sponsor/workspace/site-roles';
// Auth-only reference list for form dropdowns — no `site_roles` permission needed.
const LOOKUP = '/api/v1/sponsor/workspace/lookups/site-roles';

function extractRoleList(res) {
  let arr =
       (Array.isArray(res)              ? res
      : Array.isArray(res?.items)       ? res.items
      : Array.isArray(res?.data)        ? res.data
      : Array.isArray(res?.roles)       ? res.roles
      : Array.isArray(res?.site_roles)  ? res.site_roles
      : Array.isArray(res?.data?.items) ? res.data.items
      : Array.isArray(res?.data?.roles) ? res.data.roles
      : []);
  if (!Array.isArray(arr)) arr = [];
  return arr.map(normalizeRole);
}

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeRole(raw) {
  return {
    id:           raw.id            ?? raw.role_id      ?? '',
    roleName:     raw.role_name     ?? raw.roleName     ?? '',
    description:  raw.description   ?? '',
    status:       raw.status        ?? 'Active',
    isSystem:     raw.is_system     ?? raw.isSystem     ?? false,
    userCount:    raw.user_count    ?? raw.userCount    ?? 0,
    createdBy:    raw.created_by    ?? raw.createdBy    ?? '',
    createdAt:    raw.created_at    ?? raw.createdAt    ?? '',
    updatedAt:    raw.updated_at    ?? raw.updatedAt    ?? '',
    permissions:  raw.permissions   ?? buildEmptyPermissions(),
    // When true, personnel created under this role must be assigned a consent
    // form at invite time.
    consentRequired:
      raw.consent_required ?? raw.consentRequired ?? false,
    // Per-role dashboard widget whitelist. null/undefined → use default
    // category-leaf gating; array (possibly empty) → explicit whitelist.
    dashboardWidgetKeys:
      raw.dashboard_widget_keys != null ? raw.dashboard_widget_keys
      : raw.dashboardWidgetKeys != null ? raw.dashboardWidgetKeys
      : null,
  };
}

// ── Client ─────────────────────────────────────────────────────────────────────

export const sponsorRolesClient = {
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters.status && filters.status !== 'All') params.status = filters.status;
    const res = await sponsorAxiosClient.get(BASE, { params });
    return extractRoleList(res);
  },

  /** GET /lookups/site-roles — auth-only reference list for form dropdowns
   *  (role picker on the personnel/consent forms). */
  async lookup(_studyId, filters = {}) {
    const params = {};
    if (filters.status && filters.status !== 'All') params.status = filters.status;
    const res = await sponsorAxiosClient.get(LOOKUP, { params });
    return extractRoleList(res);
  },

  async getById(_studyId, roleId) {
    const res = await sponsorAxiosClient.get(`${BASE}/${roleId}`);
    return normalizeRole(res?.item ?? res?.role ?? res?.site_role ?? res?.data ?? res ?? {});
  },

  async create(_studyId, data) {
    const res = await sponsorAxiosClient.post(BASE, {
      role_name:    data.roleName,
      description:  data.description,
      status:       data.status ?? 'Active',
      permissions:  data.permissions,
      dashboard_widget_keys: data.dashboardWidgetKeys ?? null,
      consent_required: Boolean(data.consentRequired),
    });
    return normalizeRole(res?.item ?? res?.role ?? res?.site_role ?? res?.data ?? res ?? {});
  },

  async update(_studyId, roleId, data) {
    // Spec §4.2 uses PATCH for site-role updates.
    const res = await sponsorAxiosClient.patch(`${BASE}/${roleId}`, {
      role_name:   data.roleName,
      description: data.description,
      status:      data.status,
      permissions: data.permissions,
      dashboard_widget_keys: data.dashboardWidgetKeys ?? null,
      consent_required: Boolean(data.consentRequired),
    });
    return normalizeRole(res?.item ?? res?.role ?? res?.site_role ?? res?.data ?? res ?? {});
  },

  async delete(_studyId, roleId) {
    await sponsorAxiosClient.delete(`${BASE}/${roleId}`);
  },

  // ── Non-spec extensions ───────────────────────────────────────────────────
  async duplicate(_studyId, roleId, newName) {
    const res = await sponsorAxiosClient.post(`${BASE}/${roleId}/duplicate`, {
      role_name: newName,
    });
    return normalizeRole(res?.item ?? res ?? {});
  },

  async toggleStatus(_studyId, roleId, status) {
    const res = await sponsorAxiosClient.patch(`${BASE}/${roleId}/status`, { status });
    return normalizeRole(res?.item ?? res ?? {});
  },
};
