/**
 * SFBCanvas — center canvas showing the active page's fields.
 * Accepts drag-drop from SFBLeft palette.
 */
import { useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector }       from 'react-redux';
import {
  Trash2, Copy, GripVertical,
  Type, Hash, Mail, Phone, Calendar, CheckSquare, List, Circle,
  FileUp, PenLine, AlignLeft, ToggleLeft, Clock, Star, Image,
  Minus, AlignCenter, SlidersHorizontal, Heading, Table2, Calculator,
  MessageSquare, StickyNote, HelpCircle, Paperclip, BadgeCheck, Eraser,
} from 'lucide-react';
import {
  selectActiveBlock, selectActivePage, selectSelectedFieldId,
  addField, removeField, duplicateField, reorderFields, selectField, deselectField,
  selectPage,
} from '@/features/cro/store/studyFormSlice';
import { selectFieldBucket, clearField } from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import AnnotationModal     from './runtime/AnnotationModal';
import NotesPopover        from './runtime/NotesPopover';
import QueryDrawer         from './runtime/QueryDrawer';
import AttachmentDrawer    from './runtime/AttachmentDrawer';
import VerificationPanel   from './runtime/VerificationPanel';
import ConfirmDialog       from '@/components/feedback/ConfirmDialog';
import { activityLogService } from '@/services/activityLogService';
import { headingStyleToCss } from './headingStyle';
import s from './SFBCanvas.module.css';

const COLLAB_ICONS = [
  { key: 'annotations', Icon: MessageSquare, color: '#06b6d4', title: 'Annotations' },
  { key: 'notes',       Icon: StickyNote,    color: '#f59e0b', title: 'Notes'       },
  { key: 'queries',     Icon: HelpCircle,    color: '#f97316', title: 'Queries'     },
  { key: 'attachments', Icon: Paperclip,     color: '#8b5cf6', title: 'Attachments' },
  { key: 'verification',Icon: BadgeCheck,    color: '#22c55e', title: 'Verification'},
  { key: 'clear',       Icon: Eraser,        color: '#ef4444', title: 'Clear'       },
];

const TYPE_ICON = {
  text: Type, textarea: AlignLeft, number: Hash, email: Mail,
  phone: Phone, date: Calendar, datetime: Calendar, time: Clock,
  select: List, radiogroup: Circle, checkboxgroup: CheckSquare,
  toggle: ToggleLeft, file: FileUp, signature: PenLine,
  rating: Star, slider: SlidersHorizontal, image: Image,
  h2: AlignCenter, h3: Heading, paragraph: AlignLeft, divider: Minus,
  table: Table2, formula: Calculator,
};

