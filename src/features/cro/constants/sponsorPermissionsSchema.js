/**
 * sponsorPermissionsSchema — permission hierarchy for Sponsor Roles.
 *
 * Each feature.key maps 1:1 to a backend sponsor_role_permissions.feature_name
 * value (the sponsor-workspace permission leaves). Groups are presentational
 * only. Mirrors permissionsSchema.js (CRO roles) so the same form UI + CSS
 * can be reused.
 */

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const perms = (keys) => keys.map((k) => ({ key: k, label: cap(k) }));

// ── Schema ────────────────────────────────────────────────────────────────────
export const SPONSOR_PERMISSION_GROUPS = [
  {
    group: 'Workspace',
    key: 'workspace',
    features: [
      { label: 'Dashboard',         key: 'dashboard',         desc: 'Study metrics and overview widgets.',          perms: perms(['view', 'export']) },
      { label: 'Data Capture',      key: 'data_capture',      desc: 'eCRF data entry, verification, signature, freeze and lock.', perms: perms(['view', 'create', 'edit', 'delete', 'export', 'verify', 'sign', 'freeze', 'lock']) },
      { label: 'Query Manager',     key: 'query_manager',     desc: 'Raise, answer and resolve data queries.',      perms: perms(['view', 'create', 'edit', 'delete', 'export']) },
      { label: 'Data Verification', key: 'data_verification', desc: 'Source data verification and review.',         perms: perms(['view', 'create', 'edit', 'approve', 'export']) },
      { label: 'Reports',           key: 'reports',           desc: 'Operational and study reports.',               perms: perms(['view', 'create', 'export']) },
    ],
  },
  {
    group: 'Consent',
    key: 'consent',
    features: [
      { label: 'Consent Builder', key: 'consent_builder', desc: 'Author and publish consent templates.', perms: perms(['view', 'create', 'edit', 'delete', 'publish']) },
      { label: 'Consent Review',  key: 'consent_review',  desc: 'Review and approve consent templates.',  perms: perms(['view', 'edit', 'approve', 'export']) },
    ],
  },
  {
    group: 'Sites & Personnel',
    key: 'sitesGroup',
    features: [
      { label: 'Sites',          key: 'sites',          desc: 'Study sites and their configuration.',  perms: perms(['view', 'create', 'edit', 'delete', 'import', 'export']) },
      { label: 'Site Personnel', key: 'site_personnel', desc: 'PI, coordinators and other site staff.', perms: perms(['view', 'create', 'edit', 'delete', 'export']) },
      { label: 'Site Roles',     key: 'site_roles',     desc: 'Roles assignable to site personnel.',    perms: perms(['view', 'create', 'edit', 'delete']) },
    ],
  },
  {
    group: 'Masters',
    key: 'masters',
    features: [
      { label: 'Masters',         key: 'masters',         desc: 'Study-scoped master data.',     perms: perms(['view', 'create', 'edit', 'delete', 'import', 'export']) },
      { label: 'Email Templates', key: 'email_templates', desc: 'Workspace email templates.',     perms: perms(['view', 'create', 'edit', 'delete']) },
      { label: 'Countries',       key: 'countries',       desc: 'Country master list.',           perms: perms(['view', 'create', 'edit', 'delete']) },
      { label: 'Locations',       key: 'locations',       desc: 'Location master list.',          perms: perms(['view', 'create', 'edit', 'delete']) },
      { label: 'Regions',         key: 'regions',         desc: 'Region master list.',            perms: perms(['view', 'create', 'edit', 'delete']) },
      { label: 'Activity Log',    key: 'activity_log',    desc: 'Workspace audit trail.',         perms: perms(['view', 'export']) },
    ],
  },
];

// ── Helpers (operate on the nested { groupKey: { featureKey: { permKey } } }) ──

/** Build a permissions object with every key set to `value`. */
export function buildPermissions(value = false) {
  const out = {};
  SPONSOR_PERMISSION_GROUPS.forEach((g) => {
    out[g.key] = {};
    g.features.forEach((f) => {
      out[g.key][f.key] = {};
      f.perms.forEach((p) => { out[g.key][f.key][p.key] = value; });
    });
  });
  return out;
}

/** Count enabled / total individual permissions. */
export function countPermissions(perms = {}) {
  let total = 0;
  let enabled = 0;
  SPONSOR_PERMISSION_GROUPS.forEach((g) => {
    g.features.forEach((f) => {
      f.perms.forEach((p) => {
        total += 1;
        if (perms?.[g.key]?.[f.key]?.[p.key]) enabled += 1;
      });
    });
  });
  return { enabled, total };
}

