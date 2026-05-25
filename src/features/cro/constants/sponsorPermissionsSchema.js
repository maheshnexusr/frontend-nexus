/**
 * sponsorPermissionsSchema — permission hierarchy for Sponsor Roles.
 *
 * Each feature.key maps 1:1 to a backend sponsor_role_permissions.feature_name
 * value (the sponsor-workspace permission leaves). Groups are presentational
 * only. Mirrors permissionsSchema.js (CRO roles) so the same form UI + CSS
 * can be reused.
 */

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Friendly labels for action keys whose default Title Case is awkward
// (e.g. "Raise_query" → "Raise Query"). Anything not listed falls back to cap().
const PERM_LABEL_OVERRIDES = {
  raise_query:        'Raise Query',
  close_query:        'Close Query',
  complete:           'Mark Completed',
  review:             'Mark Reviewed',
  verify:             'Verify',
  sign:               'Sign Form',
  freeze:             'Freeze Form',
  lock:               'Lock Form',
  lock_block:         'Lock Block',
  lock_site:          'Lock Site',
  subject_lock:       'Subject Lock',
  // "Open Data Capture from a subject row" — survived from the old subjects
  // leaf; now lives on data_capture as its own action so a role can be allowed
  // to see the subject list (data_capture.view) without being allowed to open
  // the eCRF for any particular subject.
  subject_data_capture: 'Data Capture',
  data_capture:       'Data Capture',
  // Renamed from "Activity Log" per spec — same audit-trail gate.
  activity_log:       'Activity History',
  snapshot:           'Snapshot',
  screenshot:         'Snapshot',           // alias — same intent
  sla_settings:       'SLA Settings',
  submit:             'Submit',
  approve:            'Approve',
  reject:             'Reject',
  // Per-status Data Verification decisions (spec §5). Splitting these out
  // lets a role be limited to e.g. Partially Verified without granting the
  // final Verified call.
  mark_not_verified:   'Mark Not Verified',
  mark_in_verification:'Mark In Verification',
  mark_partially:      'Mark Partially Verified',
  mark_verified:       'Mark Verified',
  // Subject roster — folded into the Data Capture leaf so a role can be
  // granted form-data rights independently of subject CRUD. Per spec there is
  // no separate "View Subject" — visibility is covered by data_capture.view.
  subject_create:      'Create Subject',
  subject_edit:        'Edit Subject',
  subject_delete:      'Delete Subject',
  subject_lock:        'Lock Subject',
  download:           'Download',
  // Per-report download flags (Reports group).
  download_enrollment:        'Download Enrollment',
  download_data_completeness: 'Download Data Completeness',
  download_queries:           'Download Queries',
  download_sites:             'Download Sites',
  download_audit:             'Download Audit',
};
const perms = (keys) => keys.map((k) => ({
  key: k,
  label: PERM_LABEL_OVERRIDES[k] ?? cap(k),
}));

// ── Schema ────────────────────────────────────────────────────────────────────
export const SPONSOR_PERMISSION_GROUPS = [
  {
    group: 'Workspace',
    key: 'workspace',
    features: [
      { label: 'Dashboard',         key: 'dashboard',         desc: 'Study metrics and overview widgets.',          perms: perms(['view', 'export']) },
      // Data Capture — runtime form lifecycle. `lock_block` is distinct from
      // `lock` (Lock Form); `activity_log` lets a role see the form-level audit
      // even without other rights; `snapshot` gates capture-screen snapshot
      // export.
      // Data Capture covers BOTH form-data CRUD (view/create/edit/delete) and
      // subject roster CRUD via the subject_* prefix — kept on the same leaf
      // because subjects are surfaced inside the Data Capture screen. The
      // prefix prevents collision with the form-data actions so a role can be
      // allowed to capture form data without being allowed to create subjects.
      // Per spec: the Subjects subset is create/edit/delete/lock + a separate
      // "Data Capture" (open-form) gate + Activity History + Snapshot. No
      // subject_view: visibility falls through data_capture.view, which
      // already governs whether the user sees the subject list at all.
      { label: 'Data Capture',      key: 'data_capture',      desc: 'eCRF data entry, subject roster, raise/close query, mark completed/reviewed/verified, signature, freeze, lock block/form.',
        perms: perms(['view', 'create', 'edit', 'delete', 'export',
                      'subject_create', 'subject_edit', 'subject_delete', 'subject_lock',
                      'subject_data_capture',
                      'complete', 'review', 'verify', 'sign',
                      'freeze', 'lock', 'lock_block',
                      'raise_query', 'close_query',
                      'activity_log', 'snapshot']) },
      { label: 'Query Manager',     key: 'query_manager',     desc: 'Raise, answer and resolve data queries.',
        perms: perms(['view', 'create', 'edit', 'delete',
                      'sla_settings', 'snapshot']) },
      // Verification Manager (the BE leaf key is `data_verification` — kept
      // so existing role rows and routes don't break). Trimmed per spec to the
      // core CRUD + SLA + Snapshot set; the per-status `mark_*` toggles are
      // dropped from the editor (any role still carrying them in storage is
      // simply unable to edit the bit until the trim is reverted).
      { label: 'Verification Manager', key: 'data_verification', desc: 'Source data verification and review.',
        perms: perms(['view', 'create', 'edit', 'delete',
                      'sla_settings', 'snapshot']) },
      // Reports — each report type carries its own download permission so a
      // role can be allowed to download Queries but not Sites, etc.
      { label: 'Reports',           key: 'reports',           desc: 'Operational and study reports. Download is gated per report.',
        perms: perms(['view', 'create', 'export',
                      'download_enrollment', 'download_data_completeness',
                      'download_queries', 'download_sites', 'download_audit']) },
    ],
  },
  {
    group: 'Consent',
    key: 'consent',
    features: [
      { label: 'Consent Builder',    key: 'consent_builder',    desc: 'Author and publish consent templates.',
        perms: perms(['view', 'create', 'edit', 'delete', 'publish', 'snapshot']) },
      // NEW — submitter-facing consent flow.
      { label: 'Consent Submission', key: 'consent_submission', desc: 'Submit signed consent on behalf of a subject.',
        perms: perms(['view', 'submit', 'snapshot']) },
      { label: 'Consent Review',     key: 'consent_review',     desc: 'Review, approve or reject submitted consent forms.',
        perms: perms(['view', 'edit', 'approve', 'reject', 'export', 'snapshot']) },
    ],
  },
  {
    group: 'Sites & Personnel',
    key: 'sitesGroup',
    features: [
      { label: 'Sites',          key: 'sites',          desc: 'Study sites and their configuration. Lock Site supports single, multi-select and bulk via one permission.',
        perms: perms(['view', 'create', 'edit', 'delete', 'lock_site', 'import', 'export']) },
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

