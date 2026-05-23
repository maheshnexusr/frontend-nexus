/**
 * SponsorRoleFormPage — /cro/sponsor-roles/new      (create)
 *                       /cro/sponsor-roles/:roleId  (edit)
 *
 * Mirrors TeamRoleFormPage (CRO roles) and reuses its stylesheet; the
 * permission grid is the shared SponsorPermissionMatrix.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft } from 'lucide-react';
import { sponsorRolesClient } from '@/features/cro/api/sponsorRolesClient';
import { addToast } from '@/app/notificationSlice';
import FormField from '@/components/form/FormField';
import TextArea from '@/components/form/TextArea';
import SponsorPermissionMatrix from '@/features/cro/components/sponsors/SponsorPermissionMatrix';
import {
  buildPermissions,
  hasAnyPermission,
} from '@/features/cro/constants/sponsorPermissionsSchema';
import styles from '../team/TeamRoleFormPage.module.css';

const EMPTY_FORM = { name: '', description: '' };

// ── Component ─────────────────────────────────────────────────────────────────
export default function SponsorRoleFormPage() {
  const { roleId } = useParams();
  const isEdit     = Boolean(roleId);
  const navigate   = useNavigate();
  const dispatch   = useDispatch();

  const [form,        setForm]        = useState(EMPTY_FORM);
  const [permissions, setPermissions] = useState(buildPermissions(false));
  const [errors,      setErrors]      = useState({});
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    sponsorRolesClient.getById(roleId).then((r) => {
      if (r) {
        setForm({ name: r.name, description: r.description ?? '' });
        setPermissions(r.permissions ?? buildPermissions(false));
      }
      setLoading(false);
    });
  }, [isEdit, roleId]);

  const setField = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handlePermissionsChange = (next) => {
    setPermissions(next);
    setErrors((prev) => ({ ...prev, permissions: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.name.trim())        errs.name        = 'Role Name is required.';
    if (!form.description.trim()) errs.description = 'Description is required.';
    if (!hasAnyPermission(permissions))
      errs.permissions = 'At least one permission must be selected to create the role.';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        permissions,
      };
      if (isEdit) {
        await sponsorRolesClient.update(roleId, payload);
        dispatch(addToast({ type: 'success', message: `Sponsor role '${payload.name}' updated successfully.` }));
      } else {
        await sponsorRolesClient.create(payload);
        dispatch(addToast({ type: 'success', message: `Sponsor role '${payload.name}' created successfully.` }));
      }
      navigate('/cro/sponsor-roles');
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to save role. Please try again.' }));
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

  return (
    <div className={styles.page}>

      <Link to="/cro/sponsor-roles" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" />
        Sponsor Roles
      </Link>

      <h1 className={styles.title}>{isEdit ? 'Edit Sponsor Role' : 'Add Sponsor Role'}</h1>

      {/* ── Role Details ──────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Role Details</h2>

        <div className={styles.row2}>
          <FormField label="Role Name" name="name" required error={errors.name}>
            <input
              id="name"
              className={ic(styles, errors.name)}
              value={form.name}
              onChange={setField('name')}
              placeholder="e.g. Sponsor Coordinator"
            />
          </FormField>
        </div>

        <div style={{ marginTop: 16 }}>
          <FormField label="Description" name="description" required error={errors.description}>
            <TextArea
              id="description"
              value={form.description}
              onChange={setField('description')}
              placeholder="Describe what this sponsor role can do…"
              rows={3}
              error={!!errors.description}
            />
          </FormField>
        </div>
      </div>

      {/* ── Permissions ───────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <SponsorPermissionMatrix
          value={permissions}
          onChange={handlePermissionsChange}
          error={errors.permissions}
          subtitle="Configure which sponsor-workspace features and actions this role can access. New roles default to no access."
        />
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={() => navigate('/cro/sponsor-roles')}
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

function ic(s, err) {
  return err ? `${s.input} ${s.inputError}` : s.input;
}
