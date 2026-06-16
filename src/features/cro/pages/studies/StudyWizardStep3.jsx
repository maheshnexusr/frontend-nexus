/**
 * StudyWizardStep3 — Study Configuration
 *
 * Toggles shown depend on Scope selected in Step 1:
 *   EDC          → Consent Manager, Query Manager, Data Manager, Navigation Bar
 *   Survey/ePRO  → Consent Manager, Query Manager, Navigation Bar (no Data Manager)
 *   Both         → all of the above, Data Manager shown only for EDC
 *
 * All toggles default to OFF.
 */

import { useState }              from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addToast }              from '@/app/notificationSlice';
import { studiesClient }         from '@/features/cro/api/studiesClient';
import { setStep3, selectStep1, selectStep3 } from '@/features/cro/store/studyWizardSlice';
import { usePermissions }         from '@/features/auth/usePermissions';
import styles from './StudyWizardStep3.module.css';

const ALL_CONFIGS = [
  {
    key:     'consentManager',
    label:   'Enable Consent Manager',
    info:    'Enables electronic consent management for participants.',
    scopes:  ['EDC', 'Survey', 'ePRO'],
  },
  {
    key:       'consentApproval',
    label:     'Require Consent Review & Approval',
    info:      'When on, a consent submitted by site personnel must be approved (or rejected, with a reason) by a Sponsor/CRO reviewer. When off, submitted consents are auto-approved.',
    scopes:    ['EDC', 'Survey', 'ePRO'],
    dependsOn: 'consentManager',
  },
  {
    key:     'queryManager',
    label:   'Enable Query Manager',
    info:    'Enables query raising and resolution workflows.',
    scopes:  ['EDC', 'Survey', 'ePRO'],
  },
  {
    key:     'verificationManager',
    label:   'Enable Verification Manager',
    info:    'Enables source data verification and approval workflows for entered data.',
    scopes:  ['EDC', 'Survey', 'ePRO'],
  },
];

export default function StudyWizardStep3({ onCancel, onNext }) {
  const dispatch = useDispatch();
  const step1    = useSelector(selectStep1);
  const saved    = useSelector(selectStep3);

  // Saving this step hits PUT /studies/:id/step-3, which the backend gates
  // with authorize("ClinicalPrograms.Studies", "configure"). Without that
  // permission the toggles are read-only and the user finishes the wizard
  // without persisting a configuration change (no doomed 403 round-trip).
  const { has }      = usePermissions();
  const canConfigure = has('studies', 'configure');

  // Backwards-compat: scope may still arrive as an array from older state.
  const scope           = Array.isArray(step1.scope) ? (step1.scope[0] ?? '') : (step1.scope ?? '');
  const hasEDC          = scope === 'EDC';
  const hasSurveyOrEPRO = scope === 'Survey' || scope === 'ePRO';

  const [form, setForm] = useState({
    consentManager:      saved.consentManager      ?? false,
    consentApproval:     saved.consentApproval     ?? false,
    queryManager:        saved.queryManager        ?? false,
    dataManager:         saved.dataManager         ?? false,
    verificationManager: saved.verificationManager ?? false,
    navigationBar:       saved.navigationBar       ?? false,
  });

  // Which config items to show based on active scope
  const visibleConfigs = ALL_CONFIGS.filter((c) => c.scopes.includes(scope));

  const [saving, setSaving] = useState(false);

  const toggle = (key) =>
    setForm((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Turning a parent toggle OFF forces its dependent children OFF too, so a
      // stale child flag can't be persisted (e.g. consentApproval without
      // consentManager). The backend also guards this defensively.
      if (key === 'consentManager' && !next.consentManager) {
        next.consentApproval = false;
      }
      return next;
    });

  const handleSave = async () => {
    dispatch(setStep3({ ...form }));
    setSaving(true);
    try {
      await studiesClient.step3(step1.studyDbId, form);
      dispatch(addToast({ type: 'success', message: 'Study configuration saved.', duration: 3000 }));
      onNext?.();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to save configuration. Please try again.', duration: 4000 }));
    } finally {
      setSaving(false);
    }
  };

  // Guard: scope not selected yet
  if (!hasEDC && !hasSurveyOrEPRO) {
    return (
      <div className={styles.step}>
        <h2 className={styles.heading}>Study Configuration</h2>
        <div className={styles.noScope}>
          <p className={styles.noScopeText}>
            Please complete <strong>Basic Info</strong> and select at least one Scope of Study before configuring modules.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.step}>
      <h2 className={styles.heading}>Study Configuration</h2>
      <p className={styles.sub}>
        Enable or disable modules for this study. All options default to off.
      </p>

      {!canConfigure && (
        <p
          style={{
            margin: '0 0 12px',
            fontSize: '13px',
            color: '#92400e',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '10px 12px',
            lineHeight: 1.5,
          }}
        >
          You don&apos;t have permission to change study configuration. These
          settings are read-only — continue to finish without changes.
        </p>
      )}

      <div className={styles.configList}>
        {visibleConfigs.map((cfg) => {
          // Dependent toggles (e.g. consentApproval needs consentManager ON)
          // are disabled + visually indented until their parent is enabled.
          const parentOff = cfg.dependsOn && !form[cfg.dependsOn];
          const disabled  = !canConfigure || parentOff;
          return (
            <div
              key={cfg.key}
              className={styles.configCard}
              style={cfg.dependsOn ? { marginLeft: 24, opacity: parentOff ? 0.55 : 1 } : undefined}
            >
              <div className={styles.configLeft}>
                <span className={styles.configLabel}>
                  {cfg.label}
                  {cfg.edcOnly && hasSurveyOrEPRO && (
                    <span className={styles.badge}>EDC only</span>
                  )}
                </span>
                <span className={styles.configInfo}>{cfg.info}</span>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={form[cfg.key]}
                  onChange={() => toggle(cfg.key)}
                  disabled={disabled}
                />
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleThumb} />
                </span>
                <span className={styles.toggleLabel}>
                  {form[cfg.key] ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancel
        </button>
        {canConfigure ? (
          <button type="button" className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        ) : (
          <button type="button" className={styles.btnSave} onClick={() => onNext?.()}>
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
