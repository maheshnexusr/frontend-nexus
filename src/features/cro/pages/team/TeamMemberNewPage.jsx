/**
 * TeamMemberNewPage — /cro/team/members/new  (create)
 *                     /cro/team/members/:memberId  (edit)
 *
 * Detects edit mode from useParams().memberId.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { teamMembersClient } from '@/features/cro/api/teamMembersClient';
import { rolesClient }       from '@/features/cro/api/rolesClient';
import { studiesClient }     from '@/features/cro/api/studiesClient';
import { addToast }          from '@/app/notificationSlice';
import FormField             from '@/components/form/FormField';
import SearchableDropdown    from '@/components/form/SearchableDropdown';
import ImageUpload           from '@/components/form/ImageUpload';
import SponsorPermissionsMatrix from '@/features/cro/components/team-members/SponsorPermissionsMatrix';
import { buildEmptyPermissions } from '@/features/sponsor/components/roles/permissionsTree';
import styles from './TeamMemberNewPage.module.css';

const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;

const EMPTY = {
  photograph:      null,
  fullName:        '',
  email:           '',
  roleId:          '',
  roleName:        '',
  contactNumber:   '',
  // [{ studyId, studyTitle, sponsorId, sponsorName, sponsorPermissions }]
  assignedStudies: [],
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
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((r) => ({ value: r.id, label: r.name })),
      ),
    );

    studiesClient.list().then((all) =>
      setStudyOptions(
        all
          // Only PUBLISHED studies are assignable — an unpublished study
          // (draft / configured) has no workspace database, so the assignment
          // would be unusable. Mirrors the backend rule in
          // teamService.assertStudiesAssignable; the backend still rejects
          // anything that slips through.
          .filter((s) => {
            const st = (s.status ?? '').toLowerCase();
            return st !== 'draft' && st !== 'configured';
          })
          .sort((a, b) => (a.studyId ?? '').localeCompare(b.studyId ?? ''))
          .map((s) => ({
            id:          s.id,
            studyId:     s.studyId,
            studyTitle:  s.studyTitle ?? '',
            sponsorId:   s.sponsorId ?? '',
            sponsorName: s.sponsorName ?? 'Unassigned Sponsor',
            // Step 3 toggles — drive which modules show up in the per-study
            // sponsor permissions matrix.
            config: {
              consentManager:      s.consentManager,
              queryManager:        s.queryManager,
              dataManager:         s.dataManager,
              verificationManager: s.verificationManager,
              navigationBar:       s.navigationBar,
            },
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
      // IMPORTANT: backend FK expects cro_studies.study_id (`study.id`),
      // NOT the protocol number (`study.studyId`). We keep both so the UI
      // can still show the human-readable protocol while sending the
      // correct id on save.
      const already = prev.assignedStudies.some((s) => s.id === study.id);
      return {
        ...prev,
        assignedStudies: already
          ? prev.assignedStudies.filter((s) => s.id !== study.id)
          : [
              ...prev.assignedStudies,
              {
                id:                 study.id,           // DB PK — sent in payload
                studyId:            study.studyId,      // protocol number — display only
                studyTitle:         study.studyTitle,
                sponsorId:          study.sponsorId,
                sponsorName:        study.sponsorName,
                sponsorPermissions: buildEmptyPermissions(),
              },
            ],
      };
    });

    // The /studies list endpoint may return lightweight study summaries
    // without the Step-3 `configuration` object — leaving the matrix
    // unable to gate leaves correctly. Pull the full study record (which
    // does include `configuration`) and patch it back into studyOptions
    // so SponsorPermissionsMatrix sees the authoritative toggles.
    const alreadyHasConfig =
      typeof study.config?.consentManager      === 'boolean' &&
      typeof study.config?.queryManager        === 'boolean' &&
      typeof study.config?.dataManager         === 'boolean' &&
      typeof study.config?.verificationManager === 'boolean';

    if (!alreadyHasConfig) {
      studiesClient.getById(study.id).then((full) => {
        if (!full) return;
        setStudyOptions((prev) => prev.map((o) =>
          o.id === study.id
            ? {
                ...o,
                config: {
                  consentManager:      full.consentManager,
                  queryManager:        full.queryManager,
                  dataManager:         full.dataManager,
                  verificationManager: full.verificationManager,
                  navigationBar:       full.navigationBar,
                },
              }
            : o
        ));
      }).catch(() => { /* matrix will fall back to "all visible" */ });
    }
  };

  const setStudyPermissions = (id, nextPerms) => {
    setForm((prev) => ({
      ...prev,
      assignedStudies: prev.assignedStudies.map((s) =>
        s.id === id ? { ...s, sponsorPermissions: nextPerms } : s,
      ),
    }));
  };

  // Group studies by sponsor for display
  const studiesBySponsor = useMemo(() => {
    const map = new Map();
    for (const s of studyOptions) {
      const key = s.sponsorId || '__unassigned__';
      if (!map.has(key)) map.set(key, { sponsorId: s.sponsorId, sponsorName: s.sponsorName, studies: [] });
      map.get(key).studies.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.sponsorName.localeCompare(b.sponsorName));
  }, [studyOptions]);

  const [openSponsorGroups, setOpenSponsorGroups] = useState({});
  const [openStudyPerms,    setOpenStudyPerms]    = useState({});

  const toggleSponsorGroup = (key) =>
    setOpenSponsorGroups((p) => ({ ...p, [key]: p[key] === undefined ? false : !p[key] }));

  const toggleStudyPerms = (studyId) =>
    setOpenStudyPerms((p) => ({ ...p, [studyId]: !p[studyId] }));

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
            <h2 className={styles.cardHeading}>Study Assignment & Sponsor Permissions</h2>
            <p className={styles.cardSub}>
              Select studies and grant sponsor-workspace permissions for each one.
              CRO menu access is controlled by the role above.
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
          <div className={styles.sponsorGroupList}>
            {studiesBySponsor.map((group) => {
              const groupKey = group.sponsorId || '__unassigned__';
              const groupOpen = openSponsorGroups[groupKey] !== false;
              const checkedCount = group.studies.filter((s) =>
                form.assignedStudies.some((a) => a.id === s.id),
              ).length;

              return (
                <div key={groupKey} className={styles.sponsorGroup}>
                  <button
                    type="button"
                    className={styles.sponsorGroupHead}
                    onClick={() => toggleSponsorGroup(groupKey)}
                  >
                    {groupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Building2 size={14} className={styles.sponsorGroupIcon} />
                    <span className={styles.sponsorGroupName}>{group.sponsorName}</span>
                    <span className={styles.sponsorGroupCount}>
                      {checkedCount > 0 ? `${checkedCount}/${group.studies.length}` : group.studies.length}
                    </span>
                  </button>

                  {groupOpen && (
                    <div className={styles.studyList}>
                      {group.studies.map((study) => {
                        const checked  = form.assignedStudies.some((s) => s.id === study.id);
                        const assigned = form.assignedStudies.find((s) => s.id === study.id);
                        const permsOpen = !!openStudyPerms[study.id];

                        return (
                          <div key={study.id} className={styles.studyRowBlock}>
                            <div
                              className={`${styles.studyItem} ${checked ? styles.studyItemActive : ''}`}
                            >
                              <button
                                type="button"
                                className={styles.studyItemMain}
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

                              {checked && (
                                <button
                                  type="button"
                                  className={styles.studyExpandBtn}
                                  onClick={() => toggleStudyPerms(study.id)}
                                  title={permsOpen ? 'Hide permissions' : 'Configure sponsor permissions'}
                                >
                                  {permsOpen ? 'Hide permissions' : 'Configure permissions'}
                                  {permsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                              )}
                            </div>

                            {checked && permsOpen && (
                              <SponsorPermissionsMatrix
                                value={assigned?.sponsorPermissions}
                                onChange={(next) => setStudyPermissions(study.id, next)}
                                studyConfig={study.config}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
