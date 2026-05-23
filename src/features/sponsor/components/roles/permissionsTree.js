/**
 * permissionsTree.js
 * Single source of truth for the Sponsor Workspace feature/permission matrix.
 *
 * Structure:
 *   FEATURE_TREE  — ordered list of module groups (may have submodules)
 *   ALL_PERMS     — the full set of permission keys rendered as columns
 *   PERM_LABELS   — display labels for permission columns
 *   buildEmptyPermissions()  — returns a zeroed-out permissions object
 *   DEFAULT_ROLE_PERMISSIONS — preset permission sets for system roles
 */

// ── Column definitions ────────────────────────────────────────────────────────

export const ALL_PERMS = [
  'view', 'create', 'edit', 'delete', 'import', 'export', 'screenshot',
  'verify', 'sign', 'freeze', 'lock',
];

export const PERM_LABELS = {
  view:       'View',
  create:     'Create',
  edit:       'Edit',
  delete:     'Delete',
  import:     'Import',
  export:     'Export',
  screenshot: 'Screenshot',
  verify:     'Verify',
  sign:       'Sign',
  freeze:     'Freeze',
  lock:       'Lock',
};

// ── Feature tree ──────────────────────────────────────────────────────────────
// Each leaf node has: key, label, perms (subset of ALL_PERMS)
// Group nodes have: key, label, children

export const FEATURE_TREE = [
  {
    key:      'dashboard',
    label:    'Dashboard',
    perms:    ['view', 'export'],
  },
  {
    key:      'data_capture',
    label:    'Data Capture',
    perms:    ['view', 'create', 'edit', 'delete', 'export', 'screenshot',
               'verify', 'sign', 'freeze', 'lock'],
  },
  {
    key:      'consent_management',
    label:    'Consent Management',
    isGroup:  true,
    children: [
      { key: 'consent_builder', label: 'Consent Builder',           perms: ['view', 'create', 'edit', 'delete', 'screenshot'] },
      { key: 'consent_review',  label: 'Consent Review & Approval', perms: ['view', 'edit', 'export', 'screenshot'] },
    ],
  },
  {
    key:      'quality_management',
    label:    'Quality Management',
    isGroup:  true,
    children: [
      { key: 'query_manager',      label: 'Query Manager',              perms: ['view', 'create', 'edit', 'delete', 'export', 'screenshot'] },
      { key: 'data_verification',  label: 'Data Verification Manager',  perms: ['view', 'create', 'edit', 'export', 'screenshot'] },
    ],
  },
  {
    key:      'site_management',
    label:    'Site Management',
    isGroup:  true,
    children: [
      { key: 'sites',          label: 'Sites',           perms: ['view', 'create', 'edit', 'delete', 'import', 'export', 'screenshot'] },
      { key: 'site_personnel', label: 'Site Personnel',  perms: ['view', 'create', 'edit', 'delete', 'export', 'screenshot'] },
      { key: 'site_roles',     label: 'Site Roles',      perms: ['view', 'create', 'edit', 'delete', 'export', 'screenshot'] },
    ],
  },
  {
    key:      'reports',
    label:    'Reports',
    perms:    ['view', 'create', 'export'],
  },
  {
    key:      'masters',
    label:    'Masters',
    isGroup:  true,
    children: [
      { key: 'email_templates', label: 'Email Templates', perms: ['view', 'create', 'edit', 'delete'] },
      { key: 'countries',       label: 'Country',         perms: ['view', 'create', 'edit', 'delete'] },
      { key: 'locations',       label: 'Locations',       perms: ['view', 'create', 'edit', 'delete'] },
      { key: 'regions',         label: 'Regions',         perms: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key:      'activity_log',
    label:    'Activity Log',
    perms:    ['view', 'export', 'screenshot'],
  },
];

// ── Leaf helpers ──────────────────────────────────────────────────────────────

/** Returns flat array of all leaf nodes (non-group) with their keys + perms. */
export function getLeaves() {
  const leaves = [];
  for (const node of FEATURE_TREE) {
    if (node.isGroup) {
      for (const child of node.children) leaves.push(child);
    } else {
      leaves.push(node);
    }
  }
  return leaves;
}

/** Build a zeroed permissions object  { [moduleKey]: { [perm]: false } }. */
export function buildEmptyPermissions() {
  const obj = {};
  for (const leaf of getLeaves()) {
    obj[leaf.key] = {};
    for (const p of leaf.perms) obj[leaf.key][p] = false;
  }
  return obj;
}

/** Build a full-access permissions object (all true). */
export function buildFullPermissions() {
  const obj = {};
  for (const leaf of getLeaves()) {
    obj[leaf.key] = {};
    for (const p of leaf.perms) obj[leaf.key][p] = true;
  }
  return obj;
}

// ── Default system role permissions ───────────────────────────────────────────

function make(overrides) {
  const base = buildEmptyPermissions();
  for (const [key, perms] of Object.entries(overrides)) {
    if (base[key]) {
      for (const p of perms) {
        if (base[key][p] !== undefined) base[key][p] = true;
      }
    }
  }
  return base;
}

export const DEFAULT_ROLE_PERMISSIONS = {
  'CRO Administrator': buildFullPermissions(),

  'Data Manager': make({
    dashboard:        ['view', 'export'],
    data_capture:     ['view', 'create', 'edit', 'delete', 'export'],
    query_manager:    ['view', 'create', 'edit', 'delete', 'export'],
    data_verification:['view', 'create', 'edit', 'export'],
    reports:          ['view', 'create', 'export'],
    sites:            ['view'],
    site_personnel:   ['view'],
  }),

  'Data Reviewer': make({
    dashboard:        ['view', 'export'],
    data_verification:['view', 'edit', 'export'],
    query_manager:    ['view'],
    reports:          ['view', 'export'],
  }),

  'Site Monitor': make({
    dashboard:        ['view', 'export'],
    sites:            ['view'],
    site_personnel:   ['view'],
    reports:          ['view', 'export'],
  }),
};

// ── Utility: count enabled permissions ───────────────────────────────────────

export function countPermissions(permsObj) {
  let total = 0;
  let enabled = 0;
  for (const leaf of getLeaves()) {
    const mod = permsObj?.[leaf.key] ?? {};
    for (const p of leaf.perms) {
      total++;
      if (mod[p]) enabled++;
    }
  }
  return { enabled, total };
}
