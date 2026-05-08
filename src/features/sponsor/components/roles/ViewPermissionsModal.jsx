import Modal from '@/components/feedback/Modal';
import { Check, Minus } from 'lucide-react';
import { FEATURE_TREE, ALL_PERMS, PERM_LABELS, countPermissions } from './permissionsTree';
import css from './ViewPermissionsModal.module.css';

/**
 * ViewPermissionsModal — read-only view of a role's permissions.
 *
 * Props:
 *   role     { roleName, description, permissions }
 *   onClose  () => void
 */

export default function ViewPermissionsModal({ role, onClose }) {
  const perms = role.permissions ?? {};
  const { enabled, total } = countPermissions(perms);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Permissions — ${role.roleName}`}
      size="lg"
      footer={<button className={css.btnClose} onClick={onClose}>Close</button>}
    >
      <div className={css.body}>
        {/* Summary */}
        <div className={css.summary}>
          <div className={css.summaryKpi}>
            <span className={css.kpiVal}>{enabled}</span>
            <span className={css.kpiLabel}>permissions enabled</span>
          </div>
          <div className={css.summaryKpi}>
            <span className={css.kpiVal}>{total - enabled}</span>
            <span className={css.kpiLabel}>not granted</span>
          </div>
          <div className={css.summaryKpi}>
            <span className={css.kpiVal}>{Math.round((enabled / total) * 100)}%</span>
            <span className={css.kpiLabel}>access level</span>
          </div>
          {role.description && (
            <p className={css.desc}>{role.description}</p>
          )}
        </div>

        {/* Matrix */}
        <div className={css.matrixWrap}>
          <table className={css.matrix}>
            <thead>
              <tr>
                <th className={css.mthModule}>Module / Feature</th>
                {ALL_PERMS.map((p) => (
                  <th key={p} className={css.mthPerm}>{PERM_LABELS[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_TREE.map((node) => {
                if (!node.isGroup) {
                  return <ViewLeafRow key={node.key} node={node} perms={perms[node.key] ?? {}} />;
                }
                return [
                  <tr key={node.key} className={css.groupRow}>
                    <td className={css.groupCell} colSpan={ALL_PERMS.length + 1}>
                      <span className={css.groupLabel}>{node.label}</span>
                    </td>
                  </tr>,
                  ...node.children.map((child) => (
                    <ViewLeafRow key={child.key} node={child} perms={perms[child.key] ?? {}} isChild />
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function ViewLeafRow({ node, perms, isChild }) {
  return (
    <tr className={`${css.leafRow} ${isChild ? css.childRow : ''}`}>
      <td className={css.moduleCell}>
        <span className={isChild ? css.childLabel : css.moduleLabel}>{node.label}</span>
      </td>
      {ALL_PERMS.map((p) => {
        const applicable = node.perms.includes(p);
        const granted    = applicable && !!perms[p];
        return (
          <td key={p} className={css.permCell}>
            {!applicable ? (
              <span className={css.na}>—</span>
            ) : granted ? (
              <span className={css.grantedIcon}><Check size={12} /></span>
            ) : (
              <span className={css.deniedIcon}><Minus size={11} /></span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
