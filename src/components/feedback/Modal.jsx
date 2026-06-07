import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

const SIZE_CLASS = { sm: styles.cardSm, md: styles.cardMd, lg: styles.cardLg };

/**
 * Modal — accessible dialog with focus trap, ESC-to-close and body scroll lock.
 * Renders into document.body via a portal to avoid z-index stacking issues.
 *
 * On mobile (< 480 px) automatically becomes a full-screen bottom sheet.
 */
export default function Modal({ open, isOpen, onClose, title, size, children, footer }) {
  const cardRef = useRef(null);
  // Accept BOTH `open` and `isOpen` — many call-sites pass `isOpen`. Treating
  // them as aliases (default true so a bare `<Modal>` still shows) fixes those
  // callers, which were silently rendering null.
  const visible = (open ?? isOpen) ?? true;

  /* ── Body scroll lock ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  /* ── ESC key ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  /* ── Focus trap ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!visible) return;
    const card = cardRef.current;
    if (!card) return;

    const focusable = card.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    // Move focus into modal
    first?.focus();

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };

    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
      aria-hidden={!visible}
    >
      <div
        ref={cardRef}
        className={clx(styles.card, SIZE_CLASS[size] ?? SIZE_CLASS.md)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          {title && (
            <h2 id="modal-title" className={styles.title}>{title}</h2>
          )}
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

Modal.propTypes = {
  /** Controls visibility (alias: `isOpen`). Omit both → visible. */
  open:    PropTypes.bool,
  /** Alias for `open` — many call-sites use this name. */
  isOpen:  PropTypes.bool,
  /** Called when backdrop is clicked, ESC is pressed, or the ✕ button is clicked */
  onClose: PropTypes.func.isRequired,
  /** Dialog heading */
  title:   PropTypes.string,
  /** Controls max-width: 'sm' 400px | 'md' 560px | 'lg' 720px */
  size:    PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Dialog body content */
  children: PropTypes.node,
  /** Sticky footer slot (pass JSX buttons) */
  footer:  PropTypes.node,
};

Modal.defaultProps = {
  open:     undefined,
  isOpen:   undefined,
  title:    '',
  size:     'md',
  children: null,
  footer:   null,
};
