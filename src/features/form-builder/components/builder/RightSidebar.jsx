import { useState, useMemo } from 'react';
import { X, Copy, Trash2, Plus, Minus, Search } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectElements, selectSelectedId, selectFormSettings,
  deselectElement, removeElement, duplicateElement, updateElement,
  selectElement,
} from '@/features/form-builder/store/formSlice';
import { getFieldInfo, OPERATORS } from '@/features/form-builder/lib/fieldSchema';
import s from './RightSidebar.module.css';

export default function RightSidebar() {
  const dispatch   = useDispatch();
  const elements   = useSelector(selectElements);
  const selectedId = useSelector(selectSelectedId);
  const el         = elements.find((e) => e.id === selectedId);

  if (el) {
    return (
      <div className={s.sidebar}>
        <PropertiesPanel
          key={el.id}
          el={el}
          elements={elements}
          onClose={() => dispatch(deselectElement())}
          onDelete={() => { dispatch(removeElement(el.id)); }}
          onDuplicate={() => dispatch(duplicateElement(el.id))}
          onUpdate={(updates) => dispatch(updateElement({ id: el.id, updates }))}
        />
      </div>
    );
  }

  return (
    <div className={s.sidebar}>
      <TreePanel elements={elements} selectedId={selectedId} />
    </div>
  );
}

/* ── Tree Panel ─────────────────────────────────────────── */
function TreePanel({ elements, selectedId }) {
  const dispatch    = useDispatch();
  const formSettings = useSelector(selectFormSettings);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return elements;
    const q = search.toLowerCase();
    return elements.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      (e.label || '').toLowerCase().includes(q)
    );
  }, [elements, search]);

  return (
    <div className={s.treePanel}>
      <div className={s.treeSearch}>
        <span className={s.treeSearchIcon}><Search size={12} /></span>
        <input
          className={s.treeSearchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tree"
        />
        {search && <button className={s.treeSearchClear} onClick={() => setSearch('')}>×</button>}
      </div>
      {!search.trim() && (
        <div className={s.treeRoot}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span>{formSettings?.title || 'MyForm'}</span>
        </div>
      )}
      <div className={s.treeBody}>
        {filtered.length === 0
          ? <div className={s.treeEmpty}>{elements.length === 0 ? 'Drag elements onto the canvas' : 'No matches'}</div>
          : filtered.map((el) => {
              const info = getFieldInfo(el.type);
              return (
                <button
                  key={el.id}
                  className={`${s.treeNode} ${selectedId === el.id ? s.treeNodeSelected : ''}`}
                  onClick={() => dispatch(selectElement(el.id))}
                >
                  <span style={{ fontSize: 10, color: selectedId === el.id ? '#07bf9b' : info.color, flexShrink: 0, marginTop: 1 }}>●</span>
                  <div style={{ minWidth: 0 }}>
                    <div className={s.treeNodeName}>{el.name}</div>
                    <div className={s.treeNodeType}>{info.label}</div>
                  </div>
                </button>
              );
            })}
      </div>
    </div>
  );
}

