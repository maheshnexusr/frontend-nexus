/**
 * SFBLeft — Left panel of the Study Form Builder.
 * Two tabs:
 *   Structure — hierarchical tree of Blocks → Pages, click to select active page
 *   Fields    — draggable field palette
 */
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Layers, FileText, Plus, Trash2, ChevronDown, ChevronRight,
  GripVertical, Type, Hash, Mail, Phone, Calendar, CheckSquare,
  List, Circle, FileUp, PenLine, AlignLeft, ToggleLeft, Clock,
  Star, Image, Minus, AlignCenter, LayoutList, Pencil,
} from 'lucide-react';
import {
  selectBlocks, selectSelectedBlockId, selectSelectedPageId,
  addBlock, removeBlock, updateBlock, toggleBlockCollapse,
  addPage, removePage, updatePage, selectPage,
} from '@/features/cro/store/studyFormSlice';
import s from './SFBLeft.module.css';

// ── Field palette definition ──────────────────────────────────────────────
const FIELD_GROUPS = [
  {
    group: 'Text',
    fields: [
      { type: 'text',        label: 'Short Text',    Icon: Type        },
      { type: 'textarea',    label: 'Long Text',     Icon: AlignLeft   },
      { type: 'number',      label: 'Number',        Icon: Hash        },
      { type: 'email',       label: 'Email',         Icon: Mail        },
      { type: 'phone',       label: 'Phone',         Icon: Phone       },
    ],
  },
  {
    group: 'Choice',
    fields: [
      { type: 'select',       label: 'Dropdown',     Icon: List        },
      { type: 'radiogroup',   label: 'Radio Group',  Icon: Circle      },
      { type: 'checkboxgroup',label: 'Checkboxes',   Icon: CheckSquare },
      { type: 'toggle',       label: 'Toggle',       Icon: ToggleLeft  },
    ],
  },
  {
    group: 'Date & Time',
    fields: [
      { type: 'date',         label: 'Date',         Icon: Calendar    },
      { type: 'datetime',     label: 'Date & Time',  Icon: Calendar    },
      { type: 'time',         label: 'Time',         Icon: Clock       },
    ],
  },
  {
    group: 'Other',
    fields: [
      { type: 'file',         label: 'File Upload',  Icon: FileUp      },
      { type: 'signature',    label: 'Signature',    Icon: PenLine     },
      { type: 'rating',       label: 'Rating',       Icon: Star        },
      { type: 'image',        label: 'Image',        Icon: Image       },
    ],
  },
  {
    group: 'Layout',
    fields: [
      { type: 'h2',           label: 'Section Title',Icon: AlignCenter },
      { type: 'paragraph',    label: 'Paragraph',    Icon: AlignLeft   },
      { type: 'divider',      label: 'Divider',      Icon: Minus       },
    ],
  },
];

export default function SFBLeft() {
  const [tab, setTab] = useState('structure');

  return (
    <div className={s.panel}>
      {/* Tab bar */}
      <div className={s.tabs}>
        <button className={`${s.tab} ${tab === 'structure' ? s.tabActive : ''}`} onClick={() => setTab('structure')}>
          <Layers size={13} /> Structure
        </button>
        <button className={`${s.tab} ${tab === 'fields' ? s.tabActive : ''}`} onClick={() => setTab('fields')}>
          <LayoutList size={13} /> Fields
        </button>
      </div>

      <div className={s.body}>
        {tab === 'structure' ? <StructureTree /> : <FieldPalette />}
      </div>
    </div>
  );
}

