import PropTypes from 'prop-types';
import styles from './StatusBadge.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/**
 * Maps a raw status string to a variant name.
 * Keys are lower-cased before lookup.
 */
const STATUS_TO_VARIANT = {
  // success
  active:    'success',
  approved:  'success',
  completed: 'success',
  verified:  'success',
  enabled:   'success',
  open:      'success',
  live:      'success',

  // warning
  locked:    'warning',
  pending:   'warning',
  review:    'warning',
  draft:     'warning',
  suspended: 'warning',
  onhold:    'warning',
  'on hold': 'warning',

  // danger
  inactive:  'danger',
  rejected:  'danger',
  failed:    'danger',
  disabled:  'danger',
  closed:    'danger',
  expired:   'danger',
  deleted:   'danger',

  // info
  published: 'info',
  enrolled:  'info',
  invited:   'info',
  uat:       'info',
  submitted: 'info',
};

const VARIANT_CLASS = {
  success: styles.success,
  warning: styles.warning,
  danger:  styles.danger,
  info:    styles.info,
  default: styles.default,
};

/**
 * StatusBadge — small pill badge for entity statuses.
 *
 * Usage:
 *   <StatusBadge status="Active" />               // auto-maps to 'success'
 *   <StatusBadge status="Pending" />              // auto-maps to 'warning'
 *   <StatusBadge status="Custom" variant="info" /> // explicit override
 */
export default function StatusBadge({ status, variant }) {
  const resolved =
    variant ??
    STATUS_TO_VARIANT[status?.toLowerCase()] ??
    'default';

  return (
    <span className={clx(styles.badge, VARIANT_CLASS[resolved] ?? styles.default)}>
      <span className={styles.dot} aria-hidden="true" />
      {status}
    </span>
  );
}

StatusBadge.propTypes = {
  /** The status label to display */
  status: PropTypes.string.isRequired,
  /**
   * Explicit variant override. When omitted the component auto-maps `status`
   * via the built-in STATUS_TO_VARIANT dictionary.
   */
  variant: PropTypes.oneOf(['success', 'warning', 'danger', 'info', 'default']),
};

StatusBadge.defaultProps = {
  variant: null,
};
