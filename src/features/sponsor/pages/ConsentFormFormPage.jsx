/**
 * ConsentFormFormPage — create / edit a consent TEMPLATE's details (Title +
 * Assigned Roles), separate from designing its body.
 *
 * Routes:
 *   consent/config/new                 — create a new consent, then go design it
 *   consent/config/:templateId/edit    — edit an existing consent's details
 *
 * Flow mirrors study creation: capture the metadata first, THEN open the
 * drag-and-drop designer (ConsentFormBuilder at consent/config/:id/design).
 * Reuses SiteRoleFormPage.module.css for the card/footer look.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft } from 'lucide-react';

import FormField          from '@/components/form/FormField';
import SearchableDropdown from '@/components/form/SearchableDropdown';
import { sponsorConsentFormsClient } from '../api/sponsorConsentFormsClient';
import { sponsorRolesClient }        from '../api/sponsorRolesClient';
import { addToast }                  from '@/app/notificationSlice';
import { usePermissions }            from '@/features/auth/usePermissions';
import styles from './SiteRoleFormPage.module.css';

export default function ConsentFormFormPage() {
  const { studyId, templateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { has }  = usePermissions();
  const isEdit   = !!templateId;
  const consentBase = location.pathname.replace(/\/consent\/config.*$/, '/consent/config');
  const canSave  = isEdit ? has('consent_builder', 'edit') : has('consent_builder', 'create');

  const [title,           setTitle]           = useState('');
  const [assignedRoleIds, setAssignedRoleIds] = useState([]);
  const [consentCode,     setConsentCode]     = useState('');
  const [status,          setStatus]          = useState('Draft');
  const [roleOpts,        setRoleOpts]        = useState([]);
  const [errors,          setErrors]          = useState({});
  const [loading,         setLoading]         = useState(isEdit);
  const [saving,          setSaving]          = useState(false);

  // Active site roles for the Assigned Roles picker.
  useEffect(() => {
    sponsorRolesClient.lookup(studyId, { status: 'Active' })
      .then((roles) => setRoleOpts(roles.map((r) => ({ value: r.id, label: r.roleName }))))
      .catch(() => setRoleOpts([]));
  }, [studyId]);

  // Prefill on edit.
  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    sponsorConsentFormsClient.get(templateId)
      .then((f) => {
        setTitle(f.title ?? '');
        setAssignedRoleIds(Array.isArray(f.assignedRoleIds) ? f.assignedRoleIds : []);
        setConsentCode(f.consentCode ?? '');
        setStatus(f.status ?? 'Draft');
      })
      .catch(() => {
        dispatch(addToast({ type: 'error', message: 'Failed to load consent form.' }));
        navigate(consentBase);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const setRoles = (next) => {
    setAssignedRoleIds(next);
    setErrors((p) => { const e = { ...p }; delete e.assignedRoleIds; return e; });
  };

  const handleSubmit = async (goDesign) => {
    const errs = {};
    if (!title.trim())            errs.title           = 'Consent title is required.';
    if (!assignedRoleIds.length)  errs.assignedRoleIds = 'Select at least one role.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await sponsorConsentFormsClient.update(templateId, { title: title.trim(), assignedRoleIds });
        dispatch(addToast({ type: 'success', message: 'Consent details saved.' }));
        navigate(goDesign ? `${consentBase}/${templateId}/design` : consentBase);
      } else {
        const { templateId: newId } = await sponsorConsentFormsClient.create({
          title: title.trim(), assignedRoleIds, content: {},
        });
        dispatch(addToast({ type: 'success', message: 'Consent created — now design the form.' }));
        navigate(`${consentBase}/${newId}/design`);
      }
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message || e?.message || 'Failed to save consent.' }));
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.page}><div className={styles.loadingWrap}><div className={styles.spinner} /></div></div>;
  }

  return (
    <div className={styles.page}>
      <Link to={consentBase} className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Consent Forms
      </Link>
      <h1 className={styles.title}>{isEdit ? 'Edit Consent Details' : 'Create Consent'}</h1>

      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Consent Details</h2>
        {isEdit && consentCode && (
          <p className={styles.cardSub}>Consent Code: <strong>{consentCode}</strong> &middot; Status: {status}</p>
        )}

        <FormField label="Consent Title" name="title" required error={errors.title}>
          <input
            id="title"
            className={errors.title ? `${styles.input} ${styles.inputError}` : styles.input}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors({}); }}
            placeholder="e.g. Main Study Informed Consent"
          />
        </FormField>

        <div style={{ marginTop: 16 }}>
          <FormField
            label="Assigned Roles"
            name="assignedRoleIds"
            required
            error={errors.assignedRoleIds}
            helpText="Select the site role(s) this consent applies to."
          >
            <SearchableDropdown
              multiple
              options={roleOpts}
              value={assignedRoleIds}
              onChange={setRoles}
              placeholder={roleOpts.length === 0 ? 'No site roles' : 'Select roles…'}
              searchPlaceholder="Search roles…"
            />
          </FormField>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.btnCancel} onClick={() => navigate(consentBase)} disabled={saving}>
          Cancel
        </button>
        {isEdit && (
          <button type="button" className={styles.btnCancel} onClick={() => handleSubmit(false)} disabled={saving || !canSave}>
            {saving ? 'Saving…' : 'Save Details'}
          </button>
        )}
        <button type="button" className={styles.btnSave} onClick={() => handleSubmit(true)} disabled={saving || !canSave}>
          {saving ? 'Saving…' : isEdit ? 'Save & Design' : 'Create & Design'}
        </button>
      </div>
    </div>
  );
}
