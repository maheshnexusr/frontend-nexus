/**
 * SponsorPermissionMatrix — module-grouped permission selector for the
 * sponsor workspace. Shared by the CRO sponsor-role editor (SponsorRoleFormPage)
 * and the Study Wizard Step 1 per-study sponsor permission grant.
 *
 * Operates on the nested shape { groupKey: { featureKey: { permKey: bool } } }
 * defined by sponsorPermissionsSchema.js. The host page owns the surrounding
 * card/section; this component renders the header (with global Select/Unselect
 * All), an optional error line, and the collapsible group → feature → action
 * grid.
 *
 * `hiddenFeatures` — feature keys to omit entirely (e.g. site-management
 * leaves for a non-EDC study scope). A group with no visible features left is
 * dropped. Hidden features are never shown and never togglable.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  SPONSOR_PERMISSION_GROUPS,
  buildPermissions,
  isGroupFullyEnabled,
  isGroupPartiallyEnabled,
} from '@/features/cro/constants/sponsorPermissionsSchema';
import styles from '../../pages/team/TeamRoleFormPage.module.css';

// ── State helpers (pure) ──────────────────────────────────────────────────────
function setNested(obj, groupKey, featureKey, permKey, value) {
  return {
    ...obj,
    [groupKey]: {
      ...obj[groupKey],
      [featureKey]: {
        ...(obj[groupKey]?.[featureKey] ?? {}),
        [permKey]: value,
      },
    },
  };
}

function setGroup(obj, group, value) {
  const updated = { ...obj };
  updated[group.key] = {};
  group.features.forEach((f) => {
    updated[group.key][f.key] = {};
    f.perms.forEach((p) => { updated[group.key][f.key][p.key] = value; });
  });
  return updated;
}

function setFeature(obj, groupKey, feature, value) {
  const updated = { ...obj, [groupKey]: { ...obj[groupKey] } };
  updated[groupKey][feature.key] = {};
  feature.perms.forEach((p) => { updated[groupKey][feature.key][p.key] = value; });
  return updated;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SponsorPermissionMatrix({
  value,
  onChange,
  error,
  title = 'Access Control & Permissions',
  subtitle = 'Configure which sponsor-workspace features and actions are granted. Unselected actions are denied.',
  hiddenFeatures = [],
}) {
  const permissions = value ?? buildPermissions(false);
  const hidden = new Set(hiddenFeatures);
  // Drop groups whose every feature is hidden by the current scope.
  const visibleGroups = SPONSOR_PERMISSION_GROUPS
    .map((g) => ({ ...g, features: g.features.filter((f) => !hidden.has(f.key)) }))
    .filter((g) => g.features.length > 0);
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(SPONSOR_PERMISSION_GROUPS.map((g) => [g.key, true])),
  );

  const write = (next) => onChange?.(next);

  const togglePerm = (groupKey, featureKey, permKey) => {
    const cur = permissions?.[groupKey]?.[featureKey]?.[permKey] ?? false;
    write(setNested(permissions, groupKey, featureKey, permKey, !cur));
  };
  const toggleGroup = (group) =>
    write(setGroup(permissions, group, !isGroupFullyEnabled(permissions, group.key)));
  const toggleFeature = (groupKey, feature) => {
    const allOn = feature.perms.every((p) => permissions?.[groupKey]?.[feature.key]?.[p.key]);
    write(setFeature(permissions, groupKey, feature, !allOn));
  };
  const toggleExpand = (groupKey) =>
    setExpanded((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));

  return (
    <>
      <div className={styles.permHeader}>
        <div>
          <h2 className={styles.cardHeading}>{title}</h2>
          <p className={styles.cardSub}>{subtitle}</p>
        </div>
        <div className={styles.permHeaderActions}>
          <button
            type="button"
            className={styles.btnSelectAll}
            onClick={() => write(buildPermissions(true))}
          >
            Select All
          </button>
          <button
            type="button"
            className={styles.btnUnselectAll}
            onClick={() => write(buildPermissions(false))}
          >
            Unselect All
          </button>
        </div>
      </div>

      {error && <p className={styles.permError}>{error}</p>}

      <div className={styles.groupList}>
        {visibleGroups.map((group) => {
          const groupOn      = isGroupFullyEnabled(permissions, group.key);
          const groupPartial = isGroupPartiallyEnabled(permissions, group.key);
          const open         = expanded[group.key];
          return (
            <div key={group.key} className={styles.group}>
              <div className={styles.groupHeader}>
                <label className={styles.groupCheckLabel}>
                  <input
                    type="checkbox"
                    className={styles.hidden}
                    checked={groupOn}
                    ref={(el) => { if (el) el.indeterminate = groupPartial; }}
                    onChange={() => toggleGroup(group)}
                  />
                  <span className={`${styles.customCheck} ${groupOn ? styles.customCheckOn : ''} ${groupPartial ? styles.customCheckPartial : ''}`}>
                    {groupOn && <CheckIcon />}
                    {groupPartial && <DashIcon />}
                  </span>
                  <span className={styles.groupName}>{group.group}</span>
                </label>

                <div className={styles.groupHeaderRight}>
                  <span className={styles.groupActions}>
                    <button type="button" className={styles.groupActionBtn} onClick={() => write(setGroup(permissions, group, true))}>
                      Select All
                    </button>
                    <span className={styles.divider} />
                    <button type="button" className={styles.groupActionBtn} onClick={() => write(setGroup(permissions, group, false))}>
                      Unselect All
                    </button>
                  </span>
                  <button type="button" className={styles.expandBtn} onClick={() => toggleExpand(group.key)}>
                    {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {open && (
                <div className={styles.featureList}>
                  {group.features.map((feature) => {
                    const allOn  = feature.perms.every((p) => permissions?.[group.key]?.[feature.key]?.[p.key]);
                    const someOn = !allOn && feature.perms.some((p) => permissions?.[group.key]?.[feature.key]?.[p.key]);
                    return (
                      <div key={feature.key} className={styles.featureRow}>
                        <div className={styles.featureLeft}>
                          <label className={styles.featureCheckLabel}>
                            <input
                              type="checkbox"
                              className={styles.hidden}
                              checked={allOn}
                              ref={(el) => { if (el) el.indeterminate = someOn; }}
                              onChange={() => toggleFeature(group.key, feature)}
                            />
                            <span className={`${styles.customCheck} ${styles.customCheckSm} ${allOn ? styles.customCheckOn : ''} ${someOn ? styles.customCheckPartial : ''}`}>
                              {allOn && <CheckIcon small />}
                              {someOn && <DashIcon small />}
                            </span>
                            <span className={styles.featureName}>{feature.label}</span>
                          </label>
                          {feature.desc && <p className={styles.featureDesc}>{feature.desc}</p>}
                        </div>

                        <div className={styles.permChips}>
                          {feature.perms.map((perm) => {
                            const checked = permissions?.[group.key]?.[feature.key]?.[perm.key] ?? false;
                            return (
                              <button
                                key={perm.key}
                                type="button"
                                className={`${styles.permChip} ${checked ? styles.permChipOn : ''}`}
                                onClick={() => togglePerm(group.key, feature.key, perm.key)}
                              >
                                {checked && <CheckIcon micro />}
                                {perm.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Micro SVG icons for checkbox states ──────────────────────────────────────
function CheckIcon({ small, micro }) {
  const s = micro ? 8 : small ? 9 : 10;
  return (
    <svg width={s} height={s} viewBox="0 0 10 8" fill="none" aria-hidden="true">
      <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DashIcon({ small }) {
  const s = small ? 9 : 10;
  return (
    <svg width={s} height={s} viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
