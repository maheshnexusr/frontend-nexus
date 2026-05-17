import styles from '../dashboard.module.css';

export default function KpiCard({ label, value, hint, accent = '#2563eb', onClick }) {
  const clickable = typeof onClick === 'function';
  const className = clickable ? `${styles.kpi} ${styles.kpiClickable}` : styles.kpi;
  return (
    <button
      type="button"
      className={className}
      style={{ borderTopColor: accent }}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
    >
      <p className={styles.kpiValue} style={{ color: accent }}>{value ?? '—'}</p>
      <p className={styles.kpiLabel}>{label}</p>
      {hint && <p className={styles.kpiHint}>{hint}</p>}
    </button>
  );
}
