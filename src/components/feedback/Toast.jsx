import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { removeToast } from '@/features/notifications/notificationSlice';
import styles from './Toast.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

const TYPE_CONFIG = {
  success: { icon: CheckCircle,   wrapClass: 'wrapSuccess', iconClass: 'iconSuccess' },
  error:   { icon: XCircle,       wrapClass: 'wrapError',   iconClass: 'iconError'   },
  warning: { icon: AlertTriangle, wrapClass: 'wrapWarning', iconClass: 'iconWarning' },
  info:    { icon: Info,          wrapClass: 'wrapInfo',    iconClass: 'iconInfo'    },
};

/**
 * Toast — individual notification tile.
 * Mounts with a slide-in animation, auto-dismisses after `duration` ms.
 */
export default function Toast({ id, type, message, duration }) {
  const dispatch = useAppDispatch();
  const dismiss  = () => dispatch(removeToast(id));

  /* auto-dismiss */
  useEffect(() => {
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [id, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
  const Icon   = config.icon;

  return (
    <div
      className={clx(styles.toast, styles[config.wrapClass])}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className={clx(styles.iconWrap, styles[config.iconClass])}>
        <Icon size={16} />
      </span>

      <p className={styles.message}>{message}</p>

      <button
        className={styles.closeBtn}
        onClick={dismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

Toast.propTypes = {
  id:       PropTypes.string.isRequired,
  type:     PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  message:  PropTypes.string.isRequired,
  duration: PropTypes.number,
};

Toast.defaultProps = {
  type:     'info',
  duration: 5000,
};