export default function SFBCanvas() {
  const dispatch   = useDispatch();
  const block      = useSelector(selectActiveBlock);
  const page       = useSelector(selectActivePage);
  const selFieldId = useSelector(selectSelectedFieldId);

  const containerRef = useRef(null);
  const [dropIndex, setDropIndex]   = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const calcIndex = useCallback((clientY) => {
    if (!containerRef.current) return page?.fields.length ?? 0;
    const items = containerRef.current.querySelectorAll('[data-field-item]');
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return page?.fields.length ?? 0;
  }, [page]);

  const onDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes('sfb-fieldtype')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
    setDropIndex(calcIndex(e.clientY));
  }, [calcIndex]);

  const onDragLeave = useCallback((e) => {
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
      setDropIndex(null);
    }
  }, []);

  const onDrop = useCallback((e) => {
    const ft = e.dataTransfer.getData('sfb-fieldtype');
    if (!ft || !block || !page) return;
    e.preventDefault();
    dispatch(addField({ blockId: block.id, pageId: page.id, fieldType: ft, atIndex: calcIndex(e.clientY) }));
    setIsDragOver(false);
    setDropIndex(null);
  }, [block, page, calcIndex, dispatch]);

  if (!block || !page) {
    return (
      <div className={s.empty}>
        <p className={s.emptyText}>Select a page from the left panel to start building.</p>
      </div>
    );
  }

  return (
    <div className={s.outer} onClick={() => dispatch(deselectField())}>
      {/* Breadcrumb */}
      <div className={s.breadcrumb}>
        <span className={s.bcBlock}>{block.title}</span>
        <span className={s.bcSep}>/</span>
        <span className={s.bcPage}>{page.title}</span>
        {/* Page tabs */}
        <div className={s.pageTabs}>
          {block.pages.map((pg) => (
            <button
              key={pg.id}
              className={`${s.pageTab} ${pg.id === page.id ? s.pageTabActive : ''}`}
              onClick={(e) => { e.stopPropagation(); dispatch(selectPage({ blockId: block.id, pageId: pg.id })); }}
            >
              {pg.title}
              <span className={s.pageTabCount}>{pg.fields.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div className={s.inner}>
        <div
          ref={containerRef}
          className={`${s.canvas} ${isDragOver ? s.canvasDragOver : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {page.fields.length === 0 && !isDragOver && (
            <div className={s.emptyCanvas}>
              <div className={s.emptyCanvasIcon}>+</div>
              <p className={s.emptyCanvasTitle}>Drop fields here</p>
              <p className={s.emptyCanvasSub}>Drag field types from the left panel</p>
            </div>
          )}

          {page.fields.map((fld, idx) => (
            <div key={fld.id} data-field-item>
              {dropIndex === idx && <DropLine />}
              <FieldCard
                fld={fld}
                idx={idx}
                blockId={block.id}
                pageId={page.id}
                selected={selFieldId === fld.id}
              />
            </div>
          ))}
          {dropIndex !== null && dropIndex >= page.fields.length && <DropLine />}
        </div>
      </div>
    </div>
  );
}

function DropLine() {
  return (
    <div className={s.dropLine}>
      <span className={s.dropDot} />
      <span className={s.dropDash} />
      <span className={s.dropDot} />
    </div>
  );
}

/* ── Field Card ────────────────────────────────────────────────────────── */
function FieldCard({ fld, idx, blockId, pageId, selected }) {
  const dispatch = useDispatch();
  const Icon     = TYPE_ICON[fld.type] ?? Type;
  const isLayout = ['h2', 'h3', 'paragraph', 'divider'].includes(fld.type);
  const collab   = fld.collaboration ?? {};

  // Live counts pulled from the runtime collaboration store so the icon
  // shows e.g. "💬 3" when 3 annotations exist on this field.
  const bucket = useSelector(selectFieldBucket(fld.id));
  const user   = useSelector(selectCurrentUser);
  const me     = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  // Counts mapped to each enabled icon. clear/verification render no count.
  const COUNT_BY_KEY = {
    annotations:  bucket.annotations.filter((a) => !a.resolved).length,
    notes:        bucket.notes.length,
    queries:      bucket.queries.filter((q) => q.status !== 'Closed').length,
    attachments:  bucket.attachments.length,
    verification: bucket.verification?.verified ? 1 : 0,
    clear:        0,
  };

  // Which workflow popover is open for this field, anchored to the icon clicked.
  const [active, setActive] = useState(null); // 'annotations' | 'notes' | 'queries' | 'attachments' | 'verification' | null
  const [anchorRect, setAnchorRect] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    dispatch(removeField({ blockId, pageId, fieldId: fld.id }));
    activityLogService.record({
      actionType:  'DELETE',
      module:      'Study Form Builder',
      entityType:  'Control',
      entityId:    fld.id,
      entityName:  fld.label || fld.type,
      description: `Deleted ${fld.type} control "${fld.label || fld.id}" from the form canvas.`,
      beforeValue: { type: fld.type, label: fld.label, required: fld.required ?? false },
    });
  };

  const openCollab = (key, e) => {
    e.stopPropagation();
    if (!collab[key]) return;          // only enabled icons open popovers
    if (key === 'clear') {
      dispatch(clearField({ fieldId: fld.id, ...me }));
      return;
    }
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setActive(key);
  };

  const fieldValue = undefined; // no live value at design time

  return (
    <div
      className={`${s.fieldCard} ${selected ? s.fieldCardSelected : ''}`}
      onClick={(e) => { e.stopPropagation(); dispatch(selectField(fld.id)); }}
    >
      {/* Drag handle */}
      <div className={s.fieldHandle} title="Drag to reorder">
        <GripVertical size={14} />
      </div>

      {/* Main body */}
      <div className={s.fieldBody}>

        {/* Top row: label + type badge + collab icons + delete */}
        <div className={s.fieldTopRow}>
          <span className={s.fieldLabel}>
            {fld.label || <span className={s.noLabel}>(no label)</span>}
          </span>
          <span className={s.fieldTypeBadge}>{fld.type}</span>

          {/* Collaboration feature icons */}
          {!isLayout && (
            <div className={s.collabIcons} onClick={(e) => e.stopPropagation()}>
              {COLLAB_ICONS.map(({ key, Icon: CIcon, color, title }) => {
                const enabled = !!collab[key];
                const count   = COUNT_BY_KEY[key] ?? 0;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`${s.collabIcon} ${enabled ? s.collabIconOn : ''}`}
                    title={enabled ? `${title} — click to open` : `${title} (disabled)`}
                    style={enabled ? { color } : {}}
                    disabled={!enabled}
                    onClick={(e) => openCollab(key, e)}
                  >
                    <CIcon size={13} />
                    {enabled && count > 0 && (
                      <span className={s.collabCount}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Delete */}
          <button
            className={`${s.fieldAction} ${s.fieldActionDanger}`}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          >
            <Trash2 size={13} />
          </button>
        </div>

        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Delete control?"
          message={`This will permanently remove the "${fld.label || fld.type}" control. Any data or queries already captured for this control will be inaccessible. This action cannot be undone.`}
          confirmLabel="Delete control"
          variant="danger"
        />

        {/* Field preview */}
        <FieldPreviewRow fld={fld} />

        {/* Options preview */}
        {fld.options && fld.options.length > 0 && (
          <div className={s.optionsPreview}>
            {fld.options.slice(0, 3).map((o) => (
              <span key={o.value} className={s.optionChip}>{o.label}</span>
            ))}
            {fld.options.length > 3 && <span className={s.optionMore}>+{fld.options.length - 3}</span>}
          </div>
        )}
      </div>

      {/* ── Workflow popovers (anchored to the icon, portaled to body) ── */}
      {active === 'annotations' && (
        <AnnotationModal
          fieldId={fld.id}
          fieldLabel={fld.label || fld.id}
          anchorRect={anchorRect}
          onClose={() => setActive(null)}
        />
      )}
      {active === 'notes' && (
        <NotesPopover
          fieldId={fld.id}
          fieldLabel={fld.label || fld.id}
          anchorRect={anchorRect}
          onClose={() => setActive(null)}
        />
      )}
      {active === 'queries' && (
        <QueryDrawer
          fieldId={fld.id}
          fieldLabel={fld.label || fld.id}
          anchorRect={anchorRect}
          onClose={() => setActive(null)}
        />
      )}
      {active === 'attachments' && (
        <AttachmentDrawer
          fieldId={fld.id}
          fieldLabel={fld.label || fld.id}
          anchorRect={anchorRect}
          onClose={() => setActive(null)}
        />
      )}
      {active === 'verification' && (
        <VerificationPanel
          fieldId={fld.id}
          fieldLabel={fld.label || fld.id}
          fieldValue={fieldValue}
          anchorRect={anchorRect}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

/* ── Field preview row (shows what the input will look like) ──────────── */
function FieldPreviewRow({ fld }) {
  switch (fld.type) {
    case 'text': case 'email': case 'phone': case 'number': case 'password': case 'url':
      return <div className={s.previewInput}>{fld.placeholder || `Enter ${fld.type}...`}</div>;
    case 'textarea':
      return <div className={`${s.previewInput} ${s.previewTextarea}`}>{fld.placeholder || 'Enter text...'}</div>;
    case 'date': case 'datetime': case 'time':
      return <div className={s.previewInput}>{fld.type === 'time' ? 'HH:MM' : 'DD/MM/YYYY'}</div>;
    case 'select':
      return (
        <div className={`${s.previewInput} ${s.previewSelect}`}>
          {fld.placeholder || (fld.multiple ? 'Select one or more options…' : 'Select an option…')} ▾
        </div>
      );
    case 'slider': {
      const min  = Number(fld.minValue ?? 0);
      const max  = Number(fld.maxValue ?? 100);
      const step = Number(fld.step    ?? 1);
      return (
        <div className={s.previewInput} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{min}</span>
          <input type="range" min={min} max={max} step={step} disabled style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{max}</span>
        </div>
      );
    }
    case 'h2':
      return <div className={s.previewH2} style={headingStyleToCss(fld)}>{fld.label || 'Section Title'}</div>;
    case 'h3':
      return <div className={s.previewH3} style={headingStyleToCss(fld)}>{fld.label || 'Sub-heading'}</div>;
    case 'paragraph': {
      // Render the rich-text HTML (Quill output stored on fld.content) verbatim
      // so the canvas shows the designed formatting; legacy plain text (no tags)
      // falls back to text. Mirrors RichParagraph in the preview/runtime.
      const para = fld.content || fld.label || '';
      if (!para.trim()) return <div className={s.previewParagraph}>Paragraph text…</div>;
      if (/<[a-z][\s\S]*>/i.test(para)) {
        return <div className={s.previewParagraph} dangerouslySetInnerHTML={{ __html: para }} />;
      }
      return <div className={s.previewParagraph}>{para}</div>;
    }
    case 'divider':
      return <hr className={s.previewDivider} />;
    case 'formula':
      return (
        <div className={s.previewInput} style={{ fontFamily: 'monospace', fontSize: 12, color: fld.expression ? '#0f766e' : '#94a3b8' }}>
          {fld.expression ? `= ${fld.expression}` : '= (no formula yet)'}
        </div>
      );
    case 'table': {
      const cols = (fld.columns || []).filter((c) => !c.hidden);
      return (
        <div className={s.previewInput} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '6px 8px' }}>
          {cols.length === 0
            ? <span style={{ fontSize: 11, color: '#94a3b8' }}>No columns yet</span>
            : cols.map((c) => (
                <span key={c.key} className={s.optionChip}>{c.label || c.fieldKey}</span>
              ))}
        </div>
      );
    }
    default:
      return null;
  }
}
