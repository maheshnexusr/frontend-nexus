/**
 * TeamRoleFormPage — /cro/team/roles/new  (create)
 *                    /cro/team/roles/:roleId  (edit)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link }      from 'react-router-dom';
import { useDispatch }                       from 'react-redux';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { rolesClient }   from '@/features/cro/api/rolesClient';
import { addToast }      from '@/app/notificationSlice';
import FormField         from '@/components/form/FormField';
import TextArea          from '@/components/form/TextArea';
import {
  PERMISSION_GROUPS,
  buildPermissions,
  hasAnyPermission,
  isGroupFullyEnabled,
  isGroupPartiallyEnabled,
} from '@/features/cro/constants/permissionsSchema';
import styles from './TeamRoleFormPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    f.perms.forEach((p) => {
      updated[group.key][f.key][p.key] = value;
    });
  });
  return updated;
}

function setFeature(obj, groupKey, feature, value) {
  const updated = { ...obj, [groupKey]: { ...obj[groupKey] } };
  updated[groupKey][feature.key] = {};
  feature.perms.forEach((p) => {
    updated[groupKey][feature.key][p.key] = value;
  });
  return updated;
}

const EMPTY_FORM = { name: '', description: '' };

// ── Component ─────────────────────────────────────────────────────────────────
export default function TeamRoleFormPage() {
  const { roleId }  = useParams();
  const isEdit      = Boolean(roleId);
  const navigate    = useNavigate();
  const dispatch    = useDispatch();

  const [form,        setForm]        = useState(EMPTY_FORM);
  const [permissions, setPermissions] = useState(buildPermissions(false));
  const [errors,      setErrors]      = useState({});
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(isEdit);
  const [expanded,    setExpanded]    = useState(() =>
    Object.fromEntries(PERMISSION_GROUPS.map((g) => [g.key, true])),
  );

  // Load existing role when editing
  useEffect(() => {
    if (!isEdit) return;
    rolesClient.getById(roleId).then((r) => {
      if (r) {
        setForm({ name: r.name, description: r.description ?? '' });
        setPermissions(r.permissions ?? buildPermissions(false));
      }
      setLoading(false);
    });
  }, [isEdit, roleId]);

  // ── handlers ──────────────────────────────────────────────────────────────
  const setField = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const togglePerm = useCallback((groupKey, featureKey, permKey) => {
    setPermissions((prev) => {
      const cur = prev?.[groupKey]?.[featureKey]?.[permKey] ?? false;
      return setNested(prev, groupKey, featureKey, permKey, !cur);
    });
    setErrors((prev) => ({ ...prev, permissions: undefined }));
  }, []);

  const toggleGroup = useCallback((group) => {
    const allOn = isGroupFullyEnabled(permissions, group.key);
    setPermissions((prev) => setGroup(prev, group, !allOn));
    setErrors((prev) => ({ ...prev, permissions: undefined }));
  }, [permissions]);

  const toggleFeature = useCallback((groupKey, feature) => {
    const allOn = feature.perms.every((p) => permissions?.[groupKey]?.[feature.key]?.[p.key]);
    setPermissions((prev) => setFeature(prev, groupKey, feature, !allOn));
    setErrors((prev) => ({ ...prev, permissions: undefined }));
  }, [permissions]);

  const toggleExpand = (groupKey) =>
    setExpanded((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));

  // ── validation + submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = {};
    if (!form.name.trim())        errs.name        = 'Role Name is required.';
    if (!form.description.trim()) errs.description = 'Description is required.';
    if (!hasAnyPermission(permissions))
      errs.permissions = 'At least one permission must be selected to create the role.';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const taken = await rolesClient.nameExists(form.name.trim(), isEdit ? roleId : null);
      if (taken) {
        setErrors({ name: `Role name '${form.name.trim()}' already exists. Please use a different name.` });
        return;
      }

      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        permissions,
      };

      if (isEdit) {
        await rolesClient.update(roleId, payload);
        dispatch(addToast({ type: 'success', message: `Role '${payload.name}' updated successfully.` }));
      } else {
        await rolesClient.create(payload);
        dispatch(addToast({ type: 'success', message: `Role '${payload.name}' created successfully.` }));
      }
      navigate('/cro/team/roles');
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to create role. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}><div className={styles.spinner} /></div>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      <Link to="/cro/team/roles" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" />
        Roles &amp; Permissions
      </Link>

      <h1 className={styles.title}>{isEdit ? 'Edit Role' : 'Add Role'}</h1>

      {/* ── Role Details card ─────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Role Details</h2>

        <div className={styles.row2}>
          <FormField label="Role Name" name="name" required error={errors.name}>
            <input
              id="name"
              className={ic(styles, errors.name)}
              value={form.name}
              onChange={setField('name')}
              placeholder="e.g. Data Manager"
            />
          </FormField>
        </div>

        <div style={{ marginTop: 16 }}>
          <FormField label="Description" name="description" required error={errors.description}>
            <TextArea
              id="description"
              value={form.description}
              onChange={setField('description')}
              placeholder="Describe what this role can do…"
              rows={3}
              error={!!errors.description}
            />
          </FormField>
        </div>
      </div>

      {/* ── Permissions card ──────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.permHeader}>
          <div>
            <h2 className={styles.cardHeading}>Access Control &amp; Permissions</h2>
            <p className={styles.cardSub}>
              Configure which features and actions this role can access. New roles default to no access.
            </p>
          </div>
          <div className={styles.permHeaderActions}>
            <button
              type="button"
              className={styles.btnSelectAll}
              onClick={() => setPermissions(buildPermissions(true))}
            >
              Select All
            </button>
            <button
              type="button"
              className={styles.btnUnselectAll}
              onClick={() => setPermissions(buildPermissions(false))}
            >
              Unselect All
            </button>
          </div>
        </div>

        {errors.permissions && (
          <p className={styles.permError}>{errors.permissions}</p>
        )}

        <div className={styles.groupList}>
          {PERMISSION_GROUPS.map((group) => {
            const groupOn      = isGroupFullyEnabled(permissions, group.key);
            const groupPartial = isGroupPartiallyEnabled(permissions, group.key);
            const open         = expanded[group.key];
            return (
              <div key={group.key} className={styles.group}>

                {/* Group header */}
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
                      <button type="button" className={styles.groupActionBtn} onClick={() => setPermissions((p) => setGroup(p, group, true))}>
                        Select All
                      </button>
                      <span className={styles.divider} />
                      <button type="button" className={styles.groupActionBtn} onClick={() => setPermissions((p) => setGroup(p, group, false))}>
                        Unselect All
                      </button>
                    </span>
                    <button type="button" className={styles.expandBtn} onClick={() => toggleExpand(group.key)}>
                      {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Features */}
                {open && (
                  <div className={styles.featureList}>
                    {group.features.map((feature) => {
                      const allOn = feature.perms.every((p) => permissions?.[group.key]?.[feature.key]?.[p.key]);
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
                            {feature.desc && (
                              <p className={styles.featureDesc}>{feature.desc}</p>
                            )}
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
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={() => navigate('/cro/team/roles')}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.btnSave}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Role'}
        </button>
      </div>
    </div>
  );
}

// ── Micro SVG icons for checkbox states ──────────────────────────────────────
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

function ic(s, err) {
  return err ? `${s.input} ${s.inputError}` : s.input;
}