/** True if at least one permission is enabled. */
export function hasAnyPermission(perms = {}) {
  return SPONSOR_PERMISSION_GROUPS.some((g) =>
    g.features.some((f) => f.perms.some((p) => perms?.[g.key]?.[f.key]?.[p.key] === true)),
  );
}

/** Are all permissions in a group enabled? */
export function isGroupFullyEnabled(perms = {}, groupKey) {
  const group = SPONSOR_PERMISSION_GROUPS.find((g) => g.key === groupKey);
  if (!group) return false;
  return group.features.every((f) =>
    f.perms.every((p) => perms?.[groupKey]?.[f.key]?.[p.key] === true),
  );
}

/** Are some (but not all) permissions in a group enabled? */
export function isGroupPartiallyEnabled(perms = {}, groupKey) {
  const group = SPONSOR_PERMISSION_GROUPS.find((g) => g.key === groupKey);
  if (!group) return false;
  const all = group.features.flatMap((f) => f.perms.map((p) => perms?.[groupKey]?.[f.key]?.[p.key] === true));
  return all.some(Boolean) && !all.every(Boolean);
}

// ── Role templates ────────────────────────────────────────────────────────────
// Starting points the CRO can apply on the sponsor-creation screen and then
// freely customise. Each `grant` is { groupKey: { featureKey: [permKeys] } } —
// only the listed permissions are turned on; everything else stays off.
//
// Intent (CRO stays the primary controller of the study; the sponsor is a
// Viewer / Reviewer / Approver depending on what is granted):
//   • Viewer   — read-only across the workspace.
//   • Reviewer — Viewer + raise/answer queries + review form data & consent.
//   • Approver — Reviewer + approve form data (SDV) & consent.
export const SPONSOR_ROLE_TEMPLATES = [
  {
    key: 'viewer',
    label: 'Sponsor Viewer',
    description: 'Read-only — can view studies, forms, queries, sites and reports.',
    grant: {
      workspace: {
        dashboard:         ['view'],
        data_capture:      ['view'],
        query_manager:     ['view'],
        data_verification: ['view'],
        reports:           ['view'],
      },
      consent:   { consent_review: ['view'] },
      sitesGroup: { sites: ['view'], site_personnel: ['view'] },
      masters:   { activity_log: ['view'] },
    },
  },
  {
    key: 'reviewer',
    label: 'Sponsor Reviewer',
    description: 'Can review form data and raise / answer queries — cannot approve.',
    grant: {
      workspace: {
        dashboard:         ['view', 'export'],
        data_capture:      ['view'],
        query_manager:     ['view', 'create', 'edit'],
        data_verification: ['view', 'edit'],
        reports:           ['view', 'export'],
      },
      consent:   { consent_review: ['view', 'edit'] },
      sitesGroup: { sites: ['view'], site_personnel: ['view'] },
      masters:   { activity_log: ['view'] },
    },
  },
  {
    key: 'approver',
    label: 'Sponsor Approver',
    description: 'Full review authority — can review and approve form data and consent.',
    grant: {
      workspace: {
        dashboard:         ['view', 'export'],
        data_capture:      ['view'],
        query_manager:     ['view', 'create', 'edit', 'delete'],
        data_verification: ['view', 'create', 'edit', 'approve', 'export'],
        reports:           ['view', 'create', 'export'],
      },
      consent:   { consent_review: ['view', 'edit', 'approve', 'export'] },
      sitesGroup: { sites: ['view'], site_personnel: ['view'] },
      masters:   { activity_log: ['view', 'export'] },
    },
  },
];

/** Build a full nested permissions object from a template key (see above). */
export function buildTemplatePermissions(templateKey) {
  const perms = buildPermissions(false);
  const tpl = SPONSOR_ROLE_TEMPLATES.find((t) => t.key === templateKey);
  if (!tpl) return perms;
  for (const [groupKey, features] of Object.entries(tpl.grant)) {
    for (const [featureKey, permKeys] of Object.entries(features)) {
      for (const permKey of permKeys) {
        if (perms[groupKey]?.[featureKey]?.[permKey] !== undefined) {
          perms[groupKey][featureKey][permKey] = true;
        }
      }
    }
  }
  return perms;
}
