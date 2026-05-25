/**
 * BuilderCanvas — center pane.
 *
 * Mode-aware:
 *   • mode='editor'  → shows drag handles + card action icons (builder UX).
 *   • mode='preview' → renders as a clean data-entry form, no chrome.
 *
 * Wired to formSlice.elements:
 *   • Each element renders as a field row.
 *   • Clicking a row dispatches selectElement(id) — the right panel reacts.
 *
 * When the form has no elements yet, a sample matching the design spec
 * renders so the page is meaningful from the first load.
 */

import { useDispatch, useSelector } from 'react-redux';
import {
  ChevronRight, ChevronUp, Eye, Edit3,
  Copy, Maximize2, MoreVertical, HelpCircle,
  GripVertical, Bookmark, ChevronDown, MessageSquare,
  Heart, Activity, FileText, Pencil,
} from 'lucide-react';
import {
  selectElement, selectElements, selectSelectedId, selectMode, setMode,
} from '@/features/form-builder/store/formSlice';
import s from './BuilderLayout.module.css';

const FALLBACK_FIELDS = [
  {
    id: 'systolic', type: 'number',
    label: 'Systolic Blood Pressure (mmHg)', required: true,
    sub: 'First (top) number of blood pressure reading.',
    value: '150',
    hint: 'Expected Range: 90 - 140 mmHg',
    hasQuery: true,
  },
  {
    id: 'diastolic', type: 'number',
    label: 'Diastolic Blood Pressure (mmHg)', required: true,
    sub: 'Second (bottom) number of blood pressure reading.',
    value: '92',
    hint: 'Expected Range: 60 - 90 mmHg',
  },
  {
    id: 'position', type: 'select',
    label: 'Blood Pressure Position', required: true,
    sub: 'Select the position in which BP was measured.',
    value: 'Sitting',
  },
  {
    id: 'cuff-size', type: 'select',
    label: 'BP Cuff Size', required: false,
    sub: 'Select cuff size used for measurement.',
    value: 'Adult',
  },
];

function adapt(el) {
  return {
    id:       el.id,
    type:     el.type,
    label:    el.label ?? el.name ?? '(Untitled)',
    required: !!el.required,
    sub:      el.helpText || el.description || '',
    value:    el.defaultValue ?? '',
    hint:     el.validationMessage || '',
    hasQuery: !!el.query,
  };
}

function Breadcrumb() {
  const parts = [
    { label: 'Study: CARDIO-STUDY' },
    { label: 'Visit 3 (Week 12)' },
    { label: 'Vitals' },
    { label: 'Blood Pressure' },
    { label: 'Systolic Blood Pressure', current: true },
  ];
  return (
    <nav className={s.crumb}>
      {parts.map((p, i) => (
        <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className={p.current ? s.crumbCurrent : ''}>{p.label}</span>
          {i < parts.length - 1 && <ChevronRight size={12} />}
        </span>
      ))}
    </nav>
  );
}

function FieldRow({ field, selected, onSelect, builder }) {
  return (
    <div
      className={`${s.field} ${field.hasQuery ? s.fieldQueryActive : ''}`}
      onClick={() => onSelect(field.id)}
      style={selected ? { borderColor: '#2563eb', background: '#eff6ff' } : undefined}
    >
      {builder && (
        <span className={s.dragHandle}>
          <GripVertical size={14} />
        </span>
      )}

      <div className={s.fieldBody}>
        <div className={s.fieldLabelRow}>
          <span className={s.fieldLabel}>{field.label}</span>
          {field.required && <span className={s.fieldReq}>*</span>}
          <HelpCircle size={13} className={s.fieldHelp} />
        </div>

        {field.sub && <p className={s.fieldSub}>{field.sub}</p>}

        {field.type === 'select' ? (
          <div className={s.fieldSelect}>
            <span>{field.value || 'Select...'}</span>
            <ChevronDown size={14} color="#94a3b8" />
          </div>
        ) : (
          <input
            type="text"
            className={s.fieldInput}
            defaultValue={field.value}
            readOnly={!builder ? false : true}
          />
        )}

        {field.hint && <p className={s.fieldHint}>{field.hint}</p>}
      </div>

      {field.hasQuery && (
        <div className={s.fieldEnd}>
          <span className={s.fieldQueryPill}>
            <MessageSquare size={11} /> Query
          </span>
          <span className={s.fieldBookmark}>
            <Bookmark size={14} />
          </span>
        </div>
      )}
    </div>
  );
}

