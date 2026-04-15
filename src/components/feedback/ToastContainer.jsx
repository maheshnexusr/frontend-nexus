import { createPortal } from 'react-dom';
import { useAppSelector } from '@/app/hooks';
import { selectToasts } from '@/app/notificationSlice';
import Toast from './Toast';
import styles from './ToastContainer.module.css';

/**
 * ToastContainer — reads the toasts array from Redux and renders each Toast.
 * Mount this once at the app root (inside the Redux Provider):
 *
 *   <ToastContainer />
 *
 * It renders into document.body via a portal at z-index var(--z-toast).
 */
export default function ToastContainer() {
  const toasts = useAppSelector(selectToasts);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className={styles.container} aria-label="Notifications" role="region">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
        />
      ))}
    </div>,
    document.body,
  );
}
