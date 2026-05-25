/**
 * BuilderNavTree — left nav showing the study's visit/form hierarchy.
 *
 * Each leaf carries a badge whose colour reflects open-query status:
 *   red    → open queries
 *   amber  → answered, awaiting close
 *   green  → resolved
 *   grey   → none
 *
 * The tree data lives in `studyOutline` (placeholder) and can later be wired
 * to a study/visits slice without changing this component's shape.
 */

import { useState } from 'react';
import {
  Search, SlidersHorizontal,
  ChevronRight, ChevronDown,
  FileText, ListCollapse, Star, Pin, Clock,
} from 'lucide-react';
import s from './BuilderLayout.module.css';

const studyOutline = [
  { key: 'v1', label: 'Visit 1 (Screening)', totalOpen: 0, forms: [] },
  { key: 'v2', label: 'Visit 2 (Baseline)',  totalOpen: 1, forms: [] },
  {
    key: 'v3', label: 'Visit 3 (Week 12)', totalOpen: 4, open: true,
    forms: [
      { key: 'demographics', label: 'Demographics',    queries: 'none',     count: 0 },
      {
        key: 'vitals', label: 'Vitals', queries: 'open', count: 2, open: true,
        children: [
          { key: 'bp',     label: 'Blood Pressure',    queries: 'open',     count: 1, selected: true },
          { key: 'hr',     label: 'Heart Rate',        queries: 'none',     count: 0 },
          { key: 'rr',     label: 'Respiratory Rate',  queries: 'none',     count: 0 },
          { key: 'temp',   label: 'Temperature',       queries: 'answered', count: 1 },
          { key: 'height', label: 'Height',            queries: 'none',     count: 0 },
          { key: 'weight', label: 'Weight',            queries: 'none',     count: 0 },
        ],
      },
      {
        key: 'labs', label: 'Labs', queries: 'open', count: 2, open: true,
        children: [
          { key: 'hgb', label: 'Hemoglobin', queries: 'open',     count: 1 },
          { key: 'rbc', label: 'RBC Count',  queries: 'answered', count: 1 },
          { key: 'wbc', label: 'WBC Count',  queries: 'none',     count: 0 },
        ],
      },
      { key: 'ecg',  label: 'ECG',             queries: 'none', count: 0 },
      { key: 'conm', label: 'Con Medications', queries: 'none', count: 0 },
    ],
  },
  { key: 'v4', label: 'Visit 4 (Week 24)', totalOpen: 1, forms: [] },
  { key: 'v5', label: 'Visit 5 (Week 36)', totalOpen: 0, forms: [] },
  { key: 'follow-up', label: 'Follow Up',  totalOpen: 0, forms: [] },
];

const pinned = [
  { key: 'demographics-pin', label: 'Demographics'  },
  { key: 'ae-pin',           label: 'Adverse Events' },
];

const recent = [
  { key: 'recent-labs', label: 'Labs' },
  { key: 'recent-ecg',  label: 'ECG' },
  { key: 'recent-conm', label: 'Con Medications' },
];

function Badge({ count, status }) {
  const cls = status === 'open'     ? s.treeBadgeOpen
            : status === 'answered' ? s.treeBadgeAnswered
            : status === 'resolved' ? s.treeBadgeResolved
            : '';
  return <span className={`${s.treeBadge} ${cls}`}>{count}</span>;
}

function FormNode({ node, depth = 1, selectedKey, onSelect }) {
  const [open, setOpen] = useState(!!node.open);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isSelected  = selectedKey === node.key;

  return (
    <>
      <div
        className={`${s.treeRow} ${isSelected ? s.treeRowSelected : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          if (hasChildren) setOpen((o) => !o);
          onSelect(node.key);
        }}
      >
        <span className={s.treeCaret}>
          {hasChildren
            ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : null}
        </span>
        <FileText size={14} className={s.treeIcon} />
        <span className={s.treeLabel}>{node.label}</span>
        <Badge count={node.count ?? 0} status={node.queries} />
      </div>
      {hasChildren && open && node.children.map((child) => (
        <FormNode
          key={child.key}
          node={child}
          depth={depth + 1}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function VisitNode({ visit, selectedKey, onSelect }) {
  const [open, setOpen] = useState(!!visit.open);
  const hasForms = Array.isArray(visit.forms) && visit.forms.length > 0;

  return (
    <>
      <div
        className={`${s.treeRow} ${visit.open ? s.treeRowActive : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={s.treeCaret}>
          {hasForms
            ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <ChevronRight size={12} />}
        </span>
        <FileText size={14} className={s.treeIcon} />
        <span className={s.treeLabel}>{visit.label}</span>
        <Badge
          count={visit.totalOpen}
          status={visit.totalOpen > 0 ? 'answered' : 'none'}
        />
      </div>
      {open && visit.forms.map((form) => (
        <FormNode
          key={form.key}
          node={form}
          depth={1}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function BuilderNavTree() {
  const [selectedKey, setSelectedKey] = useState('bp');

  return (
    <aside className={s.nav}>
      <div className={s.navHeader}>
        <span className={s.navTitle}>
          <ListCollapse size={16} /> Navigation
        </span>
        <button type="button" className={s.navCollapse} aria-label="Collapse">
          <ChevronRight size={14} />
        </button>
      </div>

      <div className={s.navSearchRow}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search in navigation..."
            className={s.navSearch}
            style={{ paddingLeft: 28 }}
          />
        </div>
        <button type="button" className={s.navFilter} aria-label="Filter">
          <SlidersHorizontal size={13} />
        </button>
      </div>

      <div className={s.navScroll}>
        <div className={s.section}>
          <div className={s.sectionLabel}>
            <Star size={12} fill="#f59e0b" /> Pinned Pages
          </div>
          {pinned.map((p) => (
            <div key={p.key} className={s.pinRow}>
              <span>{p.label}</span>
              <Pin size={13} />
            </div>
          ))}
        </div>

        <div className={s.section}>
          <div className={s.sectionLabel} style={{ color: '#64748b' }}>
            <Clock size={12} /> Recent Pages
          </div>
          {recent.map((r) => (
            <div key={r.key} className={s.pinRow} style={{ paddingLeft: 20 }}>
              <span>{r.label}</span>
            </div>
          ))}
        </div>

        <div className={s.section}>
          {studyOutline.map((visit) => (
            <VisitNode
              key={visit.key}
              visit={visit}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          ))}
        </div>
      </div>

      <div className={s.navFooter}>
        <button type="button" className={s.collapseBtn}>
          <ChevronRight size={12} /> Collapse All
        </button>
      </div>

      <div className={s.legend}>
        <span className={`${s.legendDot} ${s.legendOpen}`}>Open Query</span>
        <span className={`${s.legendDot} ${s.legendAnswered}`}>Answered</span>
        <span className={`${s.legendDot} ${s.legendResolved}`}>Resolved</span>
        <span className={`${s.legendDot} ${s.legendNone}`}>No Query</span>
      </div>
    </aside>
  );
}
