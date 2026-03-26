import PropTypes from 'prop-types';
import styles from './EmptyState.module.css';

/* ── Default "no data" illustration ──────────────────────────────────────── */
function DefaultIllustration() {
  return (
    <svg
      width="160"
      height="130"
      viewBox="0 0 160 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* folder body */}
      <rect x="20" y="45" width="120" height="72" rx="8" fill="var(--bg-active)" />
      {/* folder tab */}
      <rect x="20" y="38" width="52" height="16" rx="6 6 0 0" fill="var(--border-medium)" />
      {/* lines */}
      <rect x="36" y="67" width="88" height="7" rx="3.5" fill="var(--border-medium)" />
      <rect x="36" y="82" width="64" height="7" rx="3.5" fill="var(--border-medium)" />
      <rect x="36" y="97" width="44" height="7" rx="3.5" fill="var(--border-medium)" />
      {/* empty-circle badge */}
      <circle cx="118" cy="38" r="20" fill="var(--bg-surface)" stroke="var(--border-medium)" strokeWidth="2" />
      <line x1="112" y1="32" x2="124" y2="44" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="124" y1="32" x2="112" y2="44" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function EmptyState({ message, illustration }) {
  return (
    <div className={styles.container}>
      <div className={styles.illustration}>
        {illustration ?? <DefaultIllustration />}
      </div>
      <p className={styles.message}>{message}</p>
    </div>
  );
}

EmptyState.propTypes = {
  /** Text shown below the illustration */
  message: PropTypes.string,
  /** Custom illustration node; falls back to built-in SVG */
  illustration: PropTypes.node,
};

EmptyState.defaultProps = {
  message:      'No data available',
  illustration: null,
};
