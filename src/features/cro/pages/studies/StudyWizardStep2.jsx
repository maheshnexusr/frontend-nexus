/**
 * StudyWizardStep2 — Timeline and Coverage
 *
 * Fields are dynamic based on Scope selected in Step 1:
 *   EDC scope    → Start Date, End Date, Max Sites, Max Enrollments,
 *                  Region Covered (Region), Randomization Method
 *   Survey/ePRO  → Start Date, End Date, Max Enrollments,
 *                  Region Covered (Country), Randomization Approach
 *   Both scopes  → all of the above, shared fields shown once
 */

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { regionsClient }        from '@/features/cro/api/regionsClient';
import { countriesClient }      from '@/features/cro/api/countriesClient';
import { setStep2, selectStep1, selectStep2 } from '@/features/cro/store/studyWizardSlice';
import { addToast }             from '@/app/notificationSlice';
import FormField                from '@/components/form/FormField';
import DatePicker               from '@/components/form/DatePicker';
import SearchableDropdown       from '@/components/form/SearchableDropdown';
import styles from './StudyWizardStep2.module.css';

const EDC_RANDOMIZATION = [
  { value: 'Centralized', label: 'Centralized' },
  { value: 'Simple',      label: 'Simple'      },
  { value: 'Block',       label: 'Block'        },
  { value: 'Stratified',  label: 'Stratified'  },
];

const SURVEY_RANDOMIZATION = [
  { value: 'Centralized Randomization', label: 'Centralized Randomization'                    },
  { value: 'Site-Based Randomization',  label: 'Site-Based Randomization (Decentralized)'     },
];

const today = new Date().toISOString().split('T')[0];

