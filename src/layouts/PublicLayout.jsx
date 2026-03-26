/**
 * PublicLayout — marketing / public pages shell.
 * Provides a minimal top navbar and footer.
 */

import { Link, Outlet } from 'react-router-dom';
import styles from './PublicLayout.module.css';

export default function PublicLayout() {
  return (
    <div className={styles.page}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className={styles.navbar}>
        <Link to="/" className={styles.navLogo}>
          <span className={styles.navLogoMark}>SN</span>
          SclinNexus
        </Link>

        <nav className={styles.navLinks}>
          <Link to="/signin"  className={styles.navLink}>Sign In</Link>
          <Link to="/signup"  className={styles.navCta}>Get Started</Link>
        </nav>
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link to="/privacy-policy" className={styles.footerLink}>Privacy Policy</Link>
          <Link to="/terms-of-use"   className={styles.footerLink}>Terms of Use</Link>
          <Link to="/cookie-policy"  className={styles.footerLink}>Cookie Policy</Link>
        </div>
        <p className={styles.footerCopy}>
          &copy; {new Date().getFullYear()} SclinNexus. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