export default function BuilderCanvas() {
  const dispatch   = useDispatch();
  const elements   = useSelector(selectElements);
  const selectedId = useSelector(selectSelectedId);
  const mode       = useSelector(selectMode);
  const isBuilder  = mode !== 'preview';

  const fields = elements.length > 0 ? elements.map(adapt) : FALLBACK_FIELDS;
  const activeId = selectedId ?? (fields.find((f) => f.hasQuery)?.id ?? fields[0]?.id ?? null);

  return (
    <section className={s.canvas}>
      <div className={s.canvasHead}>
        <Breadcrumb />
        <div className={s.modeToggle}>
          <button
            type="button"
            className={`${s.modeBtn} ${!isBuilder ? s.modeBtnPrimary : ''}`}
            onClick={() => dispatch(setMode('preview'))}
          >
            <Eye size={14} /> View Mode
          </button>
          <button
            type="button"
            className={`${s.modeBtn} ${isBuilder ? s.modeBtnPrimary : ''}`}
            onClick={() => dispatch(setMode('editor'))}
          >
            <Edit3 size={14} /> Edit Mode
          </button>
        </div>
      </div>

      <div className={s.canvasScroll}>
        {/* Vitals — group card */}
        <div className={s.card}>
          <div className={s.cardHead}>
            <div className={s.cardIcon} style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Heart size={16} />
            </div>
            <div className={s.cardTitleWrap}>
              <div className={s.cardTitle}>Vitals</div>
              <div className={s.cardSub}>Record vital signs and physiological measurements.</div>
            </div>
            <span className={`${s.badge} ${s.badgeCompleted}`}>Completed</span>
            {isBuilder && (
              <div className={s.cardActions}>
                <button type="button" className={s.iconBtn} title="Rename"><Pencil size={13} /></button>
                <button type="button" className={s.iconBtn} title="Duplicate"><Copy size={13} /></button>
                <button type="button" className={s.iconBtn} title="Expand"><Maximize2 size={13} /></button>
                <button type="button" className={s.iconBtn} title="More"><MoreVertical size={13} /></button>
              </div>
            )}
          </div>
        </div>

        {/* Blood Pressure — form section */}
        <div className={s.card}>
          <div className={s.cardHead}>
            <div className={s.cardIcon}>
              <Activity size={16} />
            </div>
            <div className={s.cardTitleWrap}>
              <div className={s.cardTitle}>Blood Pressure</div>
              <div className={s.cardSub}>Measure blood pressure in seated position after resting for 5 minutes.</div>
            </div>
            <span className={`${s.badge} ${s.badgeCompleted}`}>Completed</span>
            {isBuilder && (
              <div className={s.cardActions}>
                <button type="button" className={s.iconBtn}><Pencil size={13} /></button>
                <button type="button" className={s.iconBtn}><Copy size={13} /></button>
              </div>
            )}
            <button type="button" className={s.iconBtn}><ChevronUp size={14} /></button>
          </div>

          <div className={s.cardBody}>
            {fields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                selected={f.id === activeId}
                onSelect={(id) => dispatch(selectElement(id))}
                builder={isBuilder}
              />
            ))}
            {isBuilder && (
              <button type="button" className={s.addFieldBtn}>
                <FileText size={13} /> Add Field
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={s.pager}>
        <button type="button" className={s.pagerBtn}>
          <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Previous Page
        </button>
        <div className={s.pagerInfo}>
          <span>Page</span>
          <input className={s.pagerInput} defaultValue={1} readOnly />
          <span>of 8</span>
        </div>
        <button type="button" className={`${s.pagerBtn} ${s.pagerBtnPrimary}`}>
          Next Page <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
