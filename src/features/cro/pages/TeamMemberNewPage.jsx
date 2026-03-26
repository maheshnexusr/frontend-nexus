/**
 * TeamMemberNewPage — /cro/team/members/new  (create)
 *                     /cro/team/members/:memberId  (edit)
 *
 * Detects edit mode from useParams().memberId.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { teamMembersClient } from '@/features/cro/api/teamMembersClient';
import { rolesClient }       from '@/features/cro/api/rolesClient';
import { studiesClient }     from '@/features/cro/api/studiesClient';
import { addToast }          from '@/features/notifications/notificationSlice';
import FormField             from '@/components/form/FormField';
import SearchableDropdown    from '@/components/form/SearchableDropdown';
import ImageUpload           from '@/components/form/ImageUpload';
import styles from './TeamMemberNewPage.module.css';

const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;

const EMPTY = {
  photograph:      null,
  fullName:        '',
  email:           '',
  roleId:          '',
  roleName:        '',
  contactNumber:   '',
  assignedStudies: [],   // [{ studyId, studyTitle }]
};

export default function TeamMemberNewPage() {
  const { memberId } = useParams();
  const isEdit       = Boolean(memberId);
  const navigate     = useNavigate();
  const dispatch     = useDispatch();

  const [form,           setForm]         = useState(EMPTY);
  const [errors,         setErrors]       = useState({});
  const [saving,         setSaving]       = useState(false);
  const [loadingData,    setLoadingData]  = useState(isEdit);
  const [roleOptions,    setRoleOptions]  = useState([]);
  const [studyOptions,   setStudyOptions] = useState([]);

  // Load roles + studies (and member data when editing)
  useEffect(() => {
    rolesClient.list().then((all) =>
      setRoleOptions(
        all
          .filter((r) => r.status === 'Active')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => ({ value: r.id, label: r.name })),
      ),
    );

    studiesClient.list().then((all) =>
      setStudyOptions(
        all
          .sort((a, b) => (a.studyId ?? '').localeCompare(b.studyId ?? ''))
          .map((s) => ({
            id:         s.id,
            studyId:    s.studyId,
            studyTitle: s.studyTitle ?? '',
          })),
      ),
    );
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    teamMembersClient.getById(memberId).then((m) => {
      if (m) setForm({ ...EMPTY, ...m });
      setLoadingData(false);
    });
  }, [isEdit, memberId]);

  // ── field helpers ─────────────────────────────────────────────────────────
  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleRoleChange = (id) => {
    const opt = roleOptions.find((o) => o.value === id);
    setForm((prev) => ({ ...prev, roleId: id, roleName: opt?.label ?? '' }));
    setErrors((prev) => ({ ...prev, roleId: undefined }));
  };

  const toggleStudy = (study) => {
    setForm((prev) => {
      const already = prev.assignedStudies.some((s) => s.studyId === study.studyId);
      return {
        ...prev,
        assignedStudies: already
          ? prev.assignedStudies.filter((s) => s.studyId !== study.studyId)
          : [...prev.assignedStudies, { studyId: study.studyId, studyTitle: study.studyTitle }],
      };
    });
  };

  // ── validation + submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = {};

    if (!form.photograph)             errs.photograph    = 'Photograph is required.';
    if (!form.fullName.trim())        errs.fullName      = 'Full Name is required.';
    if (!form.email.trim())           errs.email         = 'Email Address is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email.trim()))
                                      errs.email         = 'Please enter a valid email address.';
    if (!form.roleId)                 errs.roleId        = 'Please assign a role.';
    if (form.contactNumber.trim() && !PHONE_RE.test(form.contactNumber.trim()))
                                      errs.contactNumber = 'Please enter a valid contact number.';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      // Unique email check
      const taken = await teamMembersClient.emailExists(
        form.email.trim(),
        isEdit ? memberId : null,
      );
      if (taken) {
        setErrors({ email: 'Email Address already exists in the system.' });
        return;
      }

      const payload = {
        photograph:      form.photograph,
        fullName:        form.fullName.trim(),
        email:           form.email.trim().toLowerCase(),
        roleId:          form.roleId,
        roleName:        form.roleName,
        contactNumber:   form.contactNumber.trim(),
        assignedStudies: form.assignedStudies,
      };

      if (isEdit) {
        await teamMembersClient.update(memberId, payload);
        dispatch(addToast({
          type:    'success',
          message: `Team Member '${payload.fullName}' updated successfully.`,
        }));
      } else {
        await teamMembersClient.create(payload);
        dispatch(addToast({
          type:    'success',
          message: `Team Member '${payload.fullName}' created successfully. An email has been sent to ${payload.email}.`,
          duration: 6000,
        }));
      }
      navigate('/cro/team/members');
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to create team member. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Back */}
      <Link to="/cro/team/members" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" />
        Team Members
      </Link>

      <h1 className={styles.title}>
        {isEdit ? 'Edit Team Member' : 'Add Team Member'}
      </h1>

      {/* ── Main card ────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Basic Information</h2>

        <div className={styles.photoRow}>
          {/* Photo upload — left */}
          <div className={styles.photoCol}>
            <p className={styles.photoLabel}>
              Photograph <span className={styles.req}>*</span>
            </p>
            <ImageUpload
              value={form.photograph}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, photograph: val }));
                setErrors((prev) => ({ ...prev, photograph: undefined }));
              }}
              accept="image/jpeg,image/jpg,image/png"
              maxSize={3}
              circular
              error={!!errors.photograph}
            />
            {errors.photograph && (
              <p className={styles.photoError}>{errors.photograph}</p>
            )}
            <p className={styles.photoHint}>
              JPEG or PNG · max 3 MB<br />Recommended 300 × 300 px
            </p>
          </div>

          {/* Fields — right */}
          <div className={styles.fieldsCol}>
            <div className={styles.row2}>
              <FormField label="Full Name" name="fullName" required error={errors.fullName}>
                <input
                  id="fullName"
                  className={ic(styles, errors.fullName)}
                  value={form.fullName}
                  onChange={set('fullName')}
                  placeholder="e.g. Jane Smith"
                />
              </FormField>
              <FormField label="Email Address" name="email" required error={errors.email}>
                <input
                  id="email"
                  type="email"
                  className={ic(styles, errors.email)}
                  value={form.email}
                  onChange={set('email')}
                  placeholder="e.g. jane@example.com"
                />
              </FormField>
            </div>

            <div className={styles.row2}>
              <FormField label="Assign Role" name="roleId" required error={errors.roleId}>
                <SearchableDropdown
                  options={roleOptions}
                  value={form.roleId}
                  onChange={handleRoleChange}
                  placeholder="Select role…"
                  searchPlaceholder="Search roles…"
                />
              </FormField>
              <FormField label="Contact Number" name="contactNumber" error={errors.contactNumber}>
                <input
                  id="contactNumber"
                  className={ic(styles, errors.contactNumber)}
                  value={form.contactNumber}
                  onChange={set('contactNumber')}
                  placeholder="e.g. +1 555 000 0000"
                />
              </FormField>
            </div>
          </div>
        </div>
      </div>

      {/* ── Study Assignment ─────────────────────────────────────────────── */}
      <div className={styles.card}>
        <div className={styles.studyCardHeader}>
          <div>
            <h2 className={styles.cardHeading}>Study Assignment</h2>
            <p className={styles.cardSub}>
              Select one or more studies to assign to this team member.
            </p>
          </div>
          {form.assignedStudies.length > 0 && (
            <span className={styles.assignedBadge}>
              {form.assignedStudies.length} assigned
            </span>
          )}
        </div>

        {studyOptions.length === 0 ? (
          <div className={styles.noStudies}>
            <BookOpen size={28} strokeWidth={1.25} className={styles.noStudiesIcon} />
            <p>No studies available yet.</p>
          </div>
        ) : (
          <div className={styles.studyList}>
            {studyOptions.map((study) => {
              const checked = form.assignedStudies.some((s) => s.studyId === study.studyId);
              return (
                <button
                  key={study.studyId}
                  type="button"
                  className={`${styles.studyItem} ${checked ? styles.studyItemActive : ''}`}
                  onClick={() => toggleStudy(study)}
                >
                  <span className={`${styles.studyCheck} ${checked ? styles.studyCheckActive : ''}`}>
                    {checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <div className={styles.studyInfo}>
                    <span className={styles.studyId}>{study.studyId}</span>
                    {study.studyTitle && (
                      <span className={styles.studyTitle}>{study.studyTitle}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={() => navigate('/cro/team/members')}
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
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Team Member'}
        </button>
      </div>
    </div>
  );
}

function ic(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
