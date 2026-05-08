import styles from '../dashboard.module.css';

const TYPE_COLORS = {
  critical: '#dc2626',
  high:     '#d97706',
  medium:   '#2563eb',
  low:      '#94a3b8',
};

export default function AlertsWidget({ title = 'Alerts & Notifications', alerts = [], onAlertClick }) {
  if (!alerts.length) {
    return (
      <div className={styles.chartCard}>
        <p className={styles.chartTitle}>{title}</p>
        <p className={styles.chartHint}>No active alerts.</p>
      </div>
    );
  }
  return (
    <div className={styles.chartCard}>
      <p className={styles.chartTitle}>{title}</p>
      <div className={styles.alertList}>
        {alerts.map((a, i) => {
          const color = TYPE_COLORS[String(a.type).toLowerCase()] ?? '#64748b';
          return (
            <button
              key={a.id ?? i}
              type="button"
              className={styles.alertItem}
              style={{ borderLeft: `3px solid ${color}` }}
              onClick={onAlertClick ? () => onAlertClick(a) : undefined}
              disabled={!onAlertClick}
            >
              <span className={styles.alertType} style={{ color }}>
                {String(a.type ?? 'ALERT').toUpperCase()}
              </span>
              <span className={styles.alertMsg}>{a.message}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
