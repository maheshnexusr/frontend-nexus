/**
 * SiteDashboardPage — placeholder landing for the `site` auth scope.
 *
 * After PI activation, the user is redirected here with a `siteAccessToken`
 * stored in localStorage. The real site portal (data capture, consents,
 * queries scoped to this PI's site) will replace this stub.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, FileText, User, Mail, LogOut, Construction } from 'lucide-react';
import styles from './SiteDashboardPage.module.css';

function readSiteUser() {
  try {
    const raw = localStorage.getItem('siteAuthUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SiteDashboardPage() {
  const navigate         = useNavigate();
  const [user, setUser]  = useState(() => readSiteUser());
  const hasToken         = typeof window !== 'undefined' && !!localStorage.getItem('siteAccessToken');

  useEffect(() => {
    // No token → bounce to sign-in. This is the only gate until the real
    // site-portal layout (with its own ProtectedRoute) is built.
    if (!hasToken) navigate('/signin', { replace: true });
  }, [hasToken, navigate]);

  const handleSignOut = () => {
    localStorage.removeItem('siteAccessToken');
    localStorage.removeItem('siteRefreshToken');
    localStorage.removeItem('siteAuthUser');
    setUser(null);
    navigate('/signin', { replace: true });
  };

  if (!user && !hasToken) return null;

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
          <div className={styles.iconWrap}>
            <Construction size={28} />
          </div>
          <h1 className={styles.title}>Welcome, {user?.fullName || 'Investigator'}</h1>
          <p className={styles.sub}>
            Your account is active. The site portal — subject management, data
            capture, queries, and consent — is being built and will be
            available here shortly.
          </p>

          <div className={styles.summary}>
            <Row icon={<FileText size={14} />}  label="Study"  value={user?.studyId} />
            <Row icon={<Building2 size={14} />} label="Site"   value={user?.siteName} />
            <Row icon={<User size={14} />}      label="Role"   value={user?.roleName} />
            <Row icon={<Mail size={14} />}      label="Email"  value={user?.emailAddress} />
            {user?.environment && (
              <Row icon={<FileText size={14} />} label="Env" value={user.environment} />
            )}
          </div>

          <p className={styles.fineprint}>
            Need help? Contact your sponsor administrator. You can return here
            anytime by signing in at <Link to="/signin">/signin</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

function Row({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryIcon}>{icon}</span>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}
