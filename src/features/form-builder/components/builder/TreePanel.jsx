import { useState, useMemo } from 'react';
import { Search, X, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import useFormStore from '@/store/useFormStore';
import { getFieldInfo } from '@/lib/fieldSchema';

export default function TreePanel() {
  const { elements, selectedId, selectElement, formSettings } = useFormStore();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const filtered = useMemo(() => {
    if (!search.trim()) return elements;
    const q = search.toLowerCase();
    return elements.filter(
      (el) =>
        el.name.toLowerCase().includes(q) ||
        el.type.toLowerCase().includes(q) ||
        (el.label || '').toLowerCase().includes(q),
    );
  }, [elements, search]);

  const toggleCollapse = (id) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div
      className="flex flex-col bg-white border-l border-slate-200 flex-shrink-0 overflow-hidden"
      style={{ width: 220, height: 'calc(100vh - 52px)' }}
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tree"
            className="w-full pl-8 pr-6 py-1.5 text-xs bg-slate-100 border border-transparent rounded-md focus:outline-none focus:bg-white focus:border-slate-300 transition-colors placeholder:text-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {/* MyForm root */}
        {!search.trim() && (
          <div className="flex items-center gap-2 px-3 py-2">
            <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-700">
              {formSettings?.title || 'MyForm'}
            </span>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 px-3">
            {elements.length === 0 ? 'Drag elements to the canvas' : 'No matches'}
          </div>
        ) : (
          filtered.map((el, idx) => (
            <TreeNode
              key={el.id}
              el={el}
              idx={idx}
              depth={!search.trim() ? 1 : 0}
              selectedId={selectedId}
              onSelect={selectElement}
              collapsed={collapsed}
              onToggle={toggleCollapse}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TreeNode({ el, idx, depth, selectedId, onSelect, collapsed, onToggle }) {
  const info = getFieldInfo(el.type);
  const Icon = info.icon;
  const hasChildren = Array.isArray(el.children) && el.children.length > 0;
  const isCollapsed = collapsed[el.id];
  const isSelected = selectedId === el.id;

  return (
    <div>
      <button
        onClick={() => onSelect(el.id)}
        className={`w-full flex items-start gap-2 py-1.5 pr-2 text-left transition-colors ${
          isSelected ? 'bg-[#07bf9b]/10' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {/* Collapse toggle or spacer */}
        <span className="flex-shrink-0 mt-0.5 w-3">
          {hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); onToggle(el.id); }}
              className="text-slate-400 hover:text-slate-600"
            >
              {isCollapsed
                ? <ChevronRight className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />}
            </span>
          ) : null}
        </span>

        {/* Icon */}
        <Icon
          className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
          style={{ color: isSelected ? '#07bf9b' : info.color }}
        />

        {/* Name + type label stacked */}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium truncate leading-tight ${
            isSelected ? 'text-[#07bf9b]' : 'text-slate-700'
          }`}>
            {el.name}
          </p>
          <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
            {info.label}
          </p>
        </div>
      </button>

      {/* Children */}
      {hasChildren && !isCollapsed &&
        el.children.map((child, cidx) => (
          <TreeNode
            key={child.id}
            el={child}
            idx={cidx}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            collapsed={collapsed}
            onToggle={onToggle}
          />
        ))
      }
    </div>
  );
}