/* ── Properties Panel ───────────────────────────────────── */
function PropertiesPanel({ el, elements, onClose, onDelete, onDuplicate, onUpdate }) {
  const [tab, setTab] = useState('general');
  const info = getFieldInfo(el.type);

  const isStatic   = ['h1','h2','h3','divider','spacer','button','submit','link','steps'].includes(el.type);
  const isInput    = ['text','number','email','phone','password','url','location','signature'].includes(el.type);
  const hasOptions = ['select','multiselect','checkboxgroup','radiogroup','tags'].includes(el.type);

  const TABS = isStatic
    ? [{ id: 'general', label: 'General' }]
    : [{ id: 'general', label: 'General' }, { id: 'validation', label: 'Validation' }, { id: 'logic', label: 'Logic' }];

  const upV = (k, v) => onUpdate({ validation: { ...el.validation, [k]: v } });
  const upC = (k, v) => onUpdate({ conditions: { ...el.conditions, [k]: v } });
  const upA = (k, v) => onUpdate({ attributes: { ...el.attributes, [k]: v } });

  return (
    <div className={s.propsPanel}>
      {/* Header */}
      <div className={s.propsHeader}>
        <button className={s.closeBtn} onClick={onClose}><X size={15} /></button>
        <div className={s.typeIcon} style={{ background: info.color + '20', color: info.color }}>
          <span style={{ fontSize: 9, fontWeight: 700 }}>{el.type.slice(0,2).toUpperCase()}</span>
        </div>
        <span className={s.propsName}>{el.name}</span>
        <div className={s.propsActions}>
          <button className={s.actionBtn} title="Duplicate" onClick={onDuplicate}><Copy size={13} /></button>
          <button className={`${s.actionBtn} ${s.actionBtnDanger}`} title="Delete" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Tab bar */}
      <div className={s.tabBar}>
        {TABS.map((t) => (
          <button key={t.id} className={`${s.tabBtn} ${tab === t.id ? s.tabBtnActive : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={s.tabContent}>
        {tab === 'general'    && <GeneralTab    el={el} onUpdate={onUpdate} upA={upA} isInput={isInput} hasOptions={hasOptions} isStatic={isStatic} />}
        {tab === 'validation' && <ValidationTab el={el} upV={upV} />}
        {tab === 'logic'      && <LogicTab      el={el} upC={upC} elements={elements} />}
      </div>
    </div>
  );
}

/* ── General Tab ─────────────────────────────────────────── */
function GeneralTab({ el, onUpdate, upA, isInput, hasOptions, isStatic }) {
  const up = (k, v) => onUpdate({ [k]: v });

  return (
    <>
      <Section title="Properties">
        {!['divider','spacer'].includes(el.type) && (
          <Row label="Label">
            <input className={s.input} value={el.label || ''} onChange={(e) => up('label', e.target.value)} placeholder="Label text" />
          </Row>
        )}
        {['h1','h2','h3','paragraph'].includes(el.type) && (
          <Row label="Content" top>
            <textarea className={s.textarea} rows={2} value={el.content || ''} onChange={(e) => up('content', e.target.value)} />
          </Row>
        )}
        {el.type === 'spacer' && (
          <Row label="Height (px)">
            <input className={s.input} type="number" min={4} max={200} value={el.height || 24} onChange={(e) => up('height', Number(e.target.value))} />
          </Row>
        )}
        {['button','submit'].includes(el.type) && (
          <>
            <Row label="Button text"><input className={s.input} value={el.buttonLabel || ''} onChange={(e) => up('buttonLabel', e.target.value)} /></Row>
            <Row label="Variant">
              <Pills
                options={[{label:'Primary',value:'primary'},{label:'Secondary',value:'secondary'},{label:'Danger',value:'danger'}]}
                value={el.buttonVariant || 'primary'}
                onChange={(v) => up('buttonVariant', v)}
              />
            </Row>
          </>
        )}
        {el.type === 'link' && (
          <>
            <Row label="Text"><input className={s.input} value={el.linkText || ''} onChange={(e) => up('linkText', e.target.value)} /></Row>
            <Row label="URL"><input className={s.input} value={el.linkUrl || ''} onChange={(e) => up('linkUrl', e.target.value)} placeholder="https://" /></Row>
          </>
        )}
        {!isStatic && (
          <Row label="Description" top>
            <input className={s.input} value={el.description || ''} onChange={(e) => up('description', e.target.value)} placeholder="Help text" />
          </Row>
        )}
        {!['h1','h2','h3','divider','spacer','checkbox','toggle','steps'].includes(el.type) && (
          <Row label="Placeholder">
            <input className={s.input} value={el.placeholder || ''} onChange={(e) => up('placeholder', e.target.value)} />
          </Row>
        )}
        {el.type === 'checkbox' && (
          <Row label="Text" top>
            <textarea className={s.textarea} rows={2} value={el.text || ''} onChange={(e) => up('text', e.target.value)} />
          </Row>
        )}
        {el.type === 'textarea' && (
          <Row label="Rows">
            <input className={s.input} type="number" min={1} max={20} value={el.rows || 3} onChange={(e) => up('rows', Number(e.target.value))} />
          </Row>
        )}
        {el.type === 'toggle' && (
          <>
            <Row label="On label"><input className={s.input} value={el.trueLabel || 'Yes'} onChange={(e) => up('trueLabel', e.target.value)} /></Row>
            <Row label="Off label"><input className={s.input} value={el.falseLabel || 'No'} onChange={(e) => up('falseLabel', e.target.value)} /></Row>
          </>
        )}
        {isInput && (
          <>
            <Row label="Prefix"><input className={s.input} value={el.decorators?.prefix || ''} onChange={(e) => up('decorators', { ...el.decorators, prefix: e.target.value })} placeholder="e.g. $" /></Row>
            <Row label="Suffix"><input className={s.input} value={el.decorators?.suffix || ''} onChange={(e) => up('decorators', { ...el.decorators, suffix: e.target.value })} placeholder="e.g. .com" /></Row>
          </>
        )}
        {!['h1','h2','h3','divider','spacer'].includes(el.type) && (
          <Row label="Disabled"><Toggle value={el.attributes?.disabled || false} onChange={(v) => upA('disabled', v)} /></Row>
        )}
        {isInput && (
          <Row label="Readonly"><Toggle value={el.attributes?.readonly || false} onChange={(v) => upA('readonly', v)} /></Row>
        )}
      </Section>

      {hasOptions && (
        <Section title="Options" defaultOpen>
          <OptionsEditor options={el.options || []} onChange={(opts) => onUpdate({ options: opts })} />
        </Section>
      )}
    </>
  );
}

/* ── Validation Tab ──────────────────────────────────────── */
function ValidationTab({ el, upV }) {
  return (
    <Section title="Rules" defaultOpen>
      <Row label="Required"><Toggle value={el.validation?.required || false} onChange={(v) => upV('required', v)} /></Row>
      {['text','textarea','email','password','url','phone','location'].includes(el.type) && (
        <>
          <Row label="Min length"><input className={s.input} type="number" value={el.validation?.minLength || ''} onChange={(e) => upV('minLength', e.target.value)} /></Row>
          <Row label="Max length"><input className={s.input} type="number" value={el.validation?.maxLength || ''} onChange={(e) => upV('maxLength', e.target.value)} /></Row>
          <Row label="Pattern"><input className={s.input} value={el.validation?.pattern || ''} onChange={(e) => upV('pattern', e.target.value)} placeholder="Regex" /></Row>
        </>
      )}
      {el.type === 'number' && (
        <>
          <Row label="Min value"><input className={s.input} type="number" value={el.validation?.min || ''} onChange={(e) => upV('min', e.target.value)} /></Row>
          <Row label="Max value"><input className={s.input} type="number" value={el.validation?.max || ''} onChange={(e) => upV('max', e.target.value)} /></Row>
        </>
      )}
      {el.type === 'email' && (
        <Row label="Email format"><Toggle value={el.validation?.email || false} onChange={(v) => upV('email', v)} /></Row>
      )}
    </Section>
  );
}

/* ── Logic Tab ───────────────────────────────────────────── */
function LogicTab({ el, upC, elements }) {
  const conds   = el.conditions || { enabled: false, logic: 'AND', rules: [] };
  const rules   = conds.rules || [];
  const fields  = elements.filter((e) => e.id !== el.id && e.name);

  const addRule = () => upC('rules', [...rules, { field: '', operator: '==', value: '' }]);
  const delRule = (i) => upC('rules', rules.filter((_, j) => j !== i));
  const upRule  = (i, k, v) => upC('rules', rules.map((r, j) => j === i ? { ...r, [k]: v } : r));

  return (
    <Section title="Conditions" defaultOpen>
      <Row label="Enable"><Toggle value={conds.enabled || false} onChange={(v) => upC('enabled', v)} /></Row>
      {conds.enabled && (
        <>
          <Row label="Logic">
            <Pills options={['AND','OR']} value={conds.logic || 'AND'} onChange={(v) => upC('logic', v)} />
          </Row>
          <div style={{ marginTop: 8 }}>
            {rules.map((rule, i) => (
              <div key={i} className={s.condRule}>
                <select className={s.condSelect} value={rule.field} onChange={(e) => upRule(i, 'field', e.target.value)}>
                  <option value="">Field…</option>
                  {fields.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                <select className={s.condSelect} value={rule.operator} onChange={(e) => upRule(i, 'operator', e.target.value)}>
                  {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {!['empty','not_empty'].includes(rule.operator) && (
                  <input className={s.condInput} value={rule.value} onChange={(e) => upRule(i, 'value', e.target.value)} placeholder="value" />
                )}
                <button className={s.condDel} onClick={() => delRule(i)}><X size={12} /></button>
              </div>
            ))}
            <button className={s.addCondBtn} onClick={addRule}>+ Add condition</button>
          </div>
        </>
      )}
    </Section>
  );
}

/* ── Shared primitives ───────────────────────────────────── */
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={s.section}>
      <button className={s.sectionHeader} onClick={() => setOpen(v => !v)}>
        <span>{title}</span>
        {open ? <Minus size={13} style={{ color: '#94a3b8' }} /> : <Plus size={13} style={{ color: '#94a3b8' }} />}
      </button>
      {open && <div className={s.sectionBody}>{children}</div>}
    </div>
  );
}

function Row({ label, top = false, children }) {
  return (
    <div className={`${s.row} ${top ? s.rowTop : ''}`}>
      <span className={s.rowLabel}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      className={s.toggle}
      style={{ background: value ? '#07bf9b' : '#cbd5e1' }}
      onClick={() => onChange(!value)}
    >
      <span className={s.toggleThumb} style={{ transform: value ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}

function Pills({ options, value, onChange }) {
  return (
    <div className={s.pills}>
      {options.map((opt) => {
        const val = typeof opt === 'object' ? opt.value : opt;
        const lbl = typeof opt === 'object' ? opt.label : opt;
        const active = value === val;
        return (
          <button
            key={val}
            className={`${s.pill} ${active ? s.pillActive : ''}`}
            style={active ? { background: '#07bf9b' } : {}}
            onClick={() => onChange(val)}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  const update = (i, field, v) => onChange(options.map((o, j) => j === i ? { ...o, [field]: v } : o));
  const remove = (i) => onChange(options.filter((_, j) => j !== i));
  const add    = () => {
    const n = options.length + 1;
    onChange([...options, { label: `Option ${n}`, value: `option_${n}` }]);
  };
  return (
    <div>
      {options.map((opt, i) => (
        <div key={i} className={s.optionRow}>
          <input className={s.optionInput} value={opt.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Label" />
          <input className={s.optionInput} value={opt.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="Value" />
          <button className={s.optionDel} onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className={s.addOptBtn} onClick={add}>+ Add option</button>
    </div>
  );
}
