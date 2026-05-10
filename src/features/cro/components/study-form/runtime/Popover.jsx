/**
 * Popover — shared anchored popover for every collaboration workflow.
 *
 * Drop-in scaffold:
 *   <Popover
 *     anchorRect={rect}
 *     title="Annotations"
 *     onClose={...}
 *     width={400}
 *     footer={<button>Close</button>}
 *   >
 *     <Body />
 *   </Popover>
 *
 * Behavior:
 *   - Portals to document.body so it escapes any ancestor stacking context.
 *   - Positions below the anchor, right-aligned to it; flips above if no room.
 *   - Closes on outside-click and Escape.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import s from './runtime.module.css';

const VIEWPORT_PAD = 12;

export default function Popover({
  anchorRect,
  title,
  width = 380,
  maxHeight = 480,
  onClose,
  footer,
  children,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  /* Compute position once we have the anchor rect AND the popover has
     measured itself, so we can flip if needed. */
  useLayoutEffect(() => {
    if (!anchorRect) {
      // No anchor → center near the top.
      setPos({
        top:  Math.max(VIEWPORT_PAD, window.scrollY + 60),
        left: Math.max(VIEWPORT_PAD, window.scrollX + (window.innerWidth - width) / 2),
        ready: true,
      });
      return;
    }
    const node = ref.current;
    const popH = node?.offsetHeight ?? maxHeight;

    // Default: open below, right-aligned to the anchor.
    let top  = anchorRect.bottom + 6 + window.scrollY;
    let left = anchorRect.right - width + window.scrollX;

    // Flip above if popover would overflow the viewport bottom.
    if (anchorRect.bottom + popH + 24 > window.innerHeight) {
      top = anchorRect.top - popH - 6 + window.scrollY;
    }
    // Clamp inside the viewport horizontally.
    const minLeft = window.scrollX + VIEWPORT_PAD;
    const maxLeft = window.scrollX + window.innerWidth - width - VIEWPORT_PAD;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    setPos({ top, left, ready: true });
  }, [anchorRect, width, maxHeight]);

  /* Outside click + Escape close */
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown',   onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={s.popoverShell}
      style={{
        position: 'absolute',
        top:      pos.top,
        left:     pos.left,
        width,
        maxHeight,
        opacity:  pos.ready ? 1 : 0,
      }}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={s.popoverShellHead}>
        <span className={s.popoverShellTitle}>{title}</span>
        <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className={s.popoverShellBody}>{children}</div>
      {footer && <div className={s.popoverShellFoot}>{footer}</div>}
    </div>,
    document.body,
  );
}
