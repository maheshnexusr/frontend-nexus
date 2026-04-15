/**
 * StudyEditPage — /cro/studies/:studyId/edit
 *
 * Loads the existing study into the wizard Redux state, then renders
 * the same 6-step wizard as StudyNewPage with all tabs unlocked.
 */

import { useState, useEffect }  from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch }          from 'react-redux';
import { ArrowLeft, Lock }      from 'lucide-react';
import { studiesClient }        from '@/features/cro/api/studiesClient';
import {
  resetWizard,
  setStep1, setStep2, setStep3, setStep4, setStep5,
} from '@/features/cro/store/studyWizardSlice';
import StudyWizardStep1 from './StudyWizardStep1';
import StudyWizardStep2 from './StudyWizardStep2';
import StudyWizardStep3 from './StudyWizardStep3';
import StudyWizardStep4 from './StudyWizardStep4';
import StudyWizardStep5 from './StudyWizardStep5';
import StudyWizardStep6 from './StudyWizardStep6';
import styles from './StudyNewPage.module.css';

const TABS = [
  { id: 1, label: 'Basic Info'          },
  { id: 2, label: 'Timeline'            },
  { id: 3, label: 'Study Configuration' },
  { id: 4, label: 'Study Design'        },
  { id: 5, label: 'Study Team'          },
  { id: 6, label: 'Publish Study'       },
];

export default function StudyEditPage() {
  const { studyId }  = useParams();
  const dispatch     = useDispatch();
  const navigate     = useNavigate();

  const [activeTab, setActiveTab] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  // All tabs unlocked in edit mode
  const maxReachedTab = TABS.length;

  useEffect(() => {
    dispatch(resetWizard());

    studiesClient.getById(studyId).then((study) => {
      if (!study) { setNotFound(true); setLoading(false); return; }

      // Populate each step from the flat study record
      dispatch(setStep1({
        studyId:          study.studyId          ?? '',
        studyTitle:       study.studyTitle        ?? '',
        studyPhaseId:     study.studyPhaseId      ?? '',
        studyPhaseName:   study.studyPhaseName    ?? '',
        scope:            study.scope             ?? [],
        therapeuticArea:  study.therapeuticArea   ?? '',
        studyDescription: study.studyDescription  ?? '',
        sponsorId:        study.sponsorId         ?? '',
        sponsorName:      study.sponsorName       ?? '',
      }));

      dispatch(setStep2({
        startDate:             study.startDate             ?? '',
        expectedEndDate:       study.expectedEndDate       ?? '',
        maxSites:              study.maxSites              ?? '',
        maxEnrollments:        study.maxEnrollments        ?? '',
        regionId:              study.regionId              ?? '',
        regionName:            study.regionName            ?? '',
        randomizationMethod:   study.randomizationMethod   ?? '',
        countryId:             study.countryId             ?? '',
        countryName:           study.countryName           ?? '',
        randomizationApproach: study.randomizationApproach ?? '',
      }));

      dispatch(setStep3({
        consentManager: study.consentManager ?? false,
        queryManager:   study.queryManager   ?? false,
        dataManager:    study.dataManager    ?? false,
        navigationBar:  study.navigationBar  ?? false,
      }));

      dispatch(setStep4({
        formId:    study.formId    ?? null,
        formTitle: study.formTitle ?? '',
      }));

      dispatch(setStep5({
        assignments: study.assignments ?? [],
      }));

      setLoading(false);
    });

    return () => { dispatch(resetWizard()); };
  }, [studyId]);

  const handleCancel = () => {
    dispatch(resetWizard());
    navigate('/cro/studies');
  };

  const goNext = (currentTab) => {
    const next = currentTab + 1;
    if (next <= TABS.length) setActiveTab(next);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <p style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading study…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <Link to="/cro/studies" className={styles.backLink} onClick={() => dispatch(resetWizard())}>
          <ArrowLeft size={14} /> All Studies
        </Link>
        <p style={{ padding: '40px', color: 'var(--color-danger)' }}>Study not found.</p>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 1: return <StudyWizardStep1 onNext={() => goNext(1)} onCancel={handleCancel} />;
      case 2: return <StudyWizardStep2 onNext={() => goNext(2)} onCancel={handleCancel} />;
      case 3: return <StudyWizardStep3 onNext={() => goNext(3)} onCancel={handleCancel} />;
      case 4: return <StudyWizardStep4 onPrevious={() => setActiveTab(3)} onNext={() => goNext(4)} />;
      case 5: return <StudyWizardStep5 onPrevious={() => setActiveTab(4)} onNext={() => goNext(5)} onCancel={handleCancel} />;
      case 6: return <StudyWizardStep6 onPrevious={() => setActiveTab(5)} onCancel={handleCancel} />;
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

      <h1 className={styles.title}>Edit Study</h1>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div className={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <span className={styles.tabNum}>{tab.id}</span>
              {tab.label}
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
