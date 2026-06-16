/**
 * SiteDashboardPage — the site-personnel study picker.
 *
 * Routes:
 *   /site/dashboard  → kept for backwards-compat: if a study is already
 *                      chosen, falls through to <SiteLayout /> via redirect;
 *                      otherwise renders this picker.
 *   /site/studies    → the picker, always.
 *
 * After choose() succeeds the study-scoped workspace token + context are in
 * localStorage; navigation to /site/dashboard then enters SiteLayout (sidebar
 * is permission-gated). Switching studies (handled by SiteLayout's header
 * button) drops the context and returns here.
 */

import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Building2, LogOut, Loader2, AlertCircle,
} from 'lucide-react';
import { siteAuthClient }  from '@/features/site/api/siteAuthClient';
import { siteStudyClient } from '@/features/site/api/siteStudyClient';
import { resolveFileUrl } from '@/api/fileUrl';
import {
  getSiteAuthUser,
  getSiteStudies,
  hasSiteStudyContext,
  isSiteSession,
} from '@/features/site/authStore';
import styles from './SiteDashboardPage.module.css';

export default function SiteDashboardPage() {
  const navigate = useNavigate();

  const [user]              = useState(() => getSiteAuthUser());
  const [studies, setStudies] = useState(() => getSiteStudies());
  const [phase, setPhase]   = useState('idle'); // idle | choosing | error
  const [error, setError]   = useState('');

  // No session → /signin.
  useEffect(() => {
    if (!isSiteSession()) navigate('/signin', { replace: true });
  }, [navigate]);

  // Refresh the picker list from the server on mount (cheap, session token).
  useEffect(() => {
    let cancelled = false;
    siteStudyClient.list()
      .then((list) => { if (!cancelled) setStudies(list); })
      .catch(() => { /* keep the cached list */ });
    return () => { cancelled = true; };
  }, []);

  // A study is already chosen → go straight into the workspace shell.
  if (hasSiteStudyContext()) {
    return <Navigate to="/site/dashboard" replace />;
  }

  const handleChoose = async (study) => {
    setPhase('choosing');
    setError('');
    try {
      await siteStudyClient.choose({
        studyId:     study.studyId,
        environment: study.environment,
      });
      navigate('/site/dashboard', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Could not open that study.');
      setPhase('error');
    }
  };

  const handleSignOut = async () => {
    await siteAuthClient.logout();
    navigate('/signin', { replace: true });
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Building2 size={18} className={styles.brandIcon} />
          <span>Site Portal</span>
        </div>
        <button type="button" className={styles.signOut} onClick={handleSignOut}>
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Welcome, {user?.fullName || 'Investigator'}</h1>
          <p className={styles.sub}>
            Choose a study to enter its workspace. You can switch studies any
            time without signing in again.
          </p>

          {error && (
            <div className={styles.errorBox}>
              <AlertCircle size={14} /> <span>{error}</span>
            </div>
          )}

          {studies.length === 0 ? (
            <p className={styles.sub}>
              You have not been assigned to any studies yet. Contact your
              sponsor administrator.
            </p>
          ) : (
            <ul className={styles.studyList}>
              {studies.map((s) => (
                <li key={s.assignmentId ?? `${s.studyId}-${s.environment}`}>
                  <button
                    type="button"
                    className={styles.studyCard}
                    disabled={phase === 'choosing' || !s.isPublished}
                    onClick={() => handleChoose(s)}
                  >
                    <span className={styles.cardLogo}>
                      {resolveFileUrl(s.organizationLogo)
                        ? <img src={resolveFileUrl(s.organizationLogo)} alt={s.sponsorName || 'Sponsor'} className={styles.cardLogoImg} />
                        : <Building2 size={18} strokeWidth={2} />}
                    </span>
                    <span className={styles.cardText}>
                      <span className={styles.studyTitle}>
                        {s.studyTitle || s.protocolNumber || s.studyId}
                      </span>
                      <span className={styles.studyMeta}>
                        {s.protocolNumber} · {s.environment} · {s.roleName || 'Site personnel'}
                        {s.siteName ? ` · ${s.siteName}` : ''}
                      </span>
                      {!s.isPublished && (
                        <span className={styles.studyMeta}>Not published yet</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {phase === 'choosing' && (
            <p className={styles.sub} style={{ marginTop: 12 }}>
              <Loader2 size={14} className={styles.spinner} /> Opening study…
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
