/**
 * StudyWizardStep1 — Basic Info
 *
 * Fields:
 *   Study ID / Protocol Number (required, unique)
 *   Study Title                (required)
 *   Study Phase                (required — SearchableDropdown from studyPhasesClient)
 *   Scope of Study             (required — single-select: EDC / Survey / ePRO)
 *   Therapeutic Area           (optional)
 *   Study Description          (optional — TextArea)
 *   Sponsor Name               (required — SearchableDropdown from sponsorsClient)
 *
 * Footer: Cancel → /cro/studies | Next → validate + dispatch setStep1 + navigate step-2
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate }                      from 'react-router-dom';
import { useDispatch, useSelector }         from 'react-redux';
import { RefreshCw, Check, Database, ClipboardList, Smartphone } from 'lucide-react';
import { studyPhasesClient }   from '@/features/cro/api/studyPhasesClient';
import { sponsorsClient }      from '@/features/cro/api/sponsorsClient';
import { studiesClient }       from '@/features/cro/api/studiesClient';
import { setStep1, selectStep1, selectStep3 } from '@/features/cro/store/studyWizardSlice';
import DashboardWidgetPicker from '@/features/cro/components/sponsors/DashboardWidgetPicker';
import { addToast }            from '@/app/notificationSlice';
import FormField               from '@/components/form/FormField';
import TextArea                from '@/components/form/TextArea';
import SearchableDropdown      from '@/components/form/SearchableDropdown';
import SponsorPermissionMatrix from '@/features/cro/components/sponsors/SponsorPermissionMatrix';
import {
  buildPermissions,
  hasAnyPermission,
} from '@/features/cro/constants/sponsorPermissionsSchema';
import styles from './StudyWizardStep1.module.css';

// Site Management features (sites / personnel / roles) exist for studies run at
// sites by site staff — EDC and Survey (site personnel give the survey). Only
// ePRO (direct patient reporting) hides + clears them. Keep in sync with
// SponsorLayout's Site Management gating and the backend scope filter.
const SITE_MGMT_FEATURES = ['sites', 'site_personnel', 'site_roles'];
const hiddenForScope = (scope) =>
  (scope === 'ePRO') ? SITE_MGMT_FEATURES : [];

// Step 3 module toggles drive whether the corresponding sponsor-permissions
// leaf is even configurable on Step 1. If a CRO disables Query Manager /
// Verification Manager on Step 3, hiding the leaf here prevents granting a
// permission the study can never exercise (and matches the spec: "Sponsor
// permissions – Query Manager shall be shown to configure it (Otherwise
// hidden)").
const hiddenForStep3 = (step3) => {
  const hidden = [];
  if (!step3?.queryManager)        hidden.push('query_manager');
  if (!step3?.verificationManager) hidden.push('data_verification');
  return hidden;
};

// Zero out the site-management group when the scope can't support it, so a
// scope switch never leaves a stale, hidden grant behind.
function clearOutOfScope(perms, scope) {
  if (!hiddenForScope(scope).length) return perms;
  return { ...perms, sitesGroup: buildPermissions(false).sitesGroup };
}

const SCOPE_OPTIONS = [
  {
    value: 'EDC',
    label: 'EDC',
    desc:  'Electronic Data Capture',
    Icon:  Database,
    color: '#2563eb',
    bg:    '#eff6ff',
  },
  {
    value: 'Survey',
    label: 'Survey',
    desc:  'Online survey collection',
    Icon:  ClipboardList,
    color: '#7c3aed',
    bg:    '#f5f3ff',
  },
  {
    value: 'ePRO',
    label: 'ePRO',
    desc:  'Electronic Patient Reported Outcomes',
    Icon:  Smartphone,
    color: '#0891b2',
    bg:    '#ecfeff',
  },
];

export default function StudyWizardStep1({ onNext, onCancel }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const saved    = useSelector(selectStep1);
  const step3    = useSelector(selectStep3);

  // Backwards-compat: older state may still hold scope as an array; coerce to string.
  const initialScope = Array.isArray(saved.scope)
    ? (saved.scope[0] ?? '')
    : (saved.scope ?? '');

  const [form, setForm] = useState({
    studyId:          saved.studyId          ?? '',
    studyTitle:       saved.studyTitle       ?? '',
    studyPhaseId:     saved.studyPhaseId     ?? '',
    studyPhaseName:   saved.studyPhaseName   ?? '',
    scope:            initialScope,
    therapeuticArea:  saved.therapeuticArea  ?? '',
    studyDescription: saved.studyDescription ?? '',
    sponsorId:        saved.sponsorId        ?? '',
    sponsorName:      saved.sponsorName      ?? '',
    sponsorFullName:  saved.sponsorFullName  ?? '',
    // Per-study sponsor workspace permissions (nested matrix shape).
    sponsorPermissions: saved.sponsorPermissions ?? buildPermissions(false),
    // Per-study dashboard widget whitelist for the sponsor on this study.
    // null = no per-study cap (sponsor's role-level whitelist applies as-is);
    // array = explicit cap intersected with the role's whitelist by buildSponsorView.
    sponsorDashboardWidgetKeys:
      Array.isArray(saved.sponsorDashboardWidgetKeys) ? saved.sponsorDashboardWidgetKeys : null,
    // How site personnel invited to this study activate their account.
    activationMethod: saved.activationMethod ?? 'PASSWORD',
  });

  const [errors,          setErrors]          = useState({});
  const [saving,          setSaving]          = useState(false);
  const [phaseOptions,    setPhaseOptions]    = useState([]);
  const [sponsorOptions,  setSponsorOptions]  = useState([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(true);

  // Load study phases once
  useEffect(() => {
    studyPhasesClient.list().then((all) =>
      setPhaseOptions(
        all
          .filter((p) => p.status === 'Active')
          .sort((a, b) => a.phaseName.localeCompare(b.phaseName))
          .map((p) => ({ value: p.id, label: p.phaseName })),
      ),
    );
  }, []);

  // Load sponsors — callable on demand (mount, window focus, manual refresh)
  const loadSponsors = useCallback(() => {
    setSponsorsLoading(true);
    sponsorsClient.list()
      .then((all) => {
        setSponsorOptions(
          all
            .filter((s) => s.status === 'Active')
            .sort((a, b) =>
              (a.organizationName || a.fullName || '').localeCompare(
                b.organizationName || b.fullName || '',
              ),
            )
            .map((s) => {
              const org    = s.organizationName  || '';
              const person = s.fullName          || '';
              const reg    = s.registrationNumber || '';
              // Format: "Sponsor Name — Organisation (RegNumber)"; fall back if either is missing.
              const head   = person || org || '(unnamed)';
              const tail   = person && org ? ` — ${org}` : '';
              const regSfx = reg ? ` (${reg})` : '';
              return {
                value:            s.id,
                label:            `${head}${tail}${regSfx}`,
                organizationName: org,
                fullName:         person,
              };
            }),
        );
      })
      .catch(() => {
        setSponsorOptions([]);
        dispatch(addToast({ type: 'error', message: 'Failed to load sponsors. Please refresh.', duration: 4000 }));
      })
      .finally(() => setSponsorsLoading(false));
  }, [dispatch]);

  useEffect(() => {
    loadSponsors();
    window.addEventListener('focus', loadSponsors);
    return () => window.removeEventListener('focus', loadSponsors);
  }, [loadSponsors]);

  // ── helpers ─────────────────────────────────────────────────────────────────
  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handlePhaseChange = (id) => {
    const opt = phaseOptions.find((o) => o.value === id);
    setForm((prev) => ({ ...prev, studyPhaseId: id, studyPhaseName: opt?.label ?? '' }));
    setErrors((prev) => ({ ...prev, studyPhaseId: undefined }));
  };

  const handleSponsorChange = (id) => {
    const opt = sponsorOptions.find((o) => o.value === id);
    setForm((prev) => ({
      ...prev,
      sponsorId:        id,
      // Canonical sponsorName for downstream display = organization name; fall back to person.
      sponsorName:      opt?.organizationName || opt?.fullName || '',
      sponsorFullName:  opt?.fullName || '',
    }));
    setErrors((prev) => ({ ...prev, sponsorId: undefined }));
  };

  const selectScope = (val) => {
    setForm((prev) => ({
      ...prev,
      scope: val,
      // Drop site-management grants the new scope can't support.
      sponsorPermissions: clearOutOfScope(prev.sponsorPermissions, val),
    }));
    setErrors((prev) => ({ ...prev, scope: undefined }));
  };

  const setPermissions = (next) => {
    setForm((prev) => ({ ...prev, sponsorPermissions: next }));
    setErrors((prev) => ({ ...prev, sponsorPermissions: undefined }));
  };

  // Save current form state to Redux then navigate to Add Sponsor
  const handleAddSponsor = () => {
    dispatch(setStep1({
      studyId:          form.studyId.trim(),
      studyTitle:       form.studyTitle.trim(),
      studyPhaseId:     form.studyPhaseId,
      studyPhaseName:   form.studyPhaseName,
      scope:            form.scope,
      therapeuticArea:  form.therapeuticArea.trim(),
      studyDescription: form.studyDescription.trim(),
      sponsorId:        form.sponsorId,
      sponsorName:      form.sponsorName,
      sponsorFullName:  form.sponsorFullName,
      sponsorPermissions: form.sponsorPermissions,
      sponsorDashboardWidgetKeys: form.sponsorDashboardWidgetKeys,
      activationMethod: form.activationMethod,
    }));
    navigate('/cro/sponsors/new');
  };

  // ── validation + API call + next ─────────────────────────────────────────────
  const handleNext = async () => {
    const errs = {};
    if (!form.studyId.trim())    errs.studyId    = 'Study ID / Protocol Number is required.';
    if (!form.studyTitle.trim()) errs.studyTitle  = 'Study Title is required.';
    if (!form.studyPhaseId)      errs.studyPhaseId = 'Please select a Study Phase.';
    if (!form.scope)             errs.scope       = 'Please select a Scope of Study.';
    if (!form.sponsorId)         errs.sponsorId   = 'Please select a Sponsor.';
    if (!hasAnyPermission(form.sponsorPermissions))
      errs.sponsorPermissions = 'Assign at least one sponsor workspace permission for this study.';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const payload = {
      studyId:          form.studyId.trim(),
      studyTitle:       form.studyTitle.trim(),
      studyPhaseId:     form.studyPhaseId,
      studyPhaseName:   form.studyPhaseName,
      scope:            form.scope,
      therapeuticArea:  form.therapeuticArea.trim(),
      studyDescription: form.studyDescription.trim(),
      sponsorId:        form.sponsorId,
      sponsorName:      form.sponsorName,
      sponsorFullName:  form.sponsorFullName,
      sponsorPermissions: form.sponsorPermissions,
      sponsorDashboardWidgetKeys: form.sponsorDashboardWidgetKeys,
      activationMethod: form.activationMethod,
    };

    setSaving(true);
    try {
      let study;
      if (saved.studyDbId) {
        // Edit — update existing study
        study = await studiesClient.update(saved.studyDbId, payload);
      } else {
        // Create — POST /step-1 returns the new study with its DB id
        study = await studiesClient.create(payload);
      }
      dispatch(setStep1({ ...payload, studyDbId: study.id }));
      onNext();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to save basic info. Please try again.', duration: 4000 }));
    } finally {
      setSaving(false);
    }
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.step}>
      <h2 className={styles.stepHeading}>Basic Information</h2>
      <p className={styles.stepSub}>Enter the core details about the study.</p>

      {/* Row 1: Study ID + Study Title */}
      <div className={styles.row2}>
        <FormField label="Study ID / Protocol Number" name="studyId" required error={errors.studyId}>
          <input
            id="studyId"
            className={ic(styles, errors.studyId)}
            value={form.studyId}
            onChange={set('studyId')}
            placeholder="e.g. PROT-2024-001"
          />
        </FormField>
        <FormField label="Study Title" name="studyTitle" required error={errors.studyTitle}>
          <input
            id="studyTitle"
            className={ic(styles, errors.studyTitle)}
            value={form.studyTitle}
            onChange={set('studyTitle')}
            placeholder="e.g. A Phase III Trial of XYZ…"
          />
        </FormField>
      </div>

      {/* Row 2: Study Phase + Therapeutic Area */}
      <div className={styles.row2}>
        <FormField label="Study Phase" name="studyPhaseId" required error={errors.studyPhaseId}>
          <SearchableDropdown
            options={phaseOptions}
            value={form.studyPhaseId}
            onChange={handlePhaseChange}
            placeholder="Select phase…"
            searchPlaceholder="Search phases…"
          />
        </FormField>
        <FormField label="Therapeutic Area" name="therapeuticArea">
          <input
            id="therapeuticArea"
            className={styles.input}
            value={form.therapeuticArea}
            onChange={set('therapeuticArea')}
            placeholder="e.g. Oncology, Cardiology…"
          />
        </FormField>
      </div>

      {/* Scope of Study */}
      <FormField label="Scope of Study" name="scope" required error={errors.scope}>
        <div className={styles.scopeCards} role="radiogroup" aria-label="Scope of Study">
          {SCOPE_OPTIONS.map(({ value, label, desc, Icon, color, bg }) => {
            const selected = form.scope === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${styles.scopeCard} ${selected ? styles.scopeCardActive : ''}`}
                style={selected ? { borderColor: color, background: bg } : {}}
                onClick={() => selectScope(value)}
              >
                <span
                  className={styles.scopeCardIcon}
                  style={{ background: selected ? color + '20' : '#f1f5f9', color: selected ? color : '#94a3b8' }}
                >
                  <Icon size={18} />
                </span>
                <span className={styles.scopeCardText}>
                  <span className={styles.scopeCardLabel} style={selected ? { color } : {}}>
                    {label}
                  </span>
                  <span className={styles.scopeCardDesc}>{desc}</span>
                </span>
                <span
                  className={`${styles.scopeCardCheck} ${selected ? styles.scopeCardCheckActive : ''}`}
                  style={selected ? { background: color, borderColor: color } : {}}
                >
                  {selected && <Check size={10} strokeWidth={3} color="#fff" />}
                </span>
              </button>
            );
          })}
        </div>
      </FormField>

      {/* Study Description */}
      <FormField label="Study Description" name="studyDescription">
        <TextArea
          id="studyDescription"
          value={form.studyDescription}
          onChange={set('studyDescription')}
          placeholder="Brief description of the study objectives, design, and population…"
          rows={4}
        />
      </FormField>

      {/* Activation Method — applies to every site person invited to this study.
          PASSWORD: they set a password from the invite link. OTP: they receive a
          one-time code by email to activate, then sign in with OTP. */}
      <FormField
        label="Activation Method"
        name="activationMethod"
        required
        helpText="How site personnel invited to this study activate their account."
      >
        <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
          {[
            { value: 'PASSWORD', label: 'Password' },
            { value: 'OTP',      label: 'OTP' },
          ].map((opt) => (
            <label key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="activationMethod"
                value={opt.value}
                checked={(form.activationMethod ?? 'PASSWORD') === opt.value}
                onChange={() => set('activationMethod')(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </FormField>

      {/* Sponsor — last per spec */}
      <FormField label="Sponsor Name" name="sponsorId" required error={errors.sponsorId}>
        <div className={styles.sponsorRow}>
          <SearchableDropdown
            options={sponsorOptions}
            value={form.sponsorId}
            onChange={handleSponsorChange}
            placeholder={sponsorsLoading ? 'Loading sponsors…' : 'Search sponsor by name or registration number…'}
            searchPlaceholder="Type to search sponsors…"
            loading={sponsorsLoading}
          />
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={loadSponsors}
            title="Refresh sponsor list"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        {!sponsorsLoading && sponsorOptions.length === 0 ? (
          <p className={styles.sponsorHint}>
            No active sponsors found.{' '}
            <button type="button" className={styles.sponsorLink} onClick={handleAddSponsor}>
              Add a Sponsor
            </button>
            {' '}first to continue.
          </p>
        ) : (
          <p className={styles.sponsorHint}>
            Sponsor not listed?{' '}
            <button type="button" className={styles.sponsorLink} onClick={handleAddSponsor}>
              Add a new Sponsor
            </button>
          </p>
        )}
      </FormField>

      {/* Sponsor Workspace Permissions — per-study grant for the assigned sponsor */}
      <div className={styles.permSection}>
        <h3 className={styles.permSectionTitle}>Sponsor Workspace Permissions</h3>
        <p className={styles.permIntro}>
          Choose what the assigned sponsor can do inside this study&apos;s workspace.
          The sponsor can never exceed this grant — options are limited to the
          selected scope{form.scope ? ` (${form.scope})` : ''}.
        </p>
        <SponsorPermissionMatrix
          value={form.sponsorPermissions}
          onChange={setPermissions}
          error={errors.sponsorPermissions}
          title="Workspace Access"
          subtitle="Unselected actions are denied."
          hiddenFeatures={[...hiddenForScope(form.scope), ...hiddenForStep3(step3)]}
        />

        {/* Per-study dashboard whitelist — caps the sponsor's role-level
            dashboard cards on this study. Leave the toggle off to apply the
            sponsor role's default behavior unchanged. */}
        <div style={{ marginTop: 18 }}>
          <DashboardWidgetPicker
            value={form.sponsorDashboardWidgetKeys}
            onChange={(next) =>
              setForm((prev) => ({ ...prev, sponsorDashboardWidgetKeys: next }))
            }
          />
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.btnNext}
          onClick={handleNext}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function ic(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
