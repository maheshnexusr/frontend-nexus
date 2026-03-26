import styles from "./MobileOverlay.module.css";

// Rendered only when the mobile drawer is open.
// On tablet+ the CSS hides it via media query as a safety net.
export default function MobileOverlay({ show, onClose }) {
  if (!show) return null;
  return <div onClick={onClose} className={styles.overlay} />;
}