/* ── Structure Tree ─────────────────────────────────────────────────────── */
function StructureTree() {
  const dispatch        = useDispatch();
  const blocks          = useSelector(selectBlocks);
  const selBlockId      = useSelector(selectSelectedBlockId);
  const selPageId       = useSelector(selectSelectedPageId);

  return (
    <div className={s.tree}>
      <div className={s.treeHeader}>
        <span className={s.treeLabel}>FORM STRUCTURE</span>
        <button
          className={s.addBlockBtn}
          onClick={() => dispatch(addBlock())}
          title="Add Block"
        >
          <Plus size={13} /> Add Block
        </button>
      </div>

      {blocks.length === 0 ? (
        <div className={s.treeEmpty}>
          <p>No blocks yet.</p>
          <button className={s.emptyAddBtn} onClick={() => dispatch(addBlock())}>
            <Plus size={13} /> Add First Block
          </button>
        </div>
      ) : (
        <div className={s.treeList}>
          {blocks.map((blk, bIdx) => (
            <BlockNode
              key={blk.id}
              blk={blk}
              bIdx={bIdx}
              selBlockId={selBlockId}
              selPageId={selPageId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BlockNode({ blk, bIdx, selBlockId, selPageId }) {
  const dispatch  = useDispatch();
  const [renaming, setRenaming] = useState(false);
  const [title,    setTitle]    = useState(blk.title);
  const isActive  = selBlockId === blk.id;

  const commitRename = () => {
    dispatch(updateBlock({ blockId: blk.id, updates: { title: title.trim() || blk.title } }));
    setRenaming(false);
  };

  return (
    <div className={s.blockNode}>
      {/* Block header */}
      <div className={`${s.blockHeader} ${isActive ? s.blockHeaderActive : ''}`}>
        <button
          className={s.collapseBtn}
          onClick={() => dispatch(toggleBlockCollapse(blk.id))}
        >
          {blk.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>

        {renaming ? (
          <input
            className={s.renameInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            autoFocus
          />
        ) : (
          <span
            className={s.blockTitle}
            onDoubleClick={() => { setTitle(blk.title); setRenaming(true); }}
            title="Double-click to rename"
          >
            <Layers size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
            {blk.title}
            <button
              className={s.renameIconBtn}
              title="Rename block"
              onClick={(e) => { e.stopPropagation(); setTitle(blk.title); setRenaming(true); }}
            >
              <Pencil size={10} />
            </button>
          </span>
        )}

        <div className={s.blockActions}>
          <button
            className={s.nodeBtn}
            onClick={() => dispatch(addPage(blk.id))}
            title="Add Page"
          >
            <Plus size={11} />
          </button>
          {bIdx > 0 && (
            <button
              className={`${s.nodeBtn} ${s.nodeBtnDanger}`}
              onClick={() => dispatch(removeBlock(blk.id))}
              title="Delete Block"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Pages */}
      {!blk.collapsed && (
        <div className={s.pagesList}>
          {blk.pages.map((pg, pIdx) => (
            <PageNode
              key={pg.id}
              pg={pg}
              pIdx={pIdx}
              blk={blk}
              selPageId={selPageId}
              selBlockId={selBlockId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageNode({ pg, pIdx, blk, selPageId, selBlockId }) {
  const dispatch    = useDispatch();
  const [renaming,  setRenaming] = useState(false);
  const [title,     setTitle]    = useState(pg.title);
  const isActive    = selPageId === pg.id && selBlockId === blk.id;

  const commitRename = () => {
    dispatch(updatePage({ blockId: blk.id, pageId: pg.id, updates: { title: title.trim() || pg.title } }));
    setRenaming(false);
  };

  return (
    <div
      className={`${s.pageNode} ${isActive ? s.pageNodeActive : ''}`}
      onClick={() => dispatch(selectPage({ blockId: blk.id, pageId: pg.id }))}
    >
      <GripVertical size={11} className={s.grip} />
      <FileText size={12} style={{ color: isActive ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />

      {renaming ? (
        <input
          className={s.renameInputSm}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span
          className={s.pageTitle}
          onDoubleClick={(e) => { e.stopPropagation(); setTitle(pg.title); setRenaming(true); }}
          title="Double-click to rename"
        >
          {pg.title}
          <button
            className={s.renameIconBtn}
            title="Rename page"
            onClick={(e) => { e.stopPropagation(); setTitle(pg.title); setRenaming(true); }}
          >
            <Pencil size={9} />
          </button>
        </span>
      )}

      <span className={s.fieldCount}>{pg.fields.length}</span>

      {blk.pages.length > 1 && (
        <button
          className={`${s.nodeBtn} ${s.nodeBtnSm}`}
          onClick={(e) => { e.stopPropagation(); dispatch(removePage({ blockId: blk.id, pageId: pg.id })); }}
          title="Delete Page"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

/* ── Field Palette ──────────────────────────────────────────────────────── */
function FieldPalette() {
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(FIELD_GROUPS.map((g) => [g.group, true])));

  const toggle = (group) => setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  return (
    <div className={s.palette}>
      <p className={s.paletteHint}>Drag fields onto the canvas</p>
      {FIELD_GROUPS.map((g) => (
        <div key={g.group} className={s.paletteGroup}>
          <button className={s.paletteGroupHeader} onClick={() => toggle(g.group)}>
            <span>{g.group}</span>
            {openGroups[g.group] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {openGroups[g.group] && (
            <div className={s.paletteItems}>
              {g.fields.map((f) => (
                <DraggableField key={f.type} {...f} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DraggableField({ type, label, Icon }) {
  const [dragging, setDragging] = useState(false);

  const onDragStart = (e) => {
    e.dataTransfer.setData('sfb-fieldtype', type);
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={() => setDragging(false)}
      className={`${s.paletteItem} ${dragging ? s.paletteItemDragging : ''}`}
    >
      <Icon size={13} className={s.paletteItemIcon} />
      <span className={s.paletteItemLabel}>{label}</span>
    </div>
  );
}
