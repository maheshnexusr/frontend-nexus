/**
 * StudyWizardStep1 — Basic Info
 *
 * Fields:
 *   Study ID / Protocol Number (required, unique)
 *   Study Title                (required)
 *   Study Phase                (required — SearchableDropdown from studyPhasesClient)
 *   Scope of Study             (required — at least one of EDC / Survey / ePRO)
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
import { setStep1, selectStep1 } from '@/features/cro/store/studyWizardSlice';
import FormField               from '@/components/form/FormField';
import TextArea                from '@/components/form/TextArea';
import SearchableDropdown      from '@/components/form/SearchableDropdown';
import styles from './StudyWizardStep1.module.css';

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

  const [form, setForm] = useState({
    studyId:          saved.studyId          ?? '',
    studyTitle:       saved.studyTitle       ?? '',
    studyPhaseId:     saved.studyPhaseId     ?? '',
    studyPhaseName:   saved.studyPhaseName   ?? '',
    scope:            saved.scope?.length    ? saved.scope : [],
    therapeuticArea:  saved.therapeuticArea  ?? '',
    studyDescription: saved.studyDescription ?? '',
    sponsorId:        saved.sponsorId        ?? '',
    sponsorName:      saved.sponsorName      ?? '',
  });

  const [errors,          setErrors]          = useState({});
  const [validating,      setValidating]      = useState(false);
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
    sponsorsClient.list().then((all) => {
      setSponsorOptions(
        all
          .filter((s) => s.status === 'Active')
          .sort((a, b) => a.organizationName.localeCompare(b.organizationName))
          .map((s) => ({
            value:   s.id,
            label:   `${s.organizationName}${s.registrationNumber ? ` (${s.registrationNumber})` : ''}`,
            orgName: s.organizationName,
          })),
      );
      setSponsorsLoading(false);
    });
  }, []);

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
    setForm((prev) => ({ ...prev, sponsorId: id, sponsorName: opt?.orgName ?? '' }));
    setErrors((prev) => ({ ...prev, sponsorId: undefined }));
  };

  const toggleScope = (val) => {
    setForm((prev) => {
      const next = prev.scope.includes(val)
        ? prev.scope.filter((v) => v !== val)
        : [...prev.scope, val];
      return { ...prev, scope: next };
    });
    setErrors((prev) => ({ ...prev, scope: undefined }));
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
    }));
    navigate('/cro/sponsors/new');
  };

  // ── validation + next ────────────────────────────────────────────────────────
  const handleNext = async () => {
    const errs = {};
    if (!form.studyId.trim())    errs.studyId    = 'Study ID / Protocol Number is required.';
    if (!form.studyTitle.trim()) errs.studyTitle  = 'Study Title is required.';
    if (!form.studyPhaseId)      errs.studyPhaseId = 'Please select a Study Phase.';
    if (form.scope.length === 0) errs.scope       = 'Please select at least one Scope of Study.';
    if (!form.sponsorId)         errs.sponsorId   = 'Please select a Sponsor.';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setValidating(true);
    try {
      const idTaken = await studiesClient.studyIdExists(form.studyId.trim());
      if (idTaken) {
        setErrors({ studyId: 'Study ID already exists. Please use a unique identifier.' });
        return;
      }
    } finally {
      setValidating(false);
    }

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
    }));

    onNext();
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
        <div className={styles.scopeCards}>
          {SCOPE_OPTIONS.map(({ value, label, desc, Icon, color, bg }) => {
            const selected = form.scope.includes(value);
            return (
              <button
                key={value}
                type="button"
                className={`${styles.scopeCard} ${selected ? styles.scopeCardActive : ''}`}
                style={selected ? { borderColor: color, background: bg } : {}}
                onClick={() => toggleScope(value)}
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

      {/* Footer */}
      <div className={styles.footer}>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.btnNext}
          onClick={handleNext}
          disabled={validating}
        >
          {validating ? 'Validating…' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function ic(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
