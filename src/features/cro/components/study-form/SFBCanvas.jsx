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
  Minus, AlignCenter,
  MessageSquare, StickyNote, HelpCircle, Paperclip, BadgeCheck, Eraser,
} from 'lucide-react';
import {
  selectActiveBlock, selectActivePage, selectSelectedFieldId,
  addField, removeField, duplicateField, reorderFields, selectField, deselectField,
  selectPage,
} from '@/features/cro/store/studyFormSlice';
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
  rating: Star, image: Image, h2: AlignCenter, paragraph: AlignLeft,
  divider: Minus,
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
  const isLayout = ['h2', 'paragraph', 'divider'].includes(fld.type);
  const collab   = fld.collaboration ?? {};

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
              {COLLAB_ICONS.map(({ key, Icon: CIcon, color, title }) => (
                <span
                  key={key}
                  className={`${s.collabIcon} ${collab[key] ? s.collabIconOn : ''}`}
                  title={title}
                  style={collab[key] ? { color } : {}}
                >
                  <CIcon size={13} />
                </span>
              ))}
            </div>
          )}

          {/* Delete */}
          <button
            className={`${s.fieldAction} ${s.fieldActionDanger}`}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); dispatch(removeField({ blockId, pageId, fieldId: fld.id })); }}
          >
            <Trash2 size={13} />
          </button>
        </div>

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
      return <div className={`${s.previewInput} ${s.previewSelect}`}>{fld.placeholder || 'Select an option…'} ▾</div>;
    case 'h2':
      return <div className={s.previewH2}>{fld.label || 'Section Title'}</div>;
    case 'paragraph':
      return <div className={s.previewParagraph}>{fld.content || fld.label || 'Paragraph text…'}</div>;
    case 'divider':
      return <hr className={s.previewDivider} />;
    default:
      return null;
  }
}
