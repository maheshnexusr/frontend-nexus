/**
 * sponsorPermsCodec — bidirectional codec between the nested UI permissions
 * object and the flat per-leaf can_<action> rows the backend stores for
 * Study Wizard Step 1's sponsor_permissions matrix.
 *
 * The nested UI shape:
 *   { groupKey: { featureKey: { permKey: boolean } } }
 *
 * The wire shape:
 *   [{ feature_name, can_view, can_create, … }]
 *
 * Sponsor feature_name values are leaf keys directly (dashboard, data_capture,
 * …) — no PascalCase canonical mapping like the CRO rolesClient does.
 */

import {
  SPONSOR_PERMISSION_GROUPS,
  buildPermissions,
} from '@/features/cro/constants/sponsorPermissionsSchema';

const FEATURE_TO_GROUP = (() => {
  const out = {};
  for (const group of SPONSOR_PERMISSION_GROUPS) {
    for (const feature of group.features) out[feature.key] = group.key;
  }
  return out;
})();

const ALL_ACTION_KEYS = (() => {
  const set = new Set();
  for (const g of SPONSOR_PERMISSION_GROUPS) {
    for (const f of g.features) {
      for (const p of f.perms) set.add(p.key);
    }
  }
  return [...set];
})();

// Action keys whose backend can_* column is NOT simply `can_<key>`. Mirrors the
// special cases in backend permissionsView.ACTION_TO_COLUMN — without this, an
// action like `subject_data_capture` (the "Data Capture" / open-form gate) would
// be written/read as the non-existent `can_subject_data_capture` and silently
// reset to OFF on every save, because the backend stores it in `can_data_capture`.
const ACTION_COLUMN_OVERRIDES = {
  subject_data_capture: 'can_data_capture',
  screenshot:           'can_snapshot',
};
const actionColumn = (key) => ACTION_COLUMN_OVERRIDES[key] || `can_${key}`;

function rowToActionMap(p) {
  const am = {};
  for (const key of ALL_ACTION_KEYS) {
    const snake     = actionColumn(key);
    const camel     = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const lowercase = snake.toLowerCase();
    am[key] = Boolean(p[snake] ?? p[camel] ?? p[lowercase] ?? false);
  }
  return am;
}

export function apiPermsToNested(apiPerms) {
  const result = buildPermissions(false);
  if (!Array.isArray(apiPerms)) return result;

  for (const p of apiPerms) {
    const name = p.feature_name ?? p.featureName ?? p.featurename ?? '';
    const groupKey = FEATURE_TO_GROUP[name];
    if (!groupKey) continue;

    const am = rowToActionMap(p);
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

export function nestedPermsToApi(permsObj) {
  const result = [];
  for (const group of SPONSOR_PERMISSION_GROUPS) {
    for (const feature of group.features) {
      const fp  = permsObj?.[group.key]?.[feature.key] ?? {};
      const row = { feature_name: feature.key };
      for (const key of ALL_ACTION_KEYS) {
        const col = actionColumn(key);
        // OR-combine: distinct action keys may share one column (e.g.
        // subject_data_capture + data_capture → can_data_capture).
        row[col] = Boolean(row[col]) || Boolean(fp[key]);
      }
      result.push(row);
    }
  }
  return result;
}
