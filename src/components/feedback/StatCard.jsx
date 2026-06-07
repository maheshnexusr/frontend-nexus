import styles from './StatCard.module.css';

/**
 * Shared metric / KPI card used across the platform (Verification Manager,
 * Query Manager, dashboards…). Change the design here and every screen that
 * renders a <StatCard> updates with it.
 *
 * Layout: an accent bar across the top, the value + label on the left, and the
 * icon on the right (plain, accent-coloured — no shaded chip).
 *
 * Props:
 *   icon    — optional Lucide icon component.
 *   label   — caption under the value.
 *   value   — the metric (number or string).
 *   accent  — hex colour driving the value text, top bar and icon.
 *   hint    — optional small secondary line under the label.
 *   onClick — when provided the card becomes a button (keyboard + hover affordance).
 *   title   — native tooltip.
 */
export default function StatCard({ icon: Icon, label, value, accent = '#2563eb', hint, onClick, title }) {
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={`${styles.card} ${clickable ? styles.clickable : ''}`}
      style={{ '--accent': accent }}
      onClick={clickable ? onClick : undefined}
      title={title}
    >
      <span className={styles.body}>
        <span className={styles.value} style={{ color: accent }}>{value ?? '—'}</span>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      {Icon && (
        <span className={styles.icon} style={{ color: accent }}>
          <Icon size={22} strokeWidth={2} />
        </span>
      )}
    </Tag>
  );
}
