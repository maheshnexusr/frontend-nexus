/**
 * StudyDesignPage — /cro/studies/:studyId/design
 *
 * Full-screen, standalone Form Builder host launched from the studies list
 * "Design Study" action. Hydrates the wizard's Step 1 slice with the study's
 * primary key so the existing StudyFormBuilder (which reads selectStep1) can
 * load, save, and publish the form design without going through the wizard.
 *
 * The visible chrome (sticky top header) uses the new EDC design language —
 * white surface, blue accent, search + user + Publish — wrapping the existing
 * StudyFormBuilder body untouched. None of the form-builder elements
 * (SFBLeft / SFBCanvas / SFBRight / SFBPreview) are modified.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch }            from 'react-redux';
import {
  ArrowLeft, Send, Database, Globe, X, Loader2, CheckCircle2,
} from 'lucide-react';
import { studiesClient }         from '@/features/cro/api/studiesClient';
import { addToast }              from '@/app/notificationSlice';
import { resetWizard, setStep1, setStep3 } from '@/features/cro/store/studyWizardSlice';
import { useAppSelector }        from '@/app/hooks';
import { selectCurrentUser }     from '@/features/auth/authSlice';
import { usePermissions }        from '@/features/auth/usePermissions';
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

  // Publishing is gated separately from designing — a role may configure the
  // form but not push a release. Mirrors authorize("…Studies", "publish").
  const { has }     = usePermissions();
  const canPublish  = has('studies', 'publish');

  const [loading,  setLoading]  = useState(true);
  const [study,    setStudy]    = useState(null);
  const [notFound, setNotFound] = useState(false);
  // Publish popup state
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing,  setPublishing]  = useState(false);

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

  /** Publish the current form design to the chosen environment.
   *  studyDbId is the cro_studies primary key (the URL param :studyId is
   *  the SAME id here, but using `study.id` keeps us aligned with the
   *  rest of the publish flow in StudyWizardStep6.) */
  const handlePublish = async (environment) => {
    if (!study?.id) {
      dispatch(addToast({ type: 'error', message: 'Study not loaded — cannot publish.', duration: 4000 }));
      return;
    }
    setPublishing(true);
    try {
      const release = await studiesClient.publish(study.id, { environment });
      const dbName  = release?.databaseName ?? release?.database_name;
      dispatch(addToast({
        type:     'success',
        message:  `Study published to ${environment} successfully.${dbName ? ` Database '${dbName}' created.` : ''}`,
        duration: 5000,
      }));
      setPublishOpen(false);
    } catch {
      dispatch(addToast({
        type:     'error',
        message:  `Failed to publish to ${environment}. Please contact your system administrator.`,
        duration: 5000,
      }));
    } finally {
      setPublishing(false);
    }
  };

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
          {canPublish && (
            <button
              type="button"
              className={styles.publishBtn}
              onClick={() => setPublishOpen(true)}
            >
              <Send size={13} /> Publish
            </button>
          )}

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

      {/* ── Publish env-picker popup ─────────────────────────────────────── */}
      {publishOpen && (
        <PublishEnvModal
          studyId={studyCode}
          studyTitle={studyTtl}
          publishing={publishing}
          onCancel={() => { if (!publishing) setPublishOpen(false); }}
          onPublish={handlePublish}
        />
      )}
    </div>
  );
}

/* ── Publish environment picker ─────────────────────────────────────────────
 * Two-card chooser: UAT (sandbox) vs LIVE (production). Click a card →
 * immediately calls onPublish(env). The card under publish shows a spinner
 * + disables the other so concurrent submits aren't possible.
 */
function PublishEnvModal({ studyId, studyTitle, publishing, onCancel, onPublish }) {
  const [pending, setPending] = useState(null); // 'UAT' | 'LIVE' while in flight

  const handleClick = (env) => {
    if (publishing) return;
    setPending(env);
    onPublish(env);
  };

  return createPortal(
    <div
      role="dialog"
      aria-label="Publish to environment"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460,
          boxShadow: '0 22px 50px rgba(15, 23, 42, 0.3)',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              Publish Form
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              {studyTitle ? `${studyTitle} · ${studyId}` : studyId}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={publishing}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: 0, background: 'transparent',
              color: '#64748b', cursor: publishing ? 'not-allowed' : 'pointer', borderRadius: 6,
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569' }}>
            Choose the target environment for this release.
          </p>

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { env: 'UAT',  Icon: Database, title: 'UAT',  desc: 'User Acceptance Testing — safe sandbox',     bg: '#fef3c7', fg: '#b45309' },
              { env: 'LIVE', Icon: Globe,    title: 'LIVE', desc: 'Production — live data collection',          bg: '#ede9fe', fg: '#6d28d9' },
            ].map(({ env, Icon, title, desc, bg, fg }) => {
              const isBusy   = pending === env && publishing;
              const disabled = publishing && !isBusy;
              return (
                <button
                  key={env}
                  type="button"
                  onClick={() => handleClick(env)}
                  disabled={publishing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    textAlign: 'left', padding: 14,
                    background: '#fff',
                    border: '1px solid #e2e8f0', borderRadius: 10,
                    cursor: publishing ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.55 : 1,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!publishing) { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(37,99,235,.12)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 42, height: 42, borderRadius: 10,
                    background: bg, color: fg, flex: '0 0 auto',
                  }}>
                    <Icon size={20} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                      {title}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {desc}
                    </div>
                  </div>
                  {isBusy
                    ? <Loader2 size={18} color="#2563eb" style={{ animation: 'rt-spin 700ms linear infinite' }} />
                    : <CheckCircle2 size={18} color="#94a3b8" />}
                </button>
              );
            })}
          </div>
        </div>

        <footer style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px 16px',
        }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={publishing}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid #cbd5e1', borderRadius: 8,
              color: '#475569', fontSize: 13, fontWeight: 500,
              cursor: publishing ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
