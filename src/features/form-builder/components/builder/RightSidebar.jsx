import { useState, useMemo } from 'react';
import { X, Copy, Trash2, Plus, Minus, Search, HelpCircle, Check } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectElements, selectSelectedId, selectFormSettings,
  deselectElement, removeElement, duplicateElement, updateElement,
  selectElement,
} from '@/features/form-builder/store/formSlice';
import { getFieldInfo, OPERATORS, REGEX_PRESETS } from '@/features/form-builder/lib/fieldSchema';
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
          onDelete={() => {
            // eslint-disable-next-line no-alert
            if (window.confirm(`Delete "${el.label || el.name}"? This removes the field from the form.`)) {
              dispatch(removeElement(el.id));
            }
          }}
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
    : [
        { id: 'general', label: 'General' },
        { id: 'validation', label: 'Validation' },
        { id: 'logic', label: 'Logic' },
        { id: 'clinical', label: 'Clinical' },
      ];

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
        {tab === 'validation' && <ValidationTab el={el} upV={upV} onUpdate={onUpdate} />}
        {tab === 'logic'      && <LogicTab      el={el} upC={upC} elements={elements} />}
        {tab === 'clinical'   && <ClinicalTab   el={el} onUpdate={onUpdate} />}
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
        {!isStatic && (
          <Row label="Field key">
            <input className={s.input} value={el.name || ''} onChange={(e) => up('name', e.target.value)} placeholder="field_key" />
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
        {['text','textarea','number','email','phone','password','url'].includes(el.type) && (
          <Row label="Default value">
            <input className={s.input} value={el.defaultValue || ''} onChange={(e) => up('defaultValue', e.target.value)} placeholder="Default value" />
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
        {!isStatic && (
          <>
            <Row label="Read-only"><Toggle value={el.attributes?.readonly || false} onChange={(v) => upA('readonly', v)} /></Row>
            <Row label="Hidden by default"><Toggle value={el.hiddenByDefault || false} onChange={(v) => up('hiddenByDefault', v)} /></Row>
            <Row label="Help text" top>
              <textarea className={s.textarea} rows={2} value={el.helpText || ''} onChange={(e) => up('helpText', e.target.value)} placeholder="Guidance shown under the field" />
            </Row>
          </>
        )}
      </Section>

      {/* Appearance & Layout — width / alignment / (choice) orientation */}
      {!isStatic && (
        <Section title="Appearance & Layout">
          <Row label="Field width">
            <select className={s.input} value={el.fieldWidth || 'auto'} onChange={(e) => up('fieldWidth', e.target.value)}>
              <option value="auto">Auto</option>
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
            </select>
          </Row>
          <Row label="Alignment">
            <select className={s.input} value={el.alignment || 'left'} onChange={(e) => up('alignment', e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Row>
          {['radiogroup','checkboxgroup'].includes(el.type) && (
            <Row label="Orientation">
              <Pills
                options={[{ label: 'Vertical', value: 'vertical' }, { label: 'Horizontal', value: 'horizontal' }]}
                value={el.orientation || 'vertical'}
                onChange={(v) => up('orientation', v)}
              />
            </Row>
          )}
        </Section>
      )}

      {hasOptions && (
        <Section title="Options" defaultOpen>
          <OptionsEditor options={el.options || []} onChange={(opts) => onUpdate({ options: opts })} />
          {/* Default selection */}
          {el.type === 'radiogroup' && (
            <Row label="Default value" top>
              <select className={s.input} value={el.defaultValue || ''} onChange={(e) => up('defaultValue', e.target.value)}>
                <option value="">— None —</option>
                {(el.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Row>
          )}
          {el.type === 'checkboxgroup' && (
            <div style={{ marginTop: 6 }}>
              <span className={s.rowLabel} style={{ display: 'block', marginBottom: 4 }}>Default selected</span>
              {(el.options || []).map((o) => {
                const sel = Array.isArray(el.defaultValues) ? el.defaultValues : [];
                const on = sel.includes(o.value);
                return (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', padding: '2px 0' }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => up('defaultValues', on ? sel.filter((x) => x !== o.value) : [...sel, o.value])}
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* "Other" option — radio + checkbox groups */}
      {['radiogroup','checkboxgroup'].includes(el.type) && (
        <Section title="Other Option">
          <Row label={'Allow "Other"'}><Toggle value={el.allowOther || false} onChange={(v) => up('allowOther', v)} /></Row>
          {el.allowOther && (
            <>
              <Row label="Other label"><input className={s.input} value={el.otherLabel || 'Other'} onChange={(e) => up('otherLabel', e.target.value)} /></Row>
              <Row label="Free text entry"><Toggle value={el.otherFreeText !== false} onChange={(v) => up('otherFreeText', v)} /></Row>
            </>
          )}
        </Section>
      )}

      {/* Checkbox-group advanced + audit */}
      {el.type === 'checkboxgroup' && (
        <>
          <Section title="Advanced">
            <Row label="Select all option"><Toggle value={el.selectAll || false} onChange={(v) => up('selectAll', v)} /></Row>
            <Row label="Randomize order"><Toggle value={el.randomizeOptions || false} onChange={(v) => up('randomizeOptions', v)} /></Row>
            <Row label="Display option codes"><Toggle value={el.displayCodes || false} onChange={(v) => up('displayCodes', v)} /></Row>
          </Section>
          <Section title="Audit &amp; Compliance">
            <Row label="Capture audit trail"><Toggle value={el.captureAudit !== false} onChange={(v) => up('captureAudit', v)} /></Row>
            <Row label="Track value changes"><Toggle value={el.trackChanges !== false} onChange={(v) => up('trackChanges', v)} /></Row>
          </Section>
        </>
      )}
    </>
  );
}

/* ── Validation Tab ──────────────────────────────────────── */
// Required → Hard check (blocks Save/Submit) / Soft check (warning only, user
// can continue). Each carries an author-defined message ({Field Name} token).
function ValidationTab({ el, upV, onUpdate }) {
  const v = el.validation || {};
  const isText = ['text','textarea','email','password','url','phone','location'].includes(el.type);
  const isCheckboxGroup = el.type === 'checkboxgroup';
  const isChoice = ['radiogroup','checkboxgroup','select','multiselect'].includes(el.type);
  // patternPreset + pattern must change together — one closure-safe update.
  const setPattern = (preset, regex) => onUpdate({ validation: { ...v, patternPreset: preset, pattern: regex } });

  const verb = isChoice ? 'select' : 'enter';

  return (
    <>
      <Section title="Required Field" defaultOpen>
        <Row label="Required"><Toggle value={v.required || false} onChange={(val) => upV('required', val)} /></Row>
        {v.required && (
          <>
            {/* Hard check — default ON. Blocks Save/Submit. */}
            <Row label="Hard check"><Toggle value={v.hardCheck !== false} onChange={(val) => upV('hardCheck', val)} /></Row>
            {v.hardCheck !== false && (
              <Row label="Error message" top>
                <input
                  className={s.input}
                  value={v.hardMessage || ''}
                  onChange={(e) => upV('hardMessage', e.target.value)}
                  placeholder={`{Field Name} is required.`}
                />
              </Row>
            )}
            {/* Soft check — default OFF. Warning only. */}
            <Row label="Soft check"><Toggle value={v.softCheck || false} onChange={(val) => upV('softCheck', val)} /></Row>
            {v.softCheck && (
              <Row label="Warning message" top>
                <input
                  className={s.input}
                  value={v.softMessage || ''}
                  onChange={(e) => upV('softMessage', e.target.value)}
                  placeholder={`Please review {Field Name} before continuing.`}
                />
              </Row>
            )}
            <p className={s.helpNote}>
              Hard check blocks Save/Submit until a value is {verb}ed. Soft check shows a warning
              only — the user can continue. Use <code>{'{Field Name}'}</code> as a placeholder.
            </p>
          </>
        )}
      </Section>

      {isText && (
        <Section title="Format" defaultOpen>
          <Row label="Min length"><NumberStepper value={v.minLength} onChange={(val) => upV('minLength', val)} /></Row>
          <Row label="Max length"><NumberStepper value={v.maxLength} onChange={(val) => upV('maxLength', val)} /></Row>
          <Row label="Pattern" top>
            <PatternPicker preset={v.patternPreset || ''} pattern={v.pattern || ''} onChange={setPattern} />
          </Row>
        </Section>
      )}

      {el.type === 'number' && (
        <Section title="Range" defaultOpen>
          <Row label="Min value"><input className={s.input} type="number" value={v.min || ''} onChange={(e) => upV('min', e.target.value)} /></Row>
          <Row label="Max value"><input className={s.input} type="number" value={v.max || ''} onChange={(e) => upV('max', e.target.value)} /></Row>
        </Section>
      )}

      {isCheckboxGroup && (
        <Section title="Selection Rules" defaultOpen>
          <Row label="Min selections"><NumberStepper value={v.minSelections} onChange={(val) => upV('minSelections', val)} /></Row>
          <Row label="Max selections"><NumberStepper value={v.maxSelections} onChange={(val) => upV('maxSelections', val)} /></Row>
        </Section>
      )}
    </>
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

/* ── Clinical Tab ────────────────────────────────────────── */
// Per-field EDC metadata: which roles may view / edit the field, and whether
// the field participates in SDV / review / queries. Roles are entered by name
// (CRC, CRA, PI, DM…); empty = no restriction. The form runner + backend save
// path enforce these.
function ClinicalTab({ el, onUpdate }) {
  const clinical = el.clinical || {
    viewRoles: [], editRoles: [], sdvEnabled: false, reviewRequired: false, queryEnabled: false,
  };
  const upClin = (k, v) => onUpdate({ clinical: { ...clinical, [k]: v } });
  const toText  = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');
  const toRoles = (txt) => txt.split(',').map((r) => r.trim()).filter(Boolean);

  return (
    <>
      <Section title="Role Access" defaultOpen>
        <Row label="View roles" top>
          <input
            className={s.input}
            value={toText(clinical.viewRoles)}
            onChange={(e) => upClin('viewRoles', toRoles(e.target.value))}
            placeholder="e.g. CRA, DM, PI — empty = all roles"
          />
        </Row>
        <Row label="Edit roles" top>
          <input
            className={s.input}
            value={toText(clinical.editRoles)}
            onChange={(e) => upClin('editRoles', toRoles(e.target.value))}
            placeholder="e.g. CRC — empty = all roles"
          />
        </Row>
      </Section>
      <Section title="Data Management" defaultOpen>
        <Row label="SDV enabled"><Toggle value={clinical.sdvEnabled || false} onChange={(v) => upClin('sdvEnabled', v)} /></Row>
        <Row label="Review required"><Toggle value={clinical.reviewRequired || false} onChange={(v) => upClin('reviewRequired', v)} /></Row>
        <Row label="Query enabled"><Toggle value={clinical.queryEnabled || false} onChange={(v) => upClin('queryEnabled', v)} /></Row>
      </Section>
    </>
  );
}

/* ── Number stepper (increment / decrement) ──────────────── */
function NumberStepper({ value, onChange, min = 0 }) {
  const num = value === '' || value == null ? '' : Number(value);
  const step = (dir) => {
    const cur = num === '' ? (dir > 0 ? min : min) : num;
    const next = Math.max(min, (Number.isFinite(cur) ? cur : min) + dir);
    onChange(String(next));
  };
  return (
    <div className={s.stepper}>
      <button type="button" className={s.stepperBtn} onClick={() => step(-1)} aria-label="Decrease"><Minus size={12} /></button>
      <input
        className={s.stepperInput}
        type="number"
        min={min}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
      <button type="button" className={s.stepperBtn} onClick={() => step(1)} aria-label="Increase"><Plus size={12} /></button>
    </div>
  );
}

/* ── Pattern (Regex) preset picker + ? help popover ──────── */
function PatternPicker({ preset, pattern, onChange }) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          className={s.input}
          style={{ flex: 1 }}
          value={preset}
          onChange={(e) => {
            const p = REGEX_PRESETS.find((r) => r.name === e.target.value);
            onChange(e.target.value, p ? p.regex : (e.target.value === '' ? '' : pattern));
          }}
        >
          <option value="">No pattern</option>
          {Object.entries(
            REGEX_PRESETS.reduce((acc, r) => { (acc[r.category] ??= []).push(r); return acc; }, {}),
          ).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className={s.helpBtn}
          title="Browse / copy regex patterns"
          onClick={() => setHelpOpen(true)}
        >
          <HelpCircle size={14} />
        </button>
      </div>
      {pattern && (
        <input
          className={s.input}
          style={{ fontFamily: 'monospace', fontSize: 11 }}
          value={pattern}
          onChange={(e) => onChange(preset, e.target.value)}
          placeholder="Regular expression"
        />
      )}
      {helpOpen && <RegexHelp onClose={() => setHelpOpen(false)} onInsert={(r) => { onChange(r.name, r.regex); setHelpOpen(false); }} />}
    </div>
  );
}

function RegexHelp({ onClose, onInsert }) {
  const [copied, setCopied] = useState('');
  const [q, setQ] = useState('');
  const list = REGEX_PRESETS.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.category.toLowerCase().includes(q.toLowerCase()),
  );
  const copy = (r) => {
    navigator.clipboard?.writeText(r.regex).catch(() => {});
    setCopied(r.name);
    setTimeout(() => setCopied(''), 1200);
  };
  return (
    <div style={regexOverlay} onClick={onClose}>
      <div style={regexModal} onClick={(e) => e.stopPropagation()}>
        <div style={regexHead}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Pattern Library</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <input className={s.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patterns…" autoFocus />
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto', padding: '0 8px 12px' }}>
          {list.map((r) => (
            <div key={r.name} style={regexRow}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{r.name}</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{r.category}</div>
                <code style={{ fontSize: 11, color: '#2563eb', wordBreak: 'break-all' }}>{r.regex}</code>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>e.g. {r.example}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button type="button" style={regexBtn} onClick={() => copy(r)} title="Copy regex">
                  {copied === r.name ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button type="button" style={{ ...regexBtn, background: '#07bf9b', color: '#fff', borderColor: '#07bf9b' }} onClick={() => onInsert(r)} title="Insert into field">
                  Insert
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const regexOverlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
const regexModal = { width: 'min(520px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' };
const regexHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #e2e8f0' };
const regexRow = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px', borderBottom: '1px solid #f1f5f9' };
const regexBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 6, cursor: 'pointer' };

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
  const move   = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const arr = [...options];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };
  const add    = () => {
    const n = options.length + 1;
    onChange([...options, { label: `Option ${n}`, value: `option_${n}` }]);
  };
  return (
    <div>
      {options.map((opt, i) => (
        <div key={i} className={s.optionRow}>
          <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
            <button type="button" className={s.optionMove} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">▲</button>
            <button type="button" className={s.optionMove} onClick={() => move(i, 1)} disabled={i === options.length - 1} aria-label="Move down">▼</button>
          </span>
          <input className={s.optionInput} value={opt.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Label" />
          <input className={s.optionInput} value={opt.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="Value" />
          <button className={s.optionDel} onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className={s.addOptBtn} onClick={add}>+ Add option</button>
    </div>
  );
}
