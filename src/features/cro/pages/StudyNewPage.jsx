/**
 * StudyNewPage — /cro/studies/new
 *
 * Sequential tab wizard. Each tab is unlocked only after the previous step
 * calls onNext() (i.e. validates and saves successfully).
 * maxReachedTab tracks the highest tab the user has legitimately unlocked.
 */

import { useState }          from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch }       from 'react-redux';
import { ArrowLeft, Lock }   from 'lucide-react';
import { resetWizard }       from '@/features/cro/store/studyWizardSlice';
import StudyWizardStep1      from './StudyWizardStep1';
import StudyWizardStep2      from './StudyWizardStep2';
import StudyWizardStep3      from './StudyWizardStep3';
import StudyWizardStep4      from './StudyWizardStep4';
import StudyWizardStep5      from './StudyWizardStep5';
import StudyWizardStep6      from './StudyWizardStep6';
import styles from './StudyNewPage.module.css';

const TABS = [
  { id: 1, label: 'Basic Info'          },
  { id: 2, label: 'Timeline'            },
  { id: 3, label: 'Study Configuration' },
  { id: 4, label: 'Study Design'        },
  { id: 5, label: 'Study Team'          },
  { id: 6, label: 'Publish Study'       },
];

export default function StudyNewPage() {
  const [activeTab,      setActiveTab]      = useState(1);
  // highest tab the user has unlocked by completing the previous step
  const [maxReachedTab,  setMaxReachedTab]  = useState(1);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleCancel = () => {
    dispatch(resetWizard());
    navigate('/cro/studies');
  };

  /** Called by each step when it successfully validates + saves. */
  const goNext = (currentTab) => {
    const next = currentTab + 1;
    if (next > TABS.length) return;
    setMaxReachedTab((prev) => Math.max(prev, next));
    setActiveTab(next);
  };

  /** Tab click — only allowed if tab.id <= maxReachedTab. */
  const handleTabClick = (tabId) => {
    if (tabId <= maxReachedTab) setActiveTab(tabId);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 1: return (
        <StudyWizardStep1
          onNext={() => goNext(1)}
          onCancel={handleCancel}
        />
      );
      case 2: return (
        <StudyWizardStep2
          onNext={() => goNext(2)}
          onCancel={handleCancel}
        />
      );
      case 3: return (
        <StudyWizardStep3
          onNext={() => goNext(3)}
          onCancel={handleCancel}
        />
      );
      case 4: return (
        <StudyWizardStep4
          onPrevious={() => setActiveTab(3)}
          onNext={() => goNext(4)}
        />
      );
      case 5: return (
        <StudyWizardStep5
          onPrevious={() => setActiveTab(4)}
          onNext={() => goNext(5)}
          onCancel={handleCancel}
        />
      );
      case 6: return (
        <StudyWizardStep6
          onPrevious={() => setActiveTab(5)}
          onCancel={handleCancel}
        />
      );
      default: return null;
    }
  };

  return (
    <div className={styles.page}>

      {/* Back */}
      <Link
        to="/cro/studies"
        className={styles.backLink}
        onClick={() => dispatch(resetWizard())}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All Studies
      </Link>

      <h1 className={styles.title}>Create New Study</h1>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div className={styles.tabBar}>
        {TABS.map((tab) => {
          const unlocked = tab.id <= maxReachedTab;
          const active   = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={!unlocked}
              className={`${styles.tab} ${active ? styles.tabActive : ''} ${!unlocked ? styles.tabLocked : ''}`}
              onClick={() => handleTabClick(tab.id)}
              title={!unlocked ? 'Complete previous step to unlock' : tab.label}
            >
              <span className={styles.tabNum}>{tab.id}</span>
              {tab.label}
              {!unlocked && <Lock size={11} className={styles.lockIcon} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────── */}
      <div
        className={`${styles.tabContent} ${activeTab === 4 ? styles.tabContentBuilder : ''}`}
        style={activeTab === 4 ? { maxWidth: '100%' } : {}}
      >
        {renderTab()}
      </div>
    </div>
  );
}
