/**
 * SitePersonnelModal — invite a new site personnel or edit an existing one.
 *
 * The site-side invite/edit flow is a modal rather than a dedicated page (the
 * sponsor side uses a full PersonnelFormPage with compensation / consent /
 * site selection — none of which apply to site personnel managing their own
 * site). Fields here match what the backend invite/update endpoints accept:
 * full_name, email_address (invite only), contact_number, role_id (or role
 * name — backend resolves either), status (edit only).
 */

import { useState, useEffect } from 'react';
import Modal from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import { siteSitePersonnelClient } from '@/features/site/api/siteSitePersonnelClient';
import styles from './SitePersonnelModal.module.css';

const STATUS_OPTIONS = [
  { value: 'Invited',  label: 'Invited' },
  { value: 'Active',   label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

const EMPTY = {
  fullName:      '',
  email:         '',
  contactNumber: '',
  roleId:        '',
  status:        'Invited',
};

export default function SitePersonnelModal({ open, mode, personnel, onClose, onSaved, onError }) {
  const isEdit = mode === 'edit';

  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (isEdit && personnel) {
      setForm({
        fullName:      personnel.fullName     ?? '',
        email:         personnel.email        ?? '',
        contactNumber: personnel.contactNumber ?? '',
        roleId:        personnel.roleId       ?? personnel.role ?? '',
        status:        personnel.status       ?? 'Invited',
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, isEdit, personnel]);

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Full name is required.';
    if (!isEdit && !form.email.trim()) next.email = 'Email is required.';
    if (!isEdit && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Enter a valid email address.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!validate() || saving) return;
    setSaving(true);
    try {
      let res;
      if (isEdit) {
        res = await siteSitePersonnelClient.update('', personnel.id, {
          fullName:      form.fullName.trim(),
          contactNumber: form.contactNumber.trim() || null,
          roleId:        form.roleId.trim() || null,
          status:        form.status,
        });
      } else {
        res = await siteSitePersonnelClient.invite('', {
          fullName:      form.fullName.trim(),
          email:         form.email.trim(),
          contactNumber: form.contactNumber.trim() || null,
          roleId:        form.roleId.trim() || null,
        });
      }
      onSaved?.(res);
    } catch (err) {
      onError?.(err?.message ?? `Failed to ${isEdit ? 'update' : 'invite'} personnel.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? 'Edit Personnel' : 'Invite Personnel'}
      size="md"
      footer={
        <>
          <button type="button" className={styles.btnCancel} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={styles.btnSave} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Send Invitation'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.body}>
        <FormField label="Full Name" name="fullName" required error={errors.fullName}>
          <input
            id="fullName"
            type="text"
            className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
            value={form.fullName}
            onChange={setField('fullName')}
            autoFocus
          />
        </FormField>

        <FormField
          label="Email"
          name="email"
          required={!isEdit}
          error={errors.email}
          helpText={isEdit ? 'Email cannot be changed after invitation.' : ''}
        >
          <input
            id="email"
            type="email"
            className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
            value={form.email}
            onChange={setField('email')}
            disabled={isEdit}
            placeholder="name@example.com"
          />
        </FormField>

        <div className={styles.row2}>
          <FormField label="Contact Number" name="contactNumber">
            <input
              id="contactNumber"
              type="tel"
              className={styles.input}
              value={form.contactNumber}
              onChange={setField('contactNumber')}
              placeholder="Optional"
            />
          </FormField>

          <FormField label="Role" name="roleId" helpText="Site role name or ID for this study.">
            <input
              id="roleId"
              type="text"
              className={styles.input}
              value={form.roleId}
              onChange={setField('roleId')}
              placeholder="e.g. Principal Investigator"
            />
          </FormField>
        </div>

        {isEdit && (
          <FormField label="Status" name="status">
            <select
              id="status"
              className={styles.input}
              value={form.status}
              onChange={setField('status')}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FormField>
        )}
      </form>
    </Modal>
  );
}
