/**
 * StudyDesignPage — /cro/studies/:studyId/design
 *
 * Full-screen, standalone Form Builder host launched from the studies list
 * "Design Study" action. Hydrates the wizard's Step 1 slice with the study's
 * primary key so the existing StudyFormBuilder (which reads selectStep1) can
 * load and save the form design without going through the wizard.
 *
 * Publishing has moved to the Studies-table "Publish Settings" modal — this
 * page is design-only now.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch }            from 'react-redux';
import { ArrowLeft } from 'lucide-react';
import { studiesClient }         from '@/features/cro/api/studiesClient';
import { addToast }              from '@/app/notificationSlice';
import { resetWizard, setStep1, setStep3 } from '@/features/cro/store/studyWizardSlice';
import { useAppSelector }        from '@/app/hooks';
import { selectCurrentUser }     from '@/features/auth/authSlice';
import StudyFormBuilder          from '@/features/cro/components/study-form/StudyFormBuilder';
import StudyDesignSearch         from './StudyDesignSearch';
import styles from './StudyDesignPage.module.css';

function initials(name = '') {
  return name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '').join('') || 'PS';
}

export default function StudyDesignPage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();
  const user        = useAppSelector(selectCurrentUser);

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
      // Hydrate Step 3 too — the form builder's Collaboration & Tools gates
      // the per-field "Queries" toggle on step3.queryManager. Without this the
      // designer always sees Query Manager as OFF and can't enable queries.
      dispatch(setStep3({
        consentManager:      s.consentManager      ?? false,
        consentApproval:     s.consentApproval      ?? false,
        queryManager:        s.queryManager        ?? false,
        dataManager:         s.dataManager         ?? false,
        verificationManager: s.verificationManager ?? false,
        navigationBar:       s.navigationBar       ?? false,
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

  const fullName  = user?.fullName || 'Prashant S.';
  const roleName  = user?.roleName || 'Data Manager';
  const studyCode = study?.protocolNumber || study?.studyId || '—';
  const studyTtl  = study?.studyTitle;

  return (
    <div className={styles.page}>
      {/* ── Sticky top header ─────────────────────────────────────────────── */}
      <header className={styles.header}>
        {/* Brand + study identity */}
        <div className={styles.brand}>
          <div className={styles.brandLogo}>K</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>EDC</span>
            <span className={styles.brandSub}>Form Builder</span>
          </div>
          <span className={styles.crumbSep}>/</span>
          <div className={styles.studyChip}>
            <span className={styles.studyChipKey}>Study:</span>
            <span className={styles.studyChipValue}>{studyCode}</span>
            {studyTtl && (
              <>
                <span className={styles.studyChipDot}>•</span>
                <span className={styles.studyChipTitle}>{studyTtl}</span>
              </>
            )}
          </div>
        </div>

        {/* Global search (wired) */}
        <div className={styles.searchWrap}>
          <StudyDesignSearch />
        </div>

        {/* Actions */}
        <div className={styles.headerActions}>
          <div className={styles.user}>
            <div className={styles.userAvatar}>{initials(fullName)}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{fullName}</span>
              <span className={styles.userRole}>{roleName}</span>
            </div>
          </div>

          <button
            type="button"
            className={styles.btnExit}
            onClick={handleExit}
            title="Exit Design"
          >
            <ArrowLeft size={14} /> Exit
          </button>
        </div>
      </header>

      {/* ── Builder body (untouched) ──────────────────────────────────────── */}
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

