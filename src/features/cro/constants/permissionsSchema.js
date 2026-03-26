/**
 * permissionsSchema — defines the full permission hierarchy used across
 * Roles & Permissions.  Import this in both rolesClient and the form UI
 * so the schema is the single source of truth.
 */

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Schema ────────────────────────────────────────────────────────────────────
export const PERMISSION_GROUPS = [
  {
    group: 'Dashboard',
    key:   'dashboard',
    features: [
      {
        label: 'Study Portfolio Overview',
        key:   'studyPortfolio',
        desc:  'Total Studies, Active Studies, Studies in UAT, Locked Studies, Completed Studies',
        perms: [{ key: 'view', label: 'View' }],
      },
      {
        label: 'CRO Team Utilization',
        key:   'teamUtilization',
        desc:  'CRA workload, Studies per project manager, Sites per CRA',
        perms: [{ key: 'view', label: 'View' }],
      },
    ],
  },
  {
    group: 'Clinical Programs',
    key:   'clinicalPrograms',
    features: [
      {
        label: 'Sponsors',
        key:   'sponsors',
        perms: ['view', 'create', 'delete', 'edit', 'export'].map((k) => ({ key: k, label: cap(k) })),
      },
      {
        label: 'Studies',
        key:   'studies',
        perms: ['view', 'create', 'delete', 'edit', 'duplicate', 'locked', 'import', 'export', 'configuration', 'publish']
          .map((k) => ({ key: k, label: cap(k) })),
      },
    ],
  },
  {
    group: 'CRO Team Administration',
    key:   'teamAdmin',
    features: [
      {
        label: 'Team Members',
        key:   'teamMembers',
        perms: ['view', 'create', 'delete', 'edit', 'export'].map((k) => ({ key: k, label: cap(k) })),
      },
      {
        label: 'Roles & Permissions',
        key:   'rolesPermissions',
        perms: ['view', 'create', 'delete', 'edit'].map((k) => ({ key: k, label: cap(k) })),
      },
    ],
  },
  {
    group: 'Masters',
    key:   'masters',
    features: [
      {
        label: 'Email Templates',
        key:   'emailTemplates',
        perms: ['view', 'create', 'delete', 'edit'].map((k) => ({ key: k, label: cap(k) })),
      },
      {
        label: 'Study Phases',
        key:   'studyPhases',
        perms: ['view', 'create', 'delete', 'edit'].map((k) => ({ key: k, label: cap(k) })),
      },
      {
        label: 'Country',
        key:   'country',
        perms: ['view', 'create', 'delete', 'edit', 'export'].map((k) => ({ key: k, label: cap(k) })),
      },
      {
        label: 'Locations',
        key:   'locations',
        perms: ['view', 'create', 'delete', 'edit', 'export'].map((k) => ({ key: k, label: cap(k) })),
      },
      {
        label: 'Activity Log',
        key:   'activityLog',
        perms: ['view', 'delete', 'export'].map((k) => ({ key: k, label: cap(k) })),
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a permissions object with every key set to `value` (true/false). */
export function buildPermissions(value = false) {
  const perms = {};
  PERMISSION_GROUPS.forEach((g) => {
    perms[g.key] = {};
    g.features.forEach((f) => {
      perms[g.key][f.key] = {};
      f.perms.forEach((p) => {
        perms[g.key][f.key][p.key] = value;
      });
    });
  });
  return perms;
}

/** Count how many individual permissions are enabled in a role permissions object. */
export function countPermissions(perms = {}) {
  let total = 0;
  let enabled = 0;
  PERMISSION_GROUPS.forEach((g) => {
    g.features.forEach((f) => {
      f.perms.forEach((p) => {
        total++;
        if (perms?.[g.key]?.[f.key]?.[p.key]) enabled++;
      });
    });
  });
  return { enabled, total };
}

/** Return true if at least one permission is enabled. */
export function hasAnyPermission(perms = {}) {
  return PERMISSION_GROUPS.some((g) =>
    g.features.some((f) =>
      f.perms.some((p) => perms?.[g.key]?.[f.key]?.[p.key] === true),
    ),
  );
}

/** Are all permissions in a group enabled? */
export function isGroupFullyEnabled(perms = {}, groupKey) {
  const group = PERMISSION_GROUPS.find((g) => g.key === groupKey);
  if (!group) return false;
  return group.features.every((f) =>
    f.perms.every((p) => perms?.[groupKey]?.[f.key]?.[p.key] === true),
  );
}

/** Are some (but not all) permissions in a group enabled? */
export function isGroupPartiallyEnabled(perms = {}, groupKey) {
  const group = PERMISSION_GROUPS.find((g) => g.key === groupKey);
  if (!group) return false;
  const all  = group.features.flatMap((f) => f.perms.map((p) => perms?.[groupKey]?.[f.key]?.[p.key] === true));
  return all.some(Boolean) && !all.every(Boolean);
}
