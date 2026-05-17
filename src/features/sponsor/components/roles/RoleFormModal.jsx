import { useState, useCallback } from 'react';
import { CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import {
  FEATURE_TREE, ALL_PERMS, PERM_LABELS,
  buildEmptyPermissions, getLeaves,
} from './permissionsTree';
import css from './RoleFormModal.module.css';

/**
 * RoleFormModal — Create or Edit a role with permissions matrix.
 *
 * Props:
 *   role          object | null  (null = create mode)
 *   existingRoles { id, roleName, permissions }[]  (for "Copy from" dropdown)
 *   onSave        (data) => Promise<void>
 *   onClose       () => void
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function clonePerms(perms) {
  const out = {};
  for (const [k, v] of Object.entries(perms)) out[k] = { ...v };
  return out;
}

/** When view is toggled off, disable all other perms for that module. */
function applyViewRule(perms, moduleKey, modulePerms) {
  const mod = perms[moduleKey];
  if (!mod?.view) {
    for (const p of modulePerms) {
      if (p !== 'view') mod[p] = false;
    }
  }
}

function validate(form) {
  const e = {};
  if (!form.roleName.trim())   e.roleName    = 'Role Name is required.';
  if (!form.description.trim()) e.description = 'Description is required.';
  return e;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoleFormModal({ role, existingRoles, onSave, onClose }) {
  const isEdit = !!role;

  const [form, setForm] = useState({
    roleName:    role?.roleName    ?? '',
    description: role?.description ?? '',
    status:      role?.status      ?? 'Active',
    permissions: role?.permissions ? clonePerms(role.permissions) : buildEmptyPermissions(),
  });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState('');
  const [copyFrom,   setCopyFrom]   = useState('');
  const [expanded,   setExpanded]   = useState(() => {
    const init = {};
    for (const node of FEATURE_TREE) { if (node.isGroup) init[node.key] = true; }
    return init;
  });

  // ── Field helpers ─────────────────────────────────────────────────────────

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  }

  // ── Copy permissions from existing role ───────────────────────────────────

  function handleCopyFrom(roleId) {
    setCopyFrom(roleId);
    if (!roleId) return;
    const src = existingRoles.find((r) => r.id === roleId);
    if (src?.permissions) setForm((prev) => ({ ...prev, permissions: clonePerms(src.permissions) }));
  }

  // ── Permission toggle ─────────────────────────────────────────────────────

  const togglePerm = useCallback((moduleKey, perm, modulePerms) => {
    setForm((prev) => {
      const perms = clonePerms(prev.permissions);
      if (!perms[moduleKey]) return prev;

      // Toggle the targeted permission
      perms[moduleKey][perm] = !perms[moduleKey][perm];

      // View prerequisite: if view is now false, clear all other perms
      applyViewRule(perms, moduleKey, modulePerms);

      // If enabling any non-view perm, auto-enable view
      if (perm !== 'view' && perms[moduleKey][perm] && !perms[moduleKey].view) {
        perms[moduleKey].view = true;
      }

      return { ...prev, permissions: perms };
    });
  }, []);

  // ── Row-level select all / clear ──────────────────────────────────────────

  function rowSelectAll(moduleKey, modulePerms) {
    setForm((prev) => {
      const perms = clonePerms(prev.permissions);
      for (const p of modulePerms) perms[moduleKey][p] = true;
      return { ...prev, permissions: perms };
    });
  }

  function rowClearAll(moduleKey, modulePerms) {
    setForm((prev) => {
      const perms = clonePerms(prev.permissions);
      for (const p of modulePerms) perms[moduleKey][p] = false;
      return { ...prev, permissions: perms };
    });
  }

  // ── Group-level select all / clear ────────────────────────────────────────

  function groupSelectAll(children) {
    setForm((prev) => {
      const perms = clonePerms(prev.permissions);
      for (const child of children) {
        for (const p of child.perms) perms[child.key][p] = true;
      }
      return { ...prev, permissions: perms };
    });
  }

  function groupClearAll(children) {
    setForm((prev) => {
      const perms = clonePerms(prev.permissions);
      for (const child of children) {
        for (const p of child.perms) perms[child.key][p] = false;
      }
      return { ...prev, permissions: perms };
    });
  }

  // ── Global select all / clear ─────────────────────────────────────────────

  function globalSelectAll() {
    setForm((prev) => {
      const perms = clonePerms(prev.permissions);
      for (const leaf of getLeaves()) {
        for (const p of leaf.perms) perms[leaf.key][p] = true;
      }
      return { ...prev, permissions: perms };
    });
  }

  function globalClearAll() {
    setForm((prev) => ({ ...prev, permissions: buildEmptyPermissions() }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError('');
    setSubmitting(true);
    try {
      await onSave(form);
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? '';
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('unique'))
        setErrors((prev) => ({ ...prev, roleName: 'Role Name already exists. Please use a unique name.' }));
      else
        setApiError(msg || 'Failed to save role. Please try again.');
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit Role — ${role.roleName}` : 'Create New Role'}
      size="lg"
      footer={
        <div className={css.footer}>
          <button className={css.btnCancel} onClick={onClose} disabled={submitting}>Cancel</button>
          <button className={css.btnSave} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      }
    >
      <div className={css.body}>
        {apiError && <div className={css.apiError}>{apiError}</div>}

        {/* ── Basic Info ─────────────────────────────────────────────── */}
        <div className={css.section}>
          <h3 className={css.sectionTitle}>Basic Information</h3>
          <div className={css.grid2}>
            <div className={css.field}>
              <label className={css.label}>Role Name <span className={css.req}>*</span></label>
              <input
                className={`${css.input} ${errors.roleName ? css.inputError : ''}`}
                placeholder="e.g. Data Reviewer"
                value={form.roleName}
                onChange={(e) => setField('roleName', e.target.value)}
              />
              {errors.roleName && <span className={css.fieldError}>{errors.roleName}</span>}
            </div>
            <div className={css.field}>
              <label className={css.label}>Status</label>
              <select className={css.input} value={form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className={css.field}>
            <label className={css.label}>Description <span className={css.req}>*</span></label>
            <textarea
              className={`${css.textarea} ${errors.description ? css.inputError : ''}`}
              placeholder="Describe this role's responsibilities…"
              rows={3}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
            {errors.description && <span className={css.fieldError}>{errors.description}</span>}
          </div>
          {!isEdit && existingRoles.length > 0 && (
            <div className={css.field}>
              <label className={css.label}>Copy Permissions From <span className={css.optional}>(optional)</span></label>
              <select
                className={css.input}
                value={copyFrom}
                onChange={(e) => handleCopyFrom(e.target.value)}
              >
                <option value="">— Start from scratch —</option>
                {existingRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.roleName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Permissions Matrix ────────────────────────────────────── */}
        <div className={css.section}>
          <div className={css.permHeader}>
            <h3 className={css.sectionTitle} style={{ margin: 0 }}>Access Control</h3>
            <div className={css.globalActions}>
              <button className={css.selectAllBtn} onClick={globalSelectAll} type="button">
                <CheckSquare size={12} /> Select All
              </button>
              <button className={css.clearAllBtn} onClick={globalClearAll} type="button">
                <Square size={12} /> Clear All
              </button>
            </div>
          </div>

          <div className={css.matrixWrap}>
            <table className={css.matrix}>
              <thead>
                <tr>
                  <th className={css.mthModule}>Module / Feature</th>
                  {ALL_PERMS.map((p) => (
                    <th key={p} className={css.mthPerm}>{PERM_LABELS[p]}</th>
                  ))}
                  <th className={css.mthActions}>Quick</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_TREE.map((node) => {
                  if (!node.isGroup) {
                    // Standalone leaf
                    return (
                      <LeafRow
                        key={node.key}
                        node={node}
                        perms={form.permissions[node.key] ?? {}}
                        onToggle={togglePerm}
                        onSelectAll={() => rowSelectAll(node.key, node.perms)}
                        onClearAll={() => rowClearAll(node.key, node.perms)}
                      />
                    );
                  }
                  // Group header + children
                  const isOpen = expanded[node.key] !== false;
                  return [
                    <GroupHeaderRow
                      key={node.key}
                      node={node}
                      isOpen={isOpen}
                      onToggleExpand={() => setExpanded((prev) => ({ ...prev, [node.key]: !isOpen }))}
                      onSelectAll={() => groupSelectAll(node.children)}
                      onClearAll={() => groupClearAll(node.children)}
                    />,
                    ...(isOpen ? node.children.map((child) => (
                      <LeafRow
                        key={child.key}
                        node={child}
                        perms={form.permissions[child.key] ?? {}}
                        onToggle={togglePerm}
                        onSelectAll={() => rowSelectAll(child.key, child.perms)}
                        onClearAll={() => rowClearAll(child.key, child.perms)}
                        isChild
                      />
                    )) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>

          <p className={css.viewNote}>
            View permission is required before granting Create, Edit, Delete, Import, or Export permissions.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GroupHeaderRow({ node, isOpen, onToggleExpand, onSelectAll, onClearAll }) {
  return (
    <tr className={css.groupRow}>
      <td className={css.groupCell} colSpan={ALL_PERMS.length + 2}>
        <div className={css.groupInner}>
          <button className={css.expandBtn} onClick={onToggleExpand} type="button">
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className={css.groupLabel}>{node.label}</span>
          </button>
          <div className={css.rowActions}>
            <button className={css.miniBtn} onClick={onSelectAll} type="button">All</button>
            <button className={css.miniBtn} onClick={onClearAll}  type="button">None</button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function LeafRow({ node, perms, onToggle, onSelectAll, onClearAll, isChild }) {
  return (
    <tr className={`${css.leafRow} ${isChild ? css.childRow : ''}`}>
      <td className={css.moduleCell}>
        <span className={isChild ? css.childLabel : css.moduleLabel}>{node.label}</span>
      </td>
      {ALL_PERMS.map((p) => {
        const applicable = node.perms.includes(p);
        const checked    = applicable && !!perms[p];
        const disabled   = applicable && p !== 'view' && !perms.view;
        return (
          <td key={p} className={css.permCell}>
            {applicable ? (
              <label className={`${css.checkWrap} ${disabled ? css.checkDisabled : ''}`} title={disabled ? 'View permission required' : ''}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(node.key, p, node.perms)}
                  className={css.checkbox}
                />
              </label>
            ) : (
              <span className={css.na}>—</span>
            )}
          </td>
        );
      })}
      <td className={css.rowActionsCell}>
        <button className={css.miniBtn} onClick={onSelectAll} type="button">All</button>
        <button className={css.miniBtn} onClick={onClearAll}  type="button">None</button>
      </td>
    </tr>
  );
}
