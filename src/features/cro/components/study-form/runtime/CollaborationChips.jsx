/**
 * CollaborationChips — always-visible row of small icon-chips for every
 * collaboration tool that's been ENABLED on this field via the form
 * builder's Collaboration & Audit Tools accordion.
 *
 * These are intentionally distinct from `CollaborationBadges`, which only
 * appears once there's *content* (e.g. an existing query). Chips show
 * straight away on enablement so the user can confirm the toggle is
 * working without hovering for the 3-dot menu.
 *
 * Clicking a chip opens the same popover as the 3-dot menu would.
 */

import {
  MessageSquare, StickyNote, AlertCircle, Paperclip, CheckCircle2, Eraser,
} from 'lucide-react';
import s from './runtime.module.css';

const FEATURES = [
  { key: 'annotations',  kind: 'annotation',   label: 'Annotations',   Icon: MessageSquare, cap: 'canSeeAnnotations'  },
  { key: 'notes',        kind: 'note',         label: 'Notes',         Icon: StickyNote,    cap: 'canSeeNotes'        },
  { key: 'queries',      kind: 'query',        label: 'Queries',       Icon: AlertCircle,   cap: 'canSeeQueries'      },
  { key: 'attachments',  kind: 'attachment',   label: 'Attachments',   Icon: Paperclip,     cap: 'canSeeAttachments'  },
  { key: 'verification', kind: 'verification', label: 'Verification',  Icon: CheckCircle2,  cap: 'canSeeVerification' },
  { key: 'clear',        kind: 'clear',        label: 'Clear',         Icon: Eraser, danger: true, cap: 'canSeeClear'  },
];

export default function CollaborationChips({ collaboration, onOpen, capabilities }) {
  const cfg = collaboration ?? {};
  const cap = capabilities  ?? {};
  // A chip shows iff: per-field toggle is ON AND (Stage 1 ∧ Stage 2) allows
  // the feature. Falsy `capabilities` keys fail open.
  const enabled = FEATURES.filter((f) => !!cfg[f.key] && cap[f.cap] !== false);
  if (enabled.length === 0) return null;

  const handle = (kind) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpen?.(kind, rect);
  };

  return (
    <div className={s.chipRow}>
      {enabled.map(({ key, kind, label, Icon, danger }) => (
        <button
          key={key}
          type="button"
          className={`${s.chip} ${danger ? s.chipDanger : ''}`}
          title={label}
          aria-label={label}
          onClick={handle(kind)}
        >
          <Icon size={11} />
        </button>
      ))}
    </div>
  );
}
