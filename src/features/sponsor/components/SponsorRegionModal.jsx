import { useState, useEffect } from 'react';
import Modal from '@/components/feedback/Modal';
import { sponsorRegionsClient } from '@/features/sponsor/api/sponsorRegionsClient';
import css from './SponsorRegionModal.module.css';

const EMPTY = { regionName: '', description: '', status: 'Active' };

export default function SponsorRegionModal({ mode, region, studyId, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,   setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && region) {
      setForm({
        regionName:  region.regionName,
        description: region.description ?? '',
        status:      region.status,
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [isEdit, region]);

  const set = (field) => (e) => {
    const val = typeof e === 'string' ? e : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.regionName.trim()) errs.regionName = 'Region Name is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const saved = isEdit
        ? await sponsorRegionsClient.update(studyId, region.id, form)
        : await sponsorRegionsClient.create(studyId, form);
      onSave(saved);
    } catch {
      onError(isEdit
        ? 'Failed to update region. Please try again.'
        : 'Failed to create region. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button className={css.btnCancel} onClick={onClose} disabled={saving} type="button">Cancel</button>
      <button className={css.btnSave} onClick={handleSubmit} disabled={saving} type="button">
        {saving ? 'Saving…' : isEdit ? 'Update Region' : 'Create Region'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Region' : 'Add Region'}
      size="sm"
      footer={footer}
    >
      <div className={css.body}>
        <div className={css.field}>
          <label className={css.label} htmlFor="regionName">
            Region Name <span className={css.req}>*</span>
          </label>
          <input
            id="regionName"
            className={`${css.input} ${errors.regionName ? css.inputError : ''}`}
            value={form.regionName}
            onChange={set('regionName')}
            placeholder="e.g. North America, Europe, Asia-Pacific…"
            autoFocus
          />
          {errors.regionName && <span className={css.fieldError}>{errors.regionName}</span>}
        </div>

        <div className={css.field}>
          <label className={css.label} htmlFor="description">
            Description <span className={css.optional}>(optional)</span>
          </label>
          <textarea
            id="description"
            className={css.textarea}
            value={form.description}
            onChange={set('description')}
            rows={3}
            placeholder="List the countries covered or describe the region's scope…"
          />
        </div>

        <div className={css.field}>
          <label className={css.label} htmlFor="status">Status</label>
          <select id="status" className={css.input} value={form.status} onChange={set('status')}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
