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
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { regionsClient }        from '@/features/cro/api/regionsClient';
import { countriesClient }      from '@/features/cro/api/countriesClient';
import { studiesClient }        from '@/features/cro/api/studiesClient';
import { setStep2, selectStep1, selectStep2 } from '@/features/cro/store/studyWizardSlice';
import { addToast }             from '@/app/notificationSlice';
import FormField                from '@/components/form/FormField';
import FormattedDatePicker      from '@/components/form/FormattedDatePicker';
import SearchableDropdown       from '@/components/form/SearchableDropdown';
import styles from './StudyWizardStep2.module.css';

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return `${m[3]}-${months[parseInt(m[2], 10) - 1]}-${m[1]}`;
}

function newMilestoneId() {
  return `ms_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

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

  // Backwards-compat: scope may arrive as an array from older state.
  const scope           = Array.isArray(step1.scope) ? (step1.scope[0] ?? '') : (step1.scope ?? '');
  const hasEDC          = scope === 'EDC';
  const hasSurveyOrEPRO = scope === 'Survey' || scope === 'ePRO';
  const hasBoth         = false; // single-select: scope is exactly one of EDC | Survey | ePRO

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
    contractCurrency:      saved.contractCurrency      ?? 'INR',
    contractValue:         saved.contractValue         ?? '',
    milestones:            Array.isArray(saved.milestones) ? saved.milestones : [],
  });

  // Milestone modal state
  const [milestoneModal, setMilestoneModal] = useState(null); // null | 'create' | { id, ... }

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

  // ── Milestone CRUD ───────────────────────────────────────────────────────────
  const upsertMilestone = (milestone) => {
    setForm((prev) => {
      const exists = prev.milestones.some((m) => m.id === milestone.id);
      const next   = exists
        ? prev.milestones.map((m) => (m.id === milestone.id ? milestone : m))
        : [...prev.milestones, milestone];
      return { ...prev, milestones: next };
    });
    setMilestoneModal(null);
  };

  const deleteMilestone = (id) => {
    setForm((prev) => ({ ...prev, milestones: prev.milestones.filter((m) => m.id !== id) }));
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

    if (!form.maxSites) {
      errs.maxSites = 'Number of Sites is required.';
    } else if (!/^\d+$/.test(String(form.maxSites)) || Number(form.maxSites) <= 0) {
      errs.maxSites = 'Please enter a valid positive number.';
    }

    if (hasEDC) {
      if (!form.regionId) errs.regionId = 'Please select Region Covered.';
    }

    if (hasSurveyOrEPRO) {
      if (!form.countryId) errs.countryId = 'Please select Region Covered.';
    }

    if (form.contractValue && (!/^\d+(\.\d{1,2})?$/.test(String(form.contractValue)) || Number(form.contractValue) < 0)) {
      errs.contractValue = 'Please enter a valid amount.';
    }

    return errs;
  };

  const [saving, setSaving] = useState(false);

  const buildReduxPayload = () => ({
    startDate:             form.startDate,
    expectedEndDate:       form.expectedEndDate,
    maxSites:              form.maxSites,
    maxEnrollments:        form.maxEnrollments,
    regionId:              hasEDC          ? form.regionId              : '',
    regionName:            hasEDC          ? form.regionName            : '',
    randomizationMethod:   hasEDC          ? form.randomizationMethod   : '',
    countryId:             hasSurveyOrEPRO ? form.countryId             : '',
    countryName:           hasSurveyOrEPRO ? form.countryName           : '',
    randomizationApproach: hasSurveyOrEPRO ? form.randomizationApproach : '',
    contractCurrency:      form.contractCurrency,
    contractValue:         form.contractValue,
    milestones:            form.milestones,
  });

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const reduxPayload = buildReduxPayload();
    dispatch(setStep2(reduxPayload));

    // coverage_type / coverage_id for the API
    const coverageType = hasEDC ? 'REGION' : 'COUNTRY';
    const coverageId   = hasEDC ? form.regionId : form.countryId;

    setSaving(true);
    try {
      await studiesClient.step2(step1.studyDbId, {
        ...reduxPayload,
        coverageType,
        coverageId,
      });
      dispatch(addToast({ type: 'success', message: 'Timeline details saved.', duration: 3000 }));
      onNext?.();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to save timeline. Please try again.', duration: 4000 }));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsDraft = () => {
    dispatch(setStep2(buildReduxPayload()));
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
          <FormattedDatePicker
            name="startDate"
            value={form.startDate}
            onChange={set('startDate')}
            min={today}
            error={!!errors.startDate}
          />
        </FormField>
        <FormField label="Expected End Date" name="expectedEndDate" required error={errors.expectedEndDate}>
          <FormattedDatePicker
            name="expectedEndDate"
            value={form.expectedEndDate}
            onChange={set('expectedEndDate')}
            min={form.startDate || today}
            error={!!errors.expectedEndDate}
          />
        </FormField>
      </div>

      {/* Number of Sites + Max Enrollments — both shown for every scope */}
      <div className={styles.row2}>
        <FormField label="Number of Sites" name="maxSites" required error={errors.maxSites}>
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

      {/* ── Contractuality & Milestones ─────────────────────────────────── */}
      <div className={styles.contractSection}>
        <div className={styles.contractHeader}>
          <h3 className={styles.contractTitle}>Contractuality &amp; Milestones</h3>
          <p className={styles.contractSub}>
            Capture the contract value and any milestones the sponsor has agreed to.
          </p>
        </div>

        <div className={styles.row2}>
          <FormField label="Currency" name="contractCurrency">
            <SearchableDropdown
              options={CURRENCY_OPTIONS}
              value={form.contractCurrency}
              onChange={(v) => setForm((p) => ({ ...p, contractCurrency: v ?? 'INR' }))}
              placeholder="Select currency…"
              searchPlaceholder="Search currencies…"
            />
          </FormField>
          <FormField label="Contract Value" name="contractValue" error={errors.contractValue}>
            <div className={styles.amountWrap}>
              <span className={styles.amountPrefix}>{form.contractCurrency || 'INR'}</span>
              <input
                id="contractValue"
                type="number"
                min="0"
                step="0.01"
                className={ic(styles, errors.contractValue)}
                value={form.contractValue}
                onChange={set('contractValue')}
                placeholder="e.g. 1000000"
              />
            </div>
          </FormField>
        </div>

        <div className={styles.milestonesHead}>
          <span className={styles.milestonesLabel}>Milestones</span>
          <button
            type="button"
            className={styles.btnAddMilestone}
            onClick={() => setMilestoneModal('create')}
          >
            <Plus size={13} /> Add Milestone
          </button>
        </div>

        <div className={styles.milestonesTableWrap}>
          <table className={styles.milestonesTable}>
            <thead>
              <tr>
                <th className={styles.thMs}>Milestone</th>
                <th className={styles.thMs}>Start Date</th>
                <th className={styles.thMs}>End Date</th>
                <th className={styles.thMsActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {form.milestones.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.msEmpty}>
                    No milestones yet. Click <strong>Add Milestone</strong> to create one.
                  </td>
                </tr>
              ) : (
                form.milestones.map((m) => (
                  <tr key={m.id} className={styles.msRow}>
                    <td className={styles.msCell}>{m.name}</td>
                    <td className={styles.msCell}>{formatDisplayDate(m.startDate)}</td>
                    <td className={styles.msCell}>{formatDisplayDate(m.endDate)}</td>
                    <td className={styles.msActionsCell}>
                      <button
                        type="button"
                        className={styles.msIconBtn}
                        title="Edit"
                        onClick={() => setMilestoneModal(m)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.msIconBtn} ${styles.msIconBtnDanger}`}
                        title="Delete"
                        onClick={() => deleteMilestone(m.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {milestoneModal && (
        <MilestoneModal
          milestone={milestoneModal === 'create' ? null : milestoneModal}
          studyStart={form.startDate}
          studyEnd={form.expectedEndDate}
          onClose={() => setMilestoneModal(null)}
          onSave={upsertMilestone}
        />
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
          <button type="button" className={styles.btnNext} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ic(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}

// ── Milestone modal ──────────────────────────────────────────────────────────
function MilestoneModal({ milestone, studyStart, studyEnd, onClose, onSave }) {
  const isEdit = !!milestone;
  const [data, setData] = useState({
    id:        milestone?.id        ?? newMilestoneId(),
    name:      milestone?.name      ?? '',
    startDate: milestone?.startDate ?? '',
    endDate:   milestone?.endDate   ?? '',
  });
  const [errs, setErrs] = useState({});

  const handleSave = () => {
    const next = {};
    if (!data.name.trim())      next.name      = 'Milestone name is required.';
    if (!data.startDate)        next.startDate = 'Start date is required.';
    if (!data.endDate)          next.endDate   = 'End date is required.';
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      next.endDate = 'End date must be on or after start date.';
    }
    if (Object.keys(next).length) { setErrs(next); return; }
    onSave({ ...data, name: data.name.trim() });
  };

  return (
    <div className={styles.msBackdrop} onClick={onClose}>
      <div className={styles.msModal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.msModalHead}>
          <h3 className={styles.msModalTitle}>
            {isEdit ? 'Edit Milestone' : 'Add Milestone'}
          </h3>
          <button type="button" className={styles.msModalClose} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.msModalBody}>
          <FormField label="Milestone Name" name="msName" required error={errs.name}>
            <input
              type="text"
              className={errs.name ? `${styles.input} ${styles.inputError}` : styles.input}
              value={data.name}
              onChange={(e) => { setData((p) => ({ ...p, name: e.target.value })); setErrs((p) => ({ ...p, name: undefined })); }}
              placeholder="e.g. First Patient Enrolled"
              autoFocus
            />
          </FormField>

          <div className={styles.row2}>
            <FormField label="Start Date" name="msStart" required error={errs.startDate}>
              <FormattedDatePicker
                name="msStart"
                value={data.startDate}
                onChange={(e) => { setData((p) => ({ ...p, startDate: e.target.value })); setErrs((p) => ({ ...p, startDate: undefined })); }}
                min={studyStart || undefined}
                max={studyEnd  || undefined}
                error={!!errs.startDate}
              />
            </FormField>
            <FormField label="End Date" name="msEnd" required error={errs.endDate}>
              <FormattedDatePicker
                name="msEnd"
                value={data.endDate}
                onChange={(e) => { setData((p) => ({ ...p, endDate: e.target.value })); setErrs((p) => ({ ...p, endDate: undefined })); }}
                min={data.startDate || studyStart || undefined}
                max={studyEnd || undefined}
                error={!!errs.endDate}
              />
            </FormField>
          </div>
        </div>

        <div className={styles.msModalFoot}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.btnNext} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Add Milestone'}
          </button>
        </div>
      </div>
    </div>
  );
}
