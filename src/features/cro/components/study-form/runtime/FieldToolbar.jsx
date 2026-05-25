import { useEffect, useRef, useState } from 'react';
import {
  MoreVertical, MessageSquare, StickyNote, AlertCircle, Paperclip,
  CheckCircle2, Eraser, History,
} from 'lucide-react';
import s from './runtime.module.css';

/**
 * FieldToolbar — three-dot action menu shown on field hover/focus.
 *
 * `enabled` drives which actions render. Keys match the builder's
 * Comments/Collaboration tab (field.collaboration):
 *
 *   enabled = {
 *     annotations: bool, notes: bool, queries: bool,
 *     attachments: bool, verification: bool, clear: bool,
 *   }
 *
 * Anything missing defaults to OFF — an action only shows up after the user
 * flips its toggle in the field properties panel. `audit` is always on; an
 * audit trail is universal across all fields.
 */
export default function FieldToolbar({ enabled, onAction, capabilities }) {
  const e   = enabled      ?? {};
  // Default to "everything allowed" when no capabilities are supplied —
  // matches the existing fail-open pattern. Stage 1 + Stage 2 gates only
  // kick in once a workspace context loads via useFieldCapabilities().
  const cap = capabilities ?? {};
  const allow = (key, perm = true) => perm !== false;
  // A toolbar item shows iff:
  //   designer's per-field toggle is ON  AND
  //   Stage 1 + Stage 2 visibility says yes (cap.canSeeX !== false).
  // Falsy `capabilities` keys default to allowed (fail-open).
  const cfg = {
    annotations:  !!e.annotations  && cap.canSeeAnnotations  !== false,
    notes:        !!e.notes        && cap.canSeeNotes        !== false,
    queries:      !!e.queries      && cap.canSeeQueries      !== false,
    attachments:  !!e.attachments  && cap.canSeeAttachments  !== false,
    verification: !!e.verification && cap.canSeeVerification !== false,
    clear:        !!e.clear        && cap.canSeeClear        !== false,
    audit:                            cap.canSeeAudit        !== false,
  };
  // Silence the unused-helper warning in some toolchains.
  void allow;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Capture the toolbar button's rect so the parent can anchor a popover to it.
  const triggerRef = useRef(null);
  const fire = (kind) => () => {
    const rect = triggerRef.current?.getBoundingClientRect() ?? null;
    setOpen(false);
    onAction?.(kind, rect);
  };

  const items = [
    cfg.annotations  && { kind: 'annotation',   label: 'Annotations',        Icon: MessageSquare },
    cfg.notes        && { kind: 'note',         label: 'Add Note',           Icon: StickyNote },
    cfg.queries      && { kind: 'query',        label: 'Raise Query',        Icon: AlertCircle },
    cfg.attachments  && { kind: 'attachment',   label: 'Upload Attachment',  Icon: Paperclip },
    cfg.verification && { kind: 'verification', label: 'Verify Field',       Icon: CheckCircle2 },
    cfg.audit        && { kind: 'audit',        label: 'View Audit History', Icon: History },
    cfg.clear        && { kind: 'clear',        label: 'Clear Field',        Icon: Eraser, danger: true },
  ].filter(Boolean);

  // Only show the toolbar when at least one user-toggleable feature is on.
  // Audit history alone (always present internally) isn't enough — otherwise
  // every field would show a 3-dot button even when no collab is enabled.
  const hasUserToggle =
    cfg.annotations || cfg.notes || cfg.queries ||
    cfg.attachments || cfg.verification || cfg.clear;
  if (!hasUserToggle) return null;
  if (items.length === 0) return null;

  return (
    <div className={`${s.toolbarWrap} ${open ? 'open' : ''}`} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${s.toolbarBtn} ${open ? s.toolbarBtnActive : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Field actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div className={s.toolbarMenu} role="menu">
          {items.map(({ kind, label, Icon, danger }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              className={`${s.toolbarItem} ${danger ? s.toolbarItemDanger : ''}`}
              onClick={fire(kind)}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
