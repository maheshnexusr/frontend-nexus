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
import { setStep3, selectStep1, selectStep3 } from '@/features/cro/store/studyWizardSlice';
import styles from './StudyWizardStep3.module.css';

const ALL_CONFIGS = [
  {
    key:     'consentManager',
    label:   'Enable Consent Manager',
    info:    'Enables electronic consent management for participants.',
    scopes:  ['EDC', 'Survey', 'ePRO'],
  },
  {
    key:     'queryManager',
    label:   'Enable Query Manager',
    info:    'Enables query raising and resolution workflows.',
    scopes:  ['EDC', 'Survey', 'ePRO'],
  },
  {
    key:     'dataManager',
    label:   'Enable Data Manager',
    info:    'Enables data validation and cleaning tools.',
    scopes:  ['EDC'],                     // NOT shown for Survey/ePRO
    edcOnly: true,
  },
  {
    key:     'navigationBar',
    label:   'Enable Navigation Bar',
    info:    'Displays study navigation menu for users.',
    scopes:  ['EDC', 'Survey', 'ePRO'],
  },
];

export default function StudyWizardStep3({ onCancel, onNext }) {
  const dispatch = useDispatch();
  const step1    = useSelector(selectStep1);
  const saved    = useSelector(selectStep3);

  const scope           = step1.scope ?? [];
  const hasEDC          = scope.includes('EDC');
  const hasSurveyOrEPRO = scope.includes('Survey') || scope.includes('ePRO');

  const [form, setForm] = useState({
    consentManager: saved.consentManager ?? false,
    queryManager:   saved.queryManager   ?? false,
    dataManager:    saved.dataManager    ?? false,
    navigationBar:  saved.navigationBar  ?? false,
  });

  // Which config items to show based on active scope
  const visibleConfigs = ALL_CONFIGS.filter((c) =>
    c.scopes.some((s) => scope.includes(s)),
  );

  const toggle = (key) =>
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = () => {
    dispatch(setStep3({ ...form }));
    dispatch(addToast({ type: 'success', message: 'Study configuration saved.', duration: 3000 }));
    onNext?.();
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

      <div className={styles.configList}>
        {visibleConfigs.map((cfg) => (
          <div key={cfg.key} className={styles.configCard}>
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
              />
              <span className={styles.toggleTrack}>
                <span className={styles.toggleThumb} />
              </span>
              <span className={styles.toggleLabel}>
                {form[cfg.key] ? 'ON' : 'OFF'}
              </span>
            </label>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.btnSave} onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
