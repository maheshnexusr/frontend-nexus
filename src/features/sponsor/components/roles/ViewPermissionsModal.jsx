/**
 * ViewPermissionsModal — read-only view of a role's permissions.
 *
 * Compact layout: instead of a wide column-grid matrix (which became
 * ~25 columns after migration 027), each leaf row shows ITS OWN applicable
 * actions as inline pills — granted pills filled, ungranted pills outlined.
 * The footprint is a fixed-width modal with normal vertical scroll, not a
 * horizontally scrolling table.
 *
 * Props:
 *   role     { roleName, description, permissions }
 *   onClose  () => void
 */

import Modal from '@/components/feedback/Modal';
import { Check, X } from 'lucide-react';
import { FEATURE_TREE, PERM_LABELS, countPermissions } from './permissionsTree';
import css from './ViewPermissionsModal.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

export default function ViewPermissionsModal({ role, onClose }) {
  const perms = role.permissions ?? {};
  const { enabled, total } = countPermissions(perms);
  const pct = total ? Math.round((enabled / total) * 100) : 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Permissions — ${role.roleName}`}
      size="md"
      footer={<button className={css.btnClose} onClick={onClose}>Close</button>}
    >
      <div className={css.body}>
        {/* Summary */}
        <div className={css.summary}>
          <div className={css.summaryKpi}>
            <span className={css.kpiVal}>{enabled}</span>
            <span className={css.kpiLabel}>granted</span>
          </div>
          <div className={css.summaryKpi}>
            <span className={css.kpiVal}>{total - enabled}</span>
            <span className={css.kpiLabel}>not granted</span>
          </div>
          <div className={css.summaryKpi}>
            <span className={css.kpiVal}>{pct}%</span>
            <span className={css.kpiLabel}>access level</span>
          </div>
          {role.description && (
            <p className={css.desc}>{role.description}</p>
          )}
        </div>

        {/* Leaf list — one row per feature, pills inline. */}
        <div className={css.list}>
          {FEATURE_TREE.map((node) => {
            if (!node.isGroup) {
              return <LeafRow key={node.key} node={node} perms={perms[node.key] ?? {}} />;
            }
            const childRows = node.children.map((child) => (
              <LeafRow key={child.key} node={child} perms={perms[child.key] ?? {}} isChild />
            ));
            // Drop the whole group if every child has zero granted actions —
            // keeps the modal focused on what was actually granted, instead
            // of pages of "not granted" pills for masters/etc.
            const anyGranted = node.children.some((c) =>
              c.perms.some((p) => perms[c.key]?.[p] === true)
            );
            return (
              <div key={node.key} className={clx(css.group, !anyGranted && css.groupEmpty)}>
                <div className={css.groupHeader}>
                  <span className={css.groupLabel}>{node.label}</span>
                  {!anyGranted && <span className={css.groupBadge}>no access</span>}
                </div>
                {childRows}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function LeafRow({ node, perms, isChild }) {
  const granted = (node.perms ?? []).filter((p) => perms[p] === true);
  return (
    <div className={clx(css.leaf, isChild && css.leafChild)}>
      <div className={css.leafHeader}>
        <span className={css.leafLabel}>{node.label}</span>
        <span className={css.leafCount}>
          {granted.length} / {(node.perms ?? []).length}
        </span>
      </div>
      <div className={css.pills}>
        {(node.perms ?? []).map((p) => {
          const isOn = perms[p] === true;
          return (
            <span key={p} className={clx(css.pill, isOn ? css.pillOn : css.pillOff)}>
              {isOn ? <Check size={10} /> : <X size={10} />}
              {PERM_LABELS[p] ?? p}
            </span>
          );
        })}
      </div>
    </div>
  );
}
