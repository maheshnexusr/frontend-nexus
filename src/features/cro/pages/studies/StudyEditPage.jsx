/**
 * StudyEditPage — /cro/studies/:studyId/edit
 *
 * Loads an existing study into the wizard Redux state and renders the same
 * three-step wizard (Basic Info / Timeline / Study Configuration) as
 * StudyNewPage. Form design and publish live on /cro/studies/:id/design.
 */

import { useState, useEffect }  from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch }          from 'react-redux';
import { ArrowLeft }            from 'lucide-react';
import { studiesClient }        from '@/features/cro/api/studiesClient';
import { addToast }             from '@/app/notificationSlice';
import {
  resetWizard,
  setStep1, setStep2, setStep3,
} from '@/features/cro/store/studyWizardSlice';
import StudyWizardStep1 from './StudyWizardStep1';
import StudyWizardStep2 from './StudyWizardStep2';
import StudyWizardStep3 from './StudyWizardStep3';
import styles from './StudyNewPage.module.css';

const TABS = [
  { id: 1, label: 'Basic Info'          },
  { id: 2, label: 'Timeline'            },
  { id: 3, label: 'Study Configuration' },
];

export default function StudyEditPage() {
  const { studyId }  = useParams();
  const dispatch     = useDispatch();
  const navigate     = useNavigate();

  const [activeTab, setActiveTab] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  useEffect(() => {
    dispatch(resetWizard());

    studiesClient.getById(studyId).then((study) => {
      if (!study) { setNotFound(true); setLoading(false); return; }

      const seededScope = Array.isArray(study.scope) ? (study.scope[0] ?? '') : (study.scope ?? '');

      dispatch(setStep1({
        studyDbId:        study.id                ?? null,
        studyId:          study.protocolNumber    ?? study.studyId ?? '',
        studyTitle:       study.studyTitle        ?? '',
        studyPhaseId:     study.studyPhaseId      ?? '',
        studyPhaseName:   study.studyPhaseName    ?? '',
        scope:            seededScope,
        therapeuticArea:  study.therapeuticArea   ?? '',
        studyDescription: study.studyDescription  ?? '',
        sponsorId:        study.sponsorId         ?? '',
        sponsorName:      study.sponsorName       ?? '',
        sponsorFullName:  study.sponsorFullName   ?? '',
        sponsorPermissions: study.sponsorPermissions ?? null,
      }));

      dispatch(setStep2({
        startDate:             study.startDate           ?? '',
        expectedEndDate:       study.expectedEndDate     ?? '',
        maxSites:              study.maxSites            ?? '',
        maxEnrollments:        study.maxEnrollments      ?? '',
        regionId:              study.regionId            ?? '',
        regionName:            '',
        randomizationMethod:   study.randomizationMethod ?? '',
        countryId:             study.countryId           ?? '',
        countryName:           '',
        randomizationApproach: '',
        contractCurrency:      study.contractCurrency    ?? 'INR',
        contractValue:         study.contractValue       ?? '',
        milestones:            Array.isArray(study.milestones) ? study.milestones : [],
      }));

      dispatch(setStep3({
        consentManager:      study.consentManager      ?? false,
        queryManager:        study.queryManager        ?? false,
        dataManager:         study.dataManager         ?? false,
        verificationManager: study.verificationManager ?? false,
        navigationBar:       study.navigationBar       ?? false,
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
    if (next > TABS.length) {
      dispatch(addToast({ type: 'success', message: 'Study updated.', duration: 3000 }));
      dispatch(resetWizard());
      navigate('/cro/studies');
      return;
    }
    setActiveTab(next);
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

      <div className={styles.tabContent}>
        {renderTab()}
      </div>
    </div>
  );
}
