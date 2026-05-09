/**
 * studyConfigGating — single source of truth for which sponsor-workspace
 * features are gated by the Step 3 (Study Configuration) toggles.
 *
 * Step 3 toggles → sponsor permission-tree leaf keys:
 *   consentManager      → consent_builder, consent_review
 *   queryManager        → query_manager
 *   dataManager         → data_capture
 *   verificationManager → data_verification
 *
 * Anything else (dashboard, sites, masters, reports, activity_log, …) is
 * always visible regardless of the study config — these are core sponsor
 * features, not optional modules.
 */

import { FEATURE_TREE } from '@/features/sponsor/components/roles/permissionsTree';

/** Map of Step 3 toggle key → sponsor leaf keys it gates. */
export const CONFIG_GATED_LEAVES = {
  consentManager:      ['consent_builder', 'consent_review'],
  queryManager:        ['query_manager'],
  dataManager:         ['data_capture'],
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
    queryManager:        readConfigFlag(config, 'queryManager',        'queryEnabled'),
    dataManager:         readConfigFlag(config, 'dataManager',         'dataManagerEnabled'),
    verificationManager: readConfigFlag(config, 'verificationManager', 'verificationEnabled'),
    navigationBar:       readConfigFlag(config, 'navigationBar',       'navBarEnabled'),
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