export default function StudyWizardStep2({ onCancel, onNext }) {
  const dispatch = useDispatch();
  const step1    = useSelector(selectStep1);
  const saved    = useSelector(selectStep2);

  const scope           = step1.scope ?? [];
  const hasEDC          = scope.includes('EDC');
  const hasSurveyOrEPRO = scope.includes('Survey') || scope.includes('ePRO');
  const hasBoth         = hasEDC && hasSurveyOrEPRO;

  const [form, setForm] = useState({
    startDate:             saved.startDate             ?? '',
    expectedEndDate:       saved.expectedEndDate       ?? '',
    maxSites:              saved.maxSites              ?? '',
    maxEnrollments:        saved.maxEnrollments        ?? '',
    regionId:              saved.regionId              ?? '',
    regionName:            saved.regionName            ?? '',
    randomizationMethod:   saved.randomizationMethod   ?? '',
    countryId:             saved.countryId             ?? '',
    countryName:           saved.countryName           ?? '',
    randomizationApproach: saved.randomizationApproach ?? '',
  });

  const [errors,         setErrors]         = useState({});
  const [regionOptions,  setRegionOptions]  = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);

  useEffect(() => {
    if (hasEDC) {
      regionsClient.list().then((all) =>
        setRegionOptions(
          all
            .filter((r) => r.status === 'Active')
            .sort((a, b) => a.regionName.localeCompare(b.regionName))
            .map((r) => ({ value: r.id, label: r.regionName })),
        ),
      );
    }
    if (hasSurveyOrEPRO) {
      countriesClient.list().then((all) =>
        setCountryOptions(
          all
            .filter((c) => c.status === 'Active')
            .sort((a, b) => a.countryName.localeCompare(b.countryName))
            .map((c) => ({ value: c.id, label: c.countryName })),
        ),
      );
    }
  }, [hasEDC, hasSurveyOrEPRO]);

  // ── helpers ──────────────────────────────────────────────────────────────────
  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleRegionChange = (id) => {
    const opt = regionOptions.find((o) => o.value === id);
    setForm((prev) => ({ ...prev, regionId: id, regionName: opt?.label ?? '' }));
    setErrors((prev) => ({ ...prev, regionId: undefined }));
  };

  const handleCountryChange = (id) => {
    const opt = countryOptions.find((o) => o.value === id);
    setForm((prev) => ({ ...prev, countryId: id, countryName: opt?.label ?? '' }));
    setErrors((prev) => ({ ...prev, countryId: undefined }));
  };

  // ── validation ────────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};

    if (!form.startDate)
      errs.startDate = 'Start Date is required.';

    if (!form.expectedEndDate)
      errs.expectedEndDate = 'Expected End Date is required.';
    else if (form.startDate && form.expectedEndDate <= form.startDate)
      errs.expectedEndDate = 'Expected End Date must be after Start Date.';

    if (!form.maxEnrollments) {
      errs.maxEnrollments = 'Maximum Number of Enrollments is required.';
    } else if (!/^\d+$/.test(String(form.maxEnrollments)) || Number(form.maxEnrollments) <= 0) {
      errs.maxEnrollments = 'Please enter a valid positive number.';
    }

    if (hasEDC) {
      if (!form.maxSites) {
        errs.maxSites = 'Maximum Number of Sites is required.';
      } else if (!/^\d+$/.test(String(form.maxSites)) || Number(form.maxSites) <= 0) {
        errs.maxSites = 'Please enter a valid positive number.';
      }
      if (!form.regionId) errs.regionId = 'Please select Region Covered.';
    }

    if (hasSurveyOrEPRO) {
      if (!form.countryId) errs.countryId = 'Please select Region Covered.';
    }

    return errs;
  };

  const buildPayload = () => ({
    startDate:             form.startDate,
    expectedEndDate:       form.expectedEndDate,
    maxSites:              hasEDC          ? form.maxSites              : '',
    maxEnrollments:        form.maxEnrollments,
    regionId:              hasEDC          ? form.regionId              : '',
    regionName:            hasEDC          ? form.regionName            : '',
    randomizationMethod:   hasEDC          ? form.randomizationMethod   : '',
    countryId:             hasSurveyOrEPRO ? form.countryId             : '',
    countryName:           hasSurveyOrEPRO ? form.countryName           : '',
    randomizationApproach: hasSurveyOrEPRO ? form.randomizationApproach : '',
  });

  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    dispatch(setStep2(buildPayload()));
    dispatch(addToast({ type: 'success', message: 'Timeline details saved.', duration: 3000 }));
    onNext?.();
  };

  const handleSaveAsDraft = () => {
    dispatch(setStep2(buildPayload()));
    dispatch(addToast({ type: 'success', message: 'Draft progress saved.', duration: 3000 }));
  };

  // ── render ───────────────────────────────────────────────────────────────────

  // Guard: scope not yet selected in Step 1
  if (!hasEDC && !hasSurveyOrEPRO) {
    return (
      <div className={styles.step}>
        <h2 className={styles.stepHeading}>Timeline and Coverage</h2>
        <div className={styles.noScope}>
          <p className={styles.noScopeText}>
            Please complete <strong>Basic Info</strong> and select at least one Scope of Study before filling in timeline details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.step}>
      <h2 className={styles.stepHeading}>Timeline and Coverage</h2>
      <p className={styles.stepSub}>
        Define the study timeline, enrollment targets, and geographic coverage.
      </p>

      {/* ── Study Dates ─────────────────────────────────────────────────── */}
      {hasBoth && <p className={styles.sectionLabel}>Study Dates &amp; Enrollment</p>}

      <div className={styles.row2}>
        <FormField label="Start Date" name="startDate" required error={errors.startDate}>
          <DatePicker
            name="startDate"
            value={form.startDate}
            onChange={set('startDate')}
            min={today}
            error={!!errors.startDate}
          />
        </FormField>
        <FormField label="Expected End Date" name="expectedEndDate" required error={errors.expectedEndDate}>
          <DatePicker
            name="expectedEndDate"
            value={form.expectedEndDate}
            onChange={set('expectedEndDate')}
            min={form.startDate || today}
            error={!!errors.expectedEndDate}
          />
        </FormField>
      </div>

      {/* Max Enrollments + Max Sites (EDC) */}
      <div className={hasEDC ? styles.row2 : styles.row1}>
        {hasEDC && (
          <FormField label="Max. Number of Sites" name="maxSites" required error={errors.maxSites}>
            <input
              id="maxSites"
              type="number"
              min="1"
              className={ic(styles, errors.maxSites)}
              value={form.maxSites}
              onChange={set('maxSites')}
              placeholder="e.g. 50"
            />
          </FormField>
        )}
        <FormField label="Max. Number of Enrollments" name="maxEnrollments" required error={errors.maxEnrollments}>
          <input
            id="maxEnrollments"
            type="number"
            min="1"
            className={ic(styles, errors.maxEnrollments)}
            value={form.maxEnrollments}
            onChange={set('maxEnrollments')}
            placeholder="e.g. 500"
          />
        </FormField>
      </div>

      {/* ── EDC Coverage ────────────────────────────────────────────────── */}
      {hasEDC && (
        <>
          {hasBoth && <p className={styles.sectionLabel}>EDC Coverage</p>}
          <div className={styles.row2}>
            <FormField label="Region Covered" name="regionId" required error={errors.regionId}>
              <SearchableDropdown
                options={regionOptions}
                value={form.regionId}
                onChange={handleRegionChange}
                placeholder="Select region…"
                searchPlaceholder="Search regions…"
              />
            </FormField>
            <FormField label="Randomization Method" name="randomizationMethod">
              <SearchableDropdown
                options={EDC_RANDOMIZATION}
                value={form.randomizationMethod}
                onChange={set('randomizationMethod')}
                placeholder="Select method…"
              />
            </FormField>
          </div>
        </>
      )}

      {/* ── Survey / ePRO Coverage ──────────────────────────────────────── */}
      {hasSurveyOrEPRO && (
        <>
          {hasBoth && <p className={styles.sectionLabel}>Survey / ePRO Coverage</p>}
          <div className={styles.row2}>
            <FormField
              label="Region Covered (Country)"
              name="countryId"
              required
              error={errors.countryId}
            >
              <SearchableDropdown
                options={countryOptions}
                value={form.countryId}
                onChange={handleCountryChange}
                placeholder="Select country…"
                searchPlaceholder="Search countries…"
              />
            </FormField>
            <FormField label="Randomization Approach" name="randomizationApproach">
              <SearchableDropdown
                options={SURVEY_RANDOMIZATION}
                value={form.randomizationApproach}
                onChange={set('randomizationApproach')}
                placeholder="Select approach…"
              />
            </FormField>
          </div>
        </>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button type="button" className={styles.btnDraft} onClick={handleSaveAsDraft}>
          Save as Draft
        </button>
        <div className={styles.footerRight}>
          <button type="button" className={styles.btnCancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.btnNext} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ic(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
