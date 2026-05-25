/**
 * SiteRoleFormPage — full-page Create/Edit Site Role for the sponsor workspace.
 *
 * Routes:
 *   /sponsor/:studyId/roles/new
 *   /sponsor/:studyId/roles/:roleId/edit
 *
 * Mirrors the CRO TeamRoleFormPage layout (top bar with Back, single card
 * with Basic Info + Access Control sections, Cancel/Save footer). Reuses
 * SponsorPermissionsMatrix for the permissions matrix.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft } from 'lucide-react';

import FormField           from '@/components/form/FormField';
import TextArea            from '@/components/form/TextArea';
import SearchableDropdown  from '@/components/form/SearchableDropdown';
import SponsorPermissionsMatrix from '@/features/cro/components/team-members/SponsorPermissionsMatrix';
import DashboardWidgetPicker from '@/features/cro/components/sponsors/DashboardWidgetPicker';
import { buildEmptyPermissions, countPermissions } from '@/features/sponsor/components/roles/permissionsTree';
import { sponsorRolesClient } from '@/features/sponsor/api/sponsorRolesClient';
import { addToast }           from '@/app/notificationSlice';

import styles from './SiteRoleFormPage.module.css';

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

function ic(s, err) { return err ? `${s.input} ${s.inputError}` : s.input; }

export default function SiteRoleFormPage() {
  const { studyId, roleId } = useParams();
  const navigate            = useNavigate();
  const dispatch            = useDispatch();
  const isEdit              = !!roleId;

  const [form,        setForm]        = useState({
    roleName:    '',
    description: '',
    status:      'Active',
  });
  const [permissions, setPermissions] = useState(buildEmptyPermissions());
  // Per-role dashboard whitelist. null = default (category-leaf gating); array
  // (possibly empty) = explicit whitelist of widget IDs this role can see.
  const [widgetKeys,  setWidgetKeys]  = useState(null);
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(isEdit);
  const [saving,      setSaving]      = useState(false);
  const [apiError,    setApiError]    = useState('');

  // ── Load existing role when editing ────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    sponsorRolesClient.getById(studyId, roleId)
      .then((r) => {
        if (!r) return;
        setForm({
          roleName:    r.roleName    ?? '',
          description: r.description ?? '',
          status:      r.status      ?? 'Active',
        });
        setPermissions(r.permissions ?? buildEmptyPermissions());
        setWidgetKeys(Array.isArray(r.dashboardWidgetKeys) ? r.dashboardWidgetKeys : null);
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load role.' })))
      .finally(() => setLoading(false));
  }, [isEdit, studyId, roleId, dispatch]);

  const set = (field) => (val) => {
    const v = val?.target ? val.target.value : val;
    setForm((p) => ({ ...p, [field]: v }));
    setErrors((p) => { const e = { ...p }; delete e[field]; return e; });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = {};
    if (!form.roleName.trim())    errs.roleName    = 'Role Name is required.';
    if (!form.description.trim()) errs.description = 'Description is required.';
    const { enabled } = countPermissions(permissions);
    if (enabled === 0)            errs.permissions = 'Please select at least one permission.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setApiError('');
    setSaving(true);
    try {
      const payload = { ...form, permissions, dashboardWidgetKeys: widgetKeys };
      if (isEdit) {
        await sponsorRolesClient.update(studyId, roleId, payload);
        dispatch(addToast({ type: 'success', message: `Role '${form.roleName}' updated successfully.` }));
      } else {
        await sponsorRolesClient.create(studyId, payload);
        dispatch(addToast({ type: 'success', message: `Role '${form.roleName}' created successfully.` }));
      }
      navigate(`/sponsor/${studyId}/roles`);
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? '';
      if (/already exists|unique/i.test(msg)) {
        setErrors({ roleName: 'Role Name already exists. Please use a unique name.' });
      } else {
        setApiError(msg || 'Failed to save role. Please try again.');
      }
      setSaving(false);
    }
  };

  const handleCancel = () => navigate(`/sponsor/${studyId}/roles`);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}><div className={styles.spinner} /></div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Top bar */}
      <Link to={`/sponsor/${studyId}/roles`} className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Site Roles
      </Link>

      <h1 className={styles.title}>{isEdit ? 'Edit Site Role' : 'Add Site Role'}</h1>

      {/* Role Details card */}
      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Role Details</h2>

        {apiError && <p className={styles.apiError}>{apiError}</p>}

        <div className={styles.row2}>
          <FormField label="Role Name" name="roleName" required error={errors.roleName}>
            <input
              id="roleName"
              className={ic(styles, errors.roleName)}
              value={form.roleName}
              onChange={set('roleName')}
              placeholder="e.g. Site Coordinator"
            />
          </FormField>

          <FormField label="Status" name="status">
            <SearchableDropdown
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={set('status')}
              placeholder="Select status"
            />
          </FormField>
        </div>

        <div style={{ marginTop: 16 }}>
          <FormField label="Description" name="description" required error={errors.description}>
            <TextArea
              id="description"
              value={form.description}
              onChange={set('description')}
              placeholder="Describe what this role can do…"
              rows={3}
              error={!!errors.description}
            />
          </FormField>
        </div>
      </div>

      {/* Permissions card */}
      <div className={styles.card}>
        <div>
          <h2 className={styles.cardHeading}>Access Control &amp; Permissions</h2>
          <p className={styles.cardSub}>
            Configure which sponsor-workspace features this site role can use.
            New roles default to no access.
          </p>
        </div>

        {errors.permissions && (
          <p className={styles.permError}>{errors.permissions}</p>
        )}

        <SponsorPermissionsMatrix
          value={permissions}
          onChange={(next) => {
            setPermissions(next);
            setErrors((p) => { const e = { ...p }; delete e.permissions; return e; });
          }}
        />
      </div>

      {/* Dashboard Cards card */}
      <div className={styles.card}>
        <DashboardWidgetPicker value={widgetKeys} onChange={setWidgetKeys} />
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={handleCancel}
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
