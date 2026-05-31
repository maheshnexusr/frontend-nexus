import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import {
  FEATURE_TREE,
  PERM_LABELS,
  buildEmptyPermissions,
  buildFullPermissions,
} from '@/features/sponsor/components/roles/permissionsTree';
import { filterFeatureTreeByConfig } from '@/features/cro/utils/studyConfigGating';
import css from './SponsorPermissionsMatrix.module.css';

// ── State helpers ─────────────────────────────────────────────────────────────
function setNested(obj, leafKey, permKey, value) {
  return {
    ...obj,
    [leafKey]: { ...(obj[leafKey] ?? {}), [permKey]: value },
  };
}
function setLeaf(obj, leaf, value) {
  const next = { ...obj, [leaf.key]: { ...(obj[leaf.key] ?? {}) } };
  for (const p of leaf.perms) next[leaf.key][p] = value;
  return next;
}
function setGroupChildren(obj, children, value) {
  const next = { ...obj };
  for (const leaf of children) {
    next[leaf.key] = { ...(next[leaf.key] ?? {}) };
    for (const p of leaf.perms) next[leaf.key][p] = value;
  }
  return next;
}

function isLeafFullyEnabled(perms, leaf) {
  return leaf.perms.every((p) => perms?.[leaf.key]?.[p]);
}
function isLeafPartiallyEnabled(perms, leaf) {
  const all  = leaf.perms.map((p) => !!perms?.[leaf.key]?.[p]);
  return all.some(Boolean) && !all.every(Boolean);
}
function isGroupFullyEnabled(perms, children) {
  return children.every((leaf) => isLeafFullyEnabled(perms, leaf));
}
function isGroupPartiallyEnabled(perms, children) {
  const flags = children.flatMap((leaf) => leaf.perms.map((p) => !!perms?.[leaf.key]?.[p]));
  return flags.some(Boolean) && !flags.every(Boolean);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SponsorPermissionsMatrix({ value, onChange, studyConfig }) {
  const perms = value ?? buildEmptyPermissions();

  // Filter the tree by Step 3 study config — modules disabled at the study
  // level are hidden so admins can't grant permissions on features the
  // sponsor will never see.
  const visibleTree = useMemo(
    () => (studyConfig ? filterFeatureTreeByConfig(studyConfig) : FEATURE_TREE),
    [studyConfig],
  );

  const hiddenCount = FEATURE_TREE.length - visibleTree.length;

  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(visibleTree.map((n) => [n.key, true])),
  );

  const writeBack = (next) => onChange?.(next);

  const togglePerm = useCallback((leafKey, permKey, leafPerms) => {
    const cur = perms?.[leafKey]?.[permKey] ?? false;
    let next = setNested(perms, leafKey, permKey, !cur);
    // View is the gate for all other perms — clearing it clears the row.
    if (permKey === 'view' && cur) {
      const leaf = { key: leafKey, perms: leafPerms };
      next = setLeaf(next, leaf, false);
    }
    writeBack(next);
  }, [perms]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLeaf = (leaf) => {
    const allOn = isLeafFullyEnabled(perms, leaf);
    writeBack(setLeaf(perms, leaf, !allOn));
  };
  const leafSelectAll = (leaf) => writeBack(setLeaf(perms, leaf, true));
  const leafClearAll  = (leaf) => writeBack(setLeaf(perms, leaf, false));

  const toggleGroup = (group) => {
    const allOn = isGroupFullyEnabled(perms, group.children);
    writeBack(setGroupChildren(perms, group.children, !allOn));
  };
  const groupSelectAll = (group) => writeBack(setGroupChildren(perms, group.children, true));
  const groupClearAll  = (group) => writeBack(setGroupChildren(perms, group.children, false));

  const toggleExpand = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const globalSelectAll = () => writeBack(buildFullPermissions());
  const globalClearAll  = () => writeBack(buildEmptyPermissions());

  return (
    <div className={css.wrap}>
      <div className={css.permHeader}>
        <span className={css.headTitle}>Sponsor Workspace Permissions</span>
        <div className={css.permHeaderActions}>
          <button type="button" className={css.btnSelectAll} onClick={globalSelectAll}>
            Select All
          </button>
          <button type="button" className={css.btnUnselectAll} onClick={globalClearAll}>
            Unselect All
          </button>
        </div>
      </div>

      {hiddenCount > 0 && (
        <p className={css.gateHint}>
          <Info size={12} aria-hidden="true" />
          Some modules are hidden because they&apos;re disabled in this study&apos;s configuration.
        </p>
      )}

      <div className={css.groupList}>
        {visibleTree.map((node) => {
          if (!node.isGroup) {
            // Standalone leaf — render as its own self-contained "group of one".
            const allOn  = isLeafFullyEnabled(perms, node);
            const someOn = !allOn && isLeafPartiallyEnabled(perms, node);
            return (
              <div key={node.key} className={css.group}>
                <div className={css.groupHeader}>
                  <label className={css.groupCheckLabel}>
                    <input
                      type="checkbox"
                      className={css.hidden}
                      checked={allOn}
                      ref={(el) => { if (el) el.indeterminate = someOn; }}
                      onChange={() => toggleLeaf(node)}
                    />
                    <span className={`${css.customCheck} ${allOn ? css.customCheckOn : ''} ${someOn ? css.customCheckPartial : ''}`}>
                      {allOn && <CheckIcon />}
                      {someOn && <DashIcon />}
                    </span>
                    <span className={css.groupName}>{node.label}</span>
                  </label>

                  <div className={css.permChips}>
                    {node.perms.map((perm) => {
                      const checked  = !!perms?.[node.key]?.[perm];
                      const disabled = perm !== 'view' && !perms?.[node.key]?.view;
                      return (
                        <button
                          key={perm}
                          type="button"
                          className={`${css.permChip} ${checked ? css.permChipOn : ''} ${disabled ? css.permChipDisabled : ''}`}
                          onClick={() => !disabled && togglePerm(node.key, perm, node.perms)}
                          disabled={disabled}
                          title={disabled ? 'View permission required' : ''}
                        >
                          {checked && <CheckIcon micro />}
                          {PERM_LABELS[perm] ?? perm}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Group node — header + collapsible feature rows.
          const groupOn      = isGroupFullyEnabled(perms, node.children);
          const groupPartial = isGroupPartiallyEnabled(perms, node.children);
          const open         = expanded[node.key];

          return (
            <div key={node.key} className={css.group}>
              <div className={css.groupHeader}>
                <label className={css.groupCheckLabel}>
                  <input
                    type="checkbox"
                    className={css.hidden}
                    checked={groupOn}
                    ref={(el) => { if (el) el.indeterminate = groupPartial; }}
                    onChange={() => toggleGroup(node)}
                  />
                  <span className={`${css.customCheck} ${groupOn ? css.customCheckOn : ''} ${groupPartial ? css.customCheckPartial : ''}`}>
                    {groupOn && <CheckIcon />}
                    {groupPartial && <DashIcon />}
                  </span>
                  <span className={css.groupName}>{node.label}</span>
                </label>

                <div className={css.groupHeaderRight}>
                  <span className={css.groupActions}>
                    <button type="button" className={css.groupActionBtn} onClick={() => groupSelectAll(node)}>
                      Select All
                    </button>
                    <span className={css.divider} />
                    <button type="button" className={css.groupActionBtn} onClick={() => groupClearAll(node)}>
                      Unselect All
                    </button>
                  </span>
                  <button type="button" className={css.expandBtn} onClick={() => toggleExpand(node.key)}>
                    {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {open && (
                <div className={css.featureList}>
                  {node.children.map((leaf) => {
                    const allOn  = isLeafFullyEnabled(perms, leaf);
                    const someOn = isLeafPartiallyEnabled(perms, leaf);
                    return (
                      <div key={leaf.key} className={css.featureRow}>
                        <div className={css.featureLeft}>
                          <label className={css.featureCheckLabel}>
                            <input
                              type="checkbox"
                              className={css.hidden}
                              checked={allOn}
                              ref={(el) => { if (el) el.indeterminate = someOn; }}
                              onChange={() => toggleLeaf(leaf)}
                            />
                            <span className={`${css.customCheck} ${css.customCheckSm} ${allOn ? css.customCheckOn : ''} ${someOn ? css.customCheckPartial : ''}`}>
                              {allOn && <CheckIcon small />}
                              {someOn && <DashIcon small />}
                            </span>
                            <span className={css.featureName}>{leaf.label}</span>
                          </label>
                        </div>

                        <div className={css.permChips}>
                          {leaf.perms.map((perm) => {
                            const checked  = !!perms?.[leaf.key]?.[perm];
                            const disabled = perm !== 'view' && !perms?.[leaf.key]?.view;
                            return (
                              <button
                                key={perm}
                                type="button"
                                className={`${css.permChip} ${checked ? css.permChipOn : ''} ${disabled ? css.permChipDisabled : ''}`}
                                onClick={() => !disabled && togglePerm(leaf.key, perm, leaf.perms)}
                                disabled={disabled}
                                title={disabled ? 'View permission required' : ''}
                              >
                                {checked && <CheckIcon micro />}
                                {PERM_LABELS[perm] ?? perm}
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

      <p className={css.note}>
        View permission is required before granting Create, Edit, Delete, Import, or Export.
      </p>
    </div>
  );
}

// ── Micro SVG icons ─────────────────────────────────────────────────────────
function CheckIcon({ small, micro }) {
  const s = micro ? 8 : small ? 9 : 10;
  return (
    <svg width={s} height={s} viewBox="0 0 10 8" fill="none" aria-hidden="true">
      <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function DashIcon({ small }) {
  const s = small ? 9 : 10;
  return (
    <svg width={s} height={s} viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5h6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
