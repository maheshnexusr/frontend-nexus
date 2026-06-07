/**
 * permissionsTree.js — sponsor-side adapter over the canonical permissions
 * schema.
 *
 * The single source of truth is `@/features/cro/constants/sponsorPermissionsSchema`
 * (the CRO uses it to author sponsor roles; the sponsor workspace uses this
 * adapter to author its own roles). Keeping both surfaces on the same schema
 * prevents the actions / leaves drifting — the previous duplicate-tree setup
 * left "subjects", "snapshot", "reject", "sla_settings" missing on one side
 * or the other depending on which screen the user opened.
 *
 * The sponsor "Roles" page renders a flat checkbox grid (one row per leaf, one
 * column per action) rather than the CRO's grouped Sponsor-Roles editor. The
 * helpers below flatten the grouped schema into that shape on demand.
 */

import {
  SPONSOR_PERMISSION_GROUPS,
  buildPermissions as buildGroupedPermissions,
  countPermissions as countGrouped,
} from '@/features/cro/constants/sponsorPermissionsSchema';

// ── Flatten to (leaf-keyed) permissions tree ────────────────────────────────

/** Build a zeroed permissions object keyed by leaf: { [leafKey]: { [perm]: false } }. */
export function buildEmptyPermissions() {
  const out = {};
  for (const g of SPONSOR_PERMISSION_GROUPS) {
    for (const f of g.features) {
      out[f.key] = {};
      for (const p of f.perms) out[f.key][p.key] = false;
    }
  }
  return out;
}

/** Build a full-access permissions object (all true). */
export function buildFullPermissions() {
  const out = {};
  for (const g of SPONSOR_PERMISSION_GROUPS) {
    for (const f of g.features) {
      out[f.key] = {};
      for (const p of f.perms) out[f.key][p.key] = true;
    }
  }
  return out;
}

/** Count enabled / total individual permissions in a leaf-keyed tree. */
export function countPermissions(permsObj) {
  let total = 0;
  let enabled = 0;
  for (const g of SPONSOR_PERMISSION_GROUPS) {
    for (const f of g.features) {
      for (const p of f.perms) {
        total += 1;
        if (permsObj?.[f.key]?.[p.key]) enabled += 1;
      }
    }
  }
  return { enabled, total };
}

// ── Feature tree (consumed by the sponsor Roles editor's grid renderer) ─────

/**
 * Render-friendly shape with the same nesting the editor expects.
 * Group nodes have `children`; leaves have `perms` (array of action keys).
 */
export const FEATURE_TREE = SPONSOR_PERMISSION_GROUPS.map((g) => ({
  key:      g.key,
  label:    g.group,
  isGroup:  true,
  children: g.features.map((f) => ({
    key:   f.key,
    label: f.label,
    desc:  f.desc,
    perms: f.perms.map((p) => p.key),
  })),
}));

/** Flat array of every leaf node, in render order. */
export function getLeaves() {
  return FEATURE_TREE.flatMap((g) => g.children);
}

// ── Action column metadata (union of every action used across leaves) ───────

const ACTION_LABELS = (() => {
  const labels = {};
  for (const g of SPONSOR_PERMISSION_GROUPS) {
    for (const f of g.features) {
      for (const p of f.perms) labels[p.key] = p.label;
    }
  }
  return labels;
})();

export const ALL_PERMS = Object.keys(ACTION_LABELS);
export const PERM_LABELS = ACTION_LABELS;

// ── Re-exports for callers that prefer the grouped shape ────────────────────

export {
  SPONSOR_PERMISSION_GROUPS,
  buildGroupedPermissions,
  countGrouped,
};

// ── Default system role permissions (preset starting points) ────────────────

function preset(grants) {
  const base = buildEmptyPermissions();
  for (const [leafKey, perms] of Object.entries(grants)) {
    if (!base[leafKey]) continue;
    for (const p of perms) {
      if (base[leafKey][p] !== undefined) base[leafKey][p] = true;
    }
  }
  return base;
}

export const DEFAULT_ROLE_PERMISSIONS = {
  'CRO Administrator': buildFullPermissions(),

  'Data Manager': preset({
    dashboard:         ['view', 'export'],
    data_capture:      ['view', 'create', 'edit', 'delete', 'export', 'activity_log'],
    subjects:          ['view', 'create', 'edit', 'data_capture', 'activity_log'],
    query_manager:     ['view', 'respond', 'reopen', 'escalate'],
    data_verification: ['view', 'verify'],
    reports:           ['view', 'create', 'export'],
    sites:             ['view'],
    site_personnel:    ['view'],
  }),

  'Data Reviewer': preset({
    dashboard:         ['view', 'export'],
    data_verification: ['view', 'verify'],
    query_manager:     ['view', 'respond'],
    reports:           ['view', 'export'],
  }),

  'Site Monitor': preset({
    dashboard:      ['view', 'export'],
    sites:          ['view'],
    site_personnel: ['view'],
    reports:        ['view', 'export'],
  }),
};
