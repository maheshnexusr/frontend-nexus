import PropTypes from 'prop-types';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import Modal from './Modal';
import styles from './ConfirmDialog.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

const VARIANT_CONFIG = {
  danger:  { icon: AlertCircle,  iconClass: 'iconDanger',  btnClass: 'btnDanger'  },
  warning: { icon: AlertTriangle, iconClass: 'iconWarning', btnClass: 'btnWarning' },
  info:    { icon: Info,          iconClass: 'iconInfo',    btnClass: 'btnInfo'    },
};

/**
 * ConfirmDialog — a slim confirmation dialog built on top of Modal.
 * Shows an icon, message, and Cancel + Confirm buttons whose colour matches
 * the variant.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant,
}) {
  const { icon: Icon, iconClass, btnClass } = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info;

  const footer = (
    <>
      <button className={styles.cancelBtn} onClick={onClose} type="button">
        {cancelLabel}
      </button>
      <button
        className={clx(styles.confirmBtn, styles[btnClass])}
        onClick={() => { onConfirm(); onClose(); }}
        type="button"
      >
        {confirmLabel}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} size="sm" footer={footer}>
      <div className={styles.content}>
        <div className={clx(styles.iconWrap, styles[iconClass])}>
          <Icon size={22} />
        </div>

        {title && <h3 className={styles.title}>{title}</h3>}

        {message && <p className={styles.message}>{message}</p>}
      </div>
    </Modal>
  );
}

ConfirmDialog.propTypes = {
  open:         PropTypes.bool.isRequired,
  onClose:      PropTypes.func.isRequired,
  /** Called when the user clicks the confirm button */
  onConfirm:    PropTypes.func.isRequired,
  title:        PropTypes.string,
  message:      PropTypes.string,
  confirmLabel: PropTypes.string,
  cancelLabel:  PropTypes.string,
  /** Controls icon and confirm-button colour */
  variant:      PropTypes.oneOf(['danger', 'warning', 'info']),
};

ConfirmDialog.defaultProps = {
  title:        '',
  message:      'Are you sure you want to continue?',
  confirmLabel: 'Confirm',
  cancelLabel:  'Cancel',
  variant:      'info',
};
