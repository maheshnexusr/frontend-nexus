/**
 * studyConfigGating — single source of truth for which sponsor-workspace
 * features are gated by the Step 3 (Study Configuration) toggles.
 *
 * Step 3 toggles → sponsor permission-tree leaf keys:
 *   consentManager      → consent_builder, consent_review
 *   queryManager        → query_manager
 *   verificationManager → data_verification
 *
 * Anything else (dashboard, data capture, sites, masters, reports,
 * activity_log, …) is always visible regardless of the study config —
 * those are core EDC features, not optional modules. (Data Capture used
 * to be gated by a `dataManager` toggle; that was removed because EDC
 * studies always need data capture.)
 */

import { FEATURE_TREE } from '@/features/sponsor/components/roles/permissionsTree';

/** Map of Step 3 toggle key → sponsor leaf keys it gates. */
export const CONFIG_GATED_LEAVES = {
  consentManager:      ['consent_builder', 'consent_review'],
  queryManager:        ['query_manager'],
  verificationManager: ['data_verification'],
};

/**
 * Read a config value with fallbacks. Supports both the new wizard keys
 * (consentManager / queryManager / etc.) and the legacy SponsorLayout keys
 * (consentEnabled / queryEnabled / etc.) so existing data keeps working.
 *
 * Default: enabled (true) when the config is missing or undefined for the
 * key — matches "fail open" behavior used elsewhere.
 */
export function readConfigFlag(config, ...keys) {
  if (!config) return true;
  for (const k of keys) {
    if (typeof config[k] === 'boolean') return config[k];
  }
  return true;
}

/** Resolve every Step 3 toggle for a given study config object. */
export function resolveStudyConfig(config) {
  return {
    consentManager:      readConfigFlag(config, 'consentManager',      'consentEnabled'),
    // Consent review/approval is OPT-IN — default FALSE (not fail-open). The
    // submission flow exists whenever Consent Manager is on; this only governs
    // whether a Sponsor/CRO approval step is required.
    consentApproval:     config?.consentApproval === true
                          || config?.enable_consent_approval === true,
    queryManager:        readConfigFlag(config, 'queryManager',        'queryEnabled'),
    verificationManager: readConfigFlag(config, 'verificationManager', 'verificationEnabled'),
  };
}

/**
 * Returns a Set of permission-tree leaf keys that should be HIDDEN given
 * the supplied study config. Pass null/undefined config to hide nothing.
 */
export function getDisabledLeafKeys(config) {
  if (!config) return new Set();
  const resolved = resolveStudyConfig(config);
  const out = new Set();
  for (const [toggleKey, leafKeys] of Object.entries(CONFIG_GATED_LEAVES)) {
    if (resolved[toggleKey] === false) {
      for (const k of leafKeys) out.add(k);
    }
  }
  return out;
}

/**
 * Return a copy of FEATURE_TREE with disabled leaves removed and any group
 * left with no children stripped out entirely.
 */
export function filterFeatureTreeByConfig(config) {
  const disabled = getDisabledLeafKeys(config);
  if (disabled.size === 0) return FEATURE_TREE;

  const result = [];
  for (const node of FEATURE_TREE) {
    if (!node.isGroup) {
      if (!disabled.has(node.key)) result.push(node);
      continue;
    }
    const remaining = node.children.filter((c) => !disabled.has(c.key));
    if (remaining.length > 0) {
      result.push({ ...node, children: remaining });
    }
  }
  return result;
}

/**
 * Quick check used by the sponsor sidebar to decide if a single nav leaf
 * should render for the active user.
 *
 *   permissions       null/undefined  → unrestricted (treat as allowed)
 *   permissions[key]  missing/false   → hidden
 *   permissions[key]  { view: true }  → visible
 *
 * `leafKey` matches the keys in FEATURE_TREE (e.g. 'consent_builder',
 * 'query_manager', 'data_verification', 'sites', 'site_personnel', ...).
 */
export function canViewLeaf(permissions, leafKey) {
  if (!permissions || typeof permissions !== 'object') return true;
  const leaf = permissions[leafKey];
  return !!(leaf && leaf.view);
}

/**
 * Filter FEATURE_TREE to leaves the user can `view`. Groups left with zero
 * visible children are dropped. Null/undefined permissions → unrestricted.
 */
export function filterFeatureTreeByPermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') return FEATURE_TREE;
  const result = [];
  for (const node of FEATURE_TREE) {
    if (!node.isGroup) {
      if (canViewLeaf(permissions, node.key)) result.push(node);
      continue;
    }
    const remaining = node.children.filter((c) => canViewLeaf(permissions, c.key));
    if (remaining.length > 0) result.push({ ...node, children: remaining });
  }
  return result;
}
