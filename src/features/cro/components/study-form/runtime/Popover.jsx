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
  hidden = false,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, effMaxH: maxHeight, ready: false });

  /* Compute position once we have the anchor rect AND the popover has
     measured itself, so we can flip if needed.
     Strategy:
       1. Measure available space below and above the anchor.
       2. Pick the side with MORE room (prefer below on ties).
       3. Cap the popover's effective max-height to that available space
          (minus padding) so it never overflows the viewport. The internal
          body has overflow-y:auto, so long content just scrolls.
       4. Clamp horizontally so the popover stays in the viewport. */
  useLayoutEffect(() => {
    if (!anchorRect) {
      // No anchor → center near the top.
      setPos({
        top:    Math.max(VIEWPORT_PAD, window.scrollY + 60),
        left:   Math.max(VIEWPORT_PAD, window.scrollX + (window.innerWidth - width) / 2),
        effMaxH: maxHeight,
        ready:  true,
      });
      return;
    }
    const node     = ref.current;
    const measured = node?.offsetHeight ?? maxHeight;

    const spaceBelow = window.innerHeight - anchorRect.bottom - VIEWPORT_PAD;
    const spaceAbove = anchorRect.top - VIEWPORT_PAD;

    // Pick the side with more room (prefer below on ties).
    const openBelow = spaceBelow >= spaceAbove;
    const room      = openBelow ? spaceBelow : spaceAbove;

    // Effective max-height: never exceed the cap, never exceed available room.
    // Floor of 160px so very-tight cases still show something usable.
    const effMaxH = Math.max(160, Math.min(maxHeight, room - 12));
    // Use measured height (capped at effMaxH) for the position math so the
    // popover doesn't get pushed off-screen when content is short.
    const popH = Math.min(measured, effMaxH);

    let top = openBelow
      ? anchorRect.bottom + 6 + window.scrollY
      : anchorRect.top    - popH - 6 + window.scrollY;

    // Hard vertical clamp — last resort if the anchor is awkwardly placed.
    const minTop = window.scrollY + VIEWPORT_PAD;
    const maxTop = window.scrollY + window.innerHeight - popH - VIEWPORT_PAD;
    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;

    let left = anchorRect.right - width + window.scrollX;
    const minLeft = window.scrollX + VIEWPORT_PAD;
    const maxLeft = window.scrollX + window.innerWidth - width - VIEWPORT_PAD;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    setPos({ top, left, effMaxH, ready: true });
  }, [anchorRect, width, maxHeight]);

  /* Outside click + Escape close — skipped while hidden so a sub-dialog
     opened on top can't accidentally dismiss this popover when the user
     clicks/escapes inside the sub-dialog. */
  useEffect(() => {
    if (hidden) return undefined;
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
  }, [onClose, hidden]);

  return createPortal(
    <div
      ref={ref}
      className={s.popoverShell}
      style={{
        position:      'absolute',
        top:           pos.top,
        left:          pos.left,
        width,
        // Effective max-height = min(prop, available viewport space).
        // Ensures the popover never overflows the viewport regardless of
        // anchor position. Internal body scrolls when content is taller.
        maxHeight:     pos.ready ? pos.effMaxH : maxHeight,
        // While `hidden`, keep the DOM node mounted so its position +
        // measured height are preserved, but hide it visually and prevent
        // interaction. This way a sub-dialog can open on top, and when it
        // closes the popover re-appears in exactly the same spot.
        opacity:        hidden ? 0 : (pos.ready ? 1 : 0),
        visibility:     hidden ? 'hidden' : 'visible',
        pointerEvents:  hidden ? 'none' : 'auto',
      }}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      aria-hidden={hidden || undefined}
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
