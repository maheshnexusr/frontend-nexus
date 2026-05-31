/**
 * SiteEnrollSubjectModal — modal form for enrolling a new subject at the
 * site personnel's own site. study_id + site_id are NOT collected here:
 *  - study_id / environment are injected by siteAxiosClient from the chosen
 *    study context
 *  - site_id is taken from the JWT by the backend (never trusted from the
 *    request body)
 *
 * Fields:
 *   Subject Number (string, optional but recommended)
 *   External ID    (string, optional)
 *   Screening Status   (Screening | Screen Failed | Eligible | Ineligible)
 *   Enrollment Status  (Pending | Enrolled | Withdrawn | Completed)
 */

import { useState, useEffect } from 'react';
import Modal from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import styles from './SiteEnrollSubjectModal.module.css';

const SCREENING_OPTIONS = [
  { value: 'Screening',     label: 'Screening' },
  { value: 'Screen Failed', label: 'Screen Failed' },
  { value: 'Eligible',      label: 'Eligible' },
  { value: 'Ineligible',    label: 'Ineligible' },
];

const ENROLLMENT_OPTIONS = [
  { value: 'Pending',    label: 'Pending' },
  { value: 'Enrolled',   label: 'Enrolled' },
  { value: 'Withdrawn',  label: 'Withdrawn' },
  { value: 'Completed',  label: 'Completed' },
];

const EMPTY = {
  externalId:       '',
  screeningStatus:  'Screening',
  enrollmentStatus: 'Pending',
};

export default function SiteEnrollSubjectModal({ open, onClose, onSaved, onError }) {
  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(EMPTY); setErrors({}); }
  }, [open]);

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = () => {
    // The Subject ID is assigned automatically by the backend
    // (SUB-<site_number>-<seq>), so there is no manual identifier to validate.
    setErrors({});
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const payload = {
        externalId:       form.externalId.trim() || null,
        screeningStatus:  form.screeningStatus,
        enrollmentStatus: form.enrollmentStatus,
      };
      const res = await siteWorkspaceClient.createSubject(payload);
      onSaved?.(res);
    } catch (err) {
      onError?.(err?.message ?? 'Failed to create subject.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Enroll Subject"
      size="md"
      footer={
        <>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
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
            {saving ? 'Saving…' : 'Create Subject'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.body}>
        <div
          style={{
            background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
            padding: '10px 12px', fontSize: 12.5, color: '#075985',
            marginBottom: 4, lineHeight: 1.5,
          }}
        >
          A Subject ID is assigned automatically on save — formatted as{' '}
          <strong>SUB-&lt;site&gt;-&lt;sequence&gt;</strong> (e.g. SUB-SUN001-1001).
        </div>

        <FormField
          label="External ID"
          name="externalId"
          helpText="Optional — for cross-referencing in external systems."
        >
          <input
            id="externalId"
            type="text"
            className={styles.input}
            value={form.externalId}
            onChange={setField('externalId')}
            placeholder="Optional"
          />
        </FormField>

        <div className={styles.row2}>
          <FormField label="Screening Status" name="screeningStatus">
            <select
              id="screeningStatus"
              className={styles.input}
              value={form.screeningStatus}
              onChange={setField('screeningStatus')}
            >
              {SCREENING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Enrollment Status" name="enrollmentStatus">
            <select
              id="enrollmentStatus"
              className={styles.input}
              value={form.enrollmentStatus}
              onChange={setField('enrollmentStatus')}
            >
              {ENROLLMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
