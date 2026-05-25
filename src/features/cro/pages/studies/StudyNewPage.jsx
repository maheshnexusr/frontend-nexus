/**
 * StudyNewPage — /cro/studies/new
 *
 * Three-step wizard: Basic Info → Timeline → Study Configuration.
 * After Step 3 saves, the user is returned to the Studies list. Form design
 * and publish live on a dedicated /cro/studies/:id/design page reached from
 * the list's action column.
 */

import { useState }          from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch }       from 'react-redux';
import { ArrowLeft, Lock }   from 'lucide-react';
import { addToast }          from '@/app/notificationSlice';
import { resetWizard }       from '@/features/cro/store/studyWizardSlice';
import StudyWizardStep1      from './StudyWizardStep1';
import StudyWizardStep2      from './StudyWizardStep2';
import StudyWizardStep3      from './StudyWizardStep3';
import styles from './StudyNewPage.module.css';

const TABS = [
  { id: 1, label: 'Basic Info'          },
  { id: 2, label: 'Timeline'            },
  { id: 3, label: 'Study Configuration' },
];

export default function StudyNewPage() {
  const [activeTab,     setActiveTab]     = useState(1);
  const [maxReachedTab, setMaxReachedTab] = useState(1);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleCancel = () => {
    dispatch(resetWizard());
    navigate('/cro/studies');
  };

  const goNext = (currentTab) => {
    const next = currentTab + 1;
    if (next > TABS.length) {
      // Final step completed — return to the studies list.
      dispatch(addToast({
        type: 'success',
        message: 'Study created. Open it from the list and click Design Study to build the form.',
        duration: 4000,
      }));
      dispatch(resetWizard());
      navigate('/cro/studies');
      return;
    }
    setMaxReachedTab((prev) => Math.max(prev, next));
    setActiveTab(next);
  };

  const handleTabClick = (tabId) => {
    if (tabId <= maxReachedTab) setActiveTab(tabId);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 1: return <StudyWizardStep1 onNext={() => goNext(1)} onCancel={handleCancel} />;
      case 2: return <StudyWizardStep2 onNext={() => goNext(2)} onCancel={handleCancel} />;
      case 3: return <StudyWizardStep3 onNext={() => goNext(3)} onCancel={handleCancel} />;
      default: return null;
    }
  };

  return (
    <div className={styles.page}>
      <Link
        to="/cro/studies"
        className={styles.backLink}
        onClick={() => dispatch(resetWizard())}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All Studies
      </Link>

      <h1 className={styles.title}>Create New Study</h1>

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

      <div className={styles.tabContent}>
        {renderTab()}
      </div>
    </div>
  );
}
