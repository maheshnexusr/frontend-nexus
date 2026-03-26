/**
 * AuthLayout — two-column auth shell
 *
 * Desktop ≥1024px: branding panel (left) + form panel (right)
 * Mobile  <1024px: form only, with compact logo at top
 */

import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';

const FEATURES = [
  'Real-time data capture',
  'Audit-ready compliance',
  'Multi-site collaboration',
  'Role-based access control',
];

export default function AuthLayout() {
  return (
    <div className={styles.page}>
      {/* ── Brand panel (desktop only) ────────────────────────────── */}
      <aside className={styles.brand} aria-hidden="true">
        <div className={styles.brandInner}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>SN</span>
            <span className={styles.logoText}>SclinNexus</span>
          </div>

          <h1 className={styles.headline}>
            Streamline your<br />clinical trials
          </h1>

          <p className={styles.tagline}>
            End-to-end Electronic Data Capture designed for sponsors,
            CROs, and clinical sites worldwide.
          </p>

          <ul className={styles.features}>
            {FEATURES.map((f) => (
              <li key={f} className={styles.featureItem}>
                <span className={styles.featureDot} aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.brandDecor} aria-hidden="true" />
      </aside>

      {/* ── Form panel ───────────────────────────────────────────── */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          {/* Mobile-only logo */}
          <div className={styles.mobileLogo}>
            <span className={styles.logoMarkAlt}>SN</span>
            <span className={styles.logoTextAlt}>SclinNexus</span>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
