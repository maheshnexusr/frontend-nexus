/**
 * StudyDesignPage — /cro/studies/:studyId/design
 *
 * Full-screen, standalone Form Builder host launched from the studies list
 * "Design Study" action. Hydrates the wizard's Step 1 slice with the study's
 * primary key so the existing StudyFormBuilder (which reads selectStep1) can
 * load, save, and publish the form design without going through the wizard.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch }           from 'react-redux';
import { ArrowLeft }             from 'lucide-react';
import { studiesClient }         from '@/features/cro/api/studiesClient';
import { addToast }              from '@/app/notificationSlice';
import { resetWizard, setStep1 } from '@/features/cro/store/studyWizardSlice';
import StudyFormBuilder          from '@/features/cro/components/study-form/StudyFormBuilder';
import styles from './StudyDesignPage.module.css';

export default function StudyDesignPage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();

  const [loading,  setLoading]  = useState(true);
  const [study,    setStudy]    = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    dispatch(resetWizard());
    studiesClient.getById(studyId).then((s) => {
      if (!s) { setNotFound(true); setLoading(false); return; }
      const seededScope = Array.isArray(s.scope) ? (s.scope[0] ?? '') : (s.scope ?? '');
      dispatch(setStep1({
        studyDbId:        s.id              ?? null,
        studyId:          s.protocolNumber  ?? s.studyId ?? '',
        studyTitle:       s.studyTitle      ?? '',
        studyPhaseId:     s.studyPhaseId    ?? '',
        studyPhaseName:   s.studyPhaseName  ?? '',
        scope:            seededScope,
        therapeuticArea:  s.therapeuticArea ?? '',
        studyDescription: s.studyDescription ?? '',
        sponsorId:        s.sponsorId       ?? '',
        sponsorName:      s.sponsorName     ?? '',
      }));
      setStudy(s);
      setLoading(false);
    }).catch(() => {
      dispatch(addToast({ type: 'error', message: 'Failed to load study.' }));
      setLoading(false);
      setNotFound(true);
    });
    return () => { dispatch(resetWizard()); };
  }, [studyId]);

  const handleExit = () => navigate('/cro/studies');

  if (loading) {
    return <div className={styles.loading}>Loading study…</div>;
  }
  if (notFound) {
    return (
      <div className={styles.loading}>
        <button className={styles.backBtn} onClick={handleExit}>
          <ArrowLeft size={14} /> All Studies
        </button>
        <p>Study not found.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandLogo}>EDC</span>
          <span className={styles.brandLabel}>Form Builder</span>
        </div>

        <div className={styles.crumbs}>
          <span className={styles.crumbMute}>Study:</span>
          <span className={styles.crumbStrong}>{study?.protocolNumber || study?.studyId || '—'}</span>
          {study?.studyTitle && (
            <>
              <span className={styles.crumbSep}>•</span>
              <span className={styles.crumb}>{study.studyTitle}</span>
            </>
          )}
        </div>

        <div className={styles.topActions}>
          <button className={styles.btnExit} onClick={handleExit}>
            <ArrowLeft size={14} /> Exit Design
          </button>
        </div>
      </header>

      <main className={styles.builderHost}>
        <StudyFormBuilder
          formId={study?.formId}
          formTitle={study?.studyTitle ? `${study.studyTitle} — Data Collection Form` : ''}
          onPrevious={handleExit}
          onNext={handleExit}
        />
      </main>
    </div>
  );
}
