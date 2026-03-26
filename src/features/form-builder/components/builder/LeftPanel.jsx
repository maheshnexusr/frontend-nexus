import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectElement as selectEl, selectElements, selectSelectedId } from '@/features/form-builder/store/formSlice';
import { FIELD_TABS, getFieldInfo } from '@/features/form-builder/lib/fieldSchema';
import s from './LeftPanel.module.css';

export default function LeftPanel() {
  const dispatch    = useDispatch();
  const elements    = useSelector(selectElements);
  const selectedId  = useSelector(selectSelectedId);
  const [activeTab, setActiveTab] = useState('fields');
  const [search, setSearch]       = useState('');

  const items = useMemo(() => {
    const list = FIELD_TABS[activeTab] || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(f => f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
  }, [activeTab, search]);

  return (
    <div className={s.panel}>
      {/* Search */}
      <div className={s.searchWrap}>
        <span className={s.searchIcon}><Search size={13} /></span>
        <input
          className={s.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search elements"
        />
        {search && <button className={s.searchClear} onClick={() => setSearch('')}>×</button>}
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        {[{ id: 'fields', label: 'Fields' }, { id: 'page', label: 'Page' }].map((t) => (
          <button
            key={t.id}
            className={`${s.tab} ${activeTab === t.id ? s.tabActive : ''}`}
            onClick={() => { setActiveTab(t.id); setSearch(''); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Field list */}
      <div className={s.list}>
        {items.length === 0
          ? <div className={s.empty}>No elements found</div>
          : items.map((field) => <DraggableItem key={field.type} field={field} />)}
      </div>

      {/* Mini tree */}
      {elements.length > 0 && (
        <TreeMini
          elements={elements}
          selectedId={selectedId}
          onSelect={(id) => dispatch(selectEl(id))}
        />
      )}
    </div>
  );
}

function DraggableItem({ field }) {
  const [dragging, setDragging] = useState(false);

  const onDragStart = (e) => {
    e.dataTransfer.setData('fieldtype', field.type);
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
    const ghost = document.createElement('div');
    ghost.style.cssText = `position:fixed;top:-200px;left:-200px;background:#fff;border:1.5px solid ${field.color};border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;color:#1e293b;box-shadow:0 4px 12px rgba(0,0,0,.15);pointer-events:none;`;
    ghost.textContent = field.label;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 16);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={() => setDragging(false)}
      className={`${s.item} ${dragging ? s.itemDragging : ''}`}
    >
      <div className={s.iconBox} style={{ backgroundColor: field.color + '18' }}>
        <FieldIcon name={field.icon} color={field.color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className={s.itemLabel}>{field.label}</div>
        <div className={s.itemDesc}>{field.description}</div>
      </div>
    </div>
  );
}

function TreeMini({ elements, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.tree}>
      <button className={s.treeHeader} onClick={() => setOpen(v => !v)}>
        <span>TREE ({elements.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={s.treeBody}>
          {elements.map((el, idx) => {
            const info = getFieldInfo(el.type);
            return (
              <button
                key={el.id}
                className={`${s.treeItem} ${selectedId === el.id ? s.treeItemSelected : ''}`}
                onClick={() => onSelect(el.id)}
              >
                <FieldIcon name={info.icon} color={selectedId === el.id ? '#07bf9b' : info.color} size={11} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{el.name}</span>
                <span className={s.treeItemNum}>{idx + 1}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Minimal inline icon renderer using unicode/SVG shortcuts keyed by name
function FieldIcon({ name, color, size = 14 }) {
  const icons = {
    Type: 'T', AlignLeft: '≡', Bold: 'B', Hash: '#', Mail: '✉', Phone: '☎',
    Lock: '🔒', Globe: '🌐', Pen: '✎', MapPin: '📍', ChevronDown: '▾',
    List: '☰', Tag: '🏷', CheckSquare: '☑', ListChecks: '☑☑', Circle: '◯',
    ToggleLeft: '⊙', Calendar: '📅', CalendarDays: '📅', Clock: '🕐',
    CalendarRange: '📅', Sliders: '⊟', Star: '★', FileUp: '↑', Files: '⇈',
    Image: '🖼', Images: '🖼', Heading1: 'H1', Heading2: 'H2', Heading3: 'H3',
    Minus: '—', MoveVertical: '↕', Square: '□', MousePointer: '↖', Link2: '🔗',
    Layers: '⊞', Database: '⊕',
  };
  const char = icons[name] || '·';
  return (
    <span style={{ fontSize: size, color, lineHeight: 1, fontWeight: 600, fontFamily: 'monospace' }}>
      {char}
    </span>
  );
}
