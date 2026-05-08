import styles from '../dashboard.module.css';

function colorForScore(score) {
  const s = Number(score) || 0;
  if (s >= 80) return '#059669';
  if (s >= 60) return '#84cc16';
  if (s >= 40) return '#d97706';
  if (s >= 20) return '#ea580c';
  return '#dc2626';
}

export default function HeatmapWidget({
  title, data = [], valueKey = 'score', labelKey = 'siteName', onCellClick, half = true,
}) {
  const clsName = half ? `${styles.chartCard} ${styles.chartCardHalf}` : styles.chartCard;
  if (!data.length) {
    return (
      <div className={clsName}>
        <p className={styles.chartTitle}>{title}</p>
        <p className={styles.chartHint}>No data available.</p>
      </div>
    );
  }
  return (
    <div className={clsName}>
      <p className={styles.chartTitle}>{title}</p>
      <div className={styles.heatGrid}>
        {data.map((d, i) => {
          const v = d[valueKey];
          return (
            <button
              key={d.id ?? d[labelKey] ?? i}
              type="button"
              className={styles.heatCell}
              style={{ background: colorForScore(v) }}
              onClick={onCellClick ? () => onCellClick(d) : undefined}
              disabled={!onCellClick}
              title={`${d[labelKey]}: ${v ?? '—'}`}
            >
              <span className={styles.heatLabel}>{d[labelKey]}</span>
              <span className={styles.heatValue}>{v != null ? v : '—'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
