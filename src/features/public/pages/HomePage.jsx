import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.badge}>Electronic Data Capture</span>
          <h1 className={styles.headline}>
            Clinical trials, managed<br />with precision.
          </h1>
          <p className={styles.tagline}>
            SclinNexus is a purpose-built EDC platform for sponsors, CROs, and
            clinical sites — real-time data capture, audit-ready compliance,
            multi-site collaboration.
          </p>
          <div className={styles.heroCta}>
            <Link to="/signup" className={styles.ctaPrimary}>Get Started Free</Link>
            <Link to="/signin" className={styles.ctaSecondary}>Sign In</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
