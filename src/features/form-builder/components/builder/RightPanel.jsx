import { useState } from 'react';
import {
  X, Copy, Trash2, Minus, Plus, ChevronDown, Settings,
  GitBranch, Shield, Code, LayoutGrid,
} from 'lucide-react';
import useFormStore from '@/store/useFormStore';
import { getFieldInfo, OPERATORS, VALIDATION_RULES } from '@/lib/fieldSchema';

/* ═══════════════════════════════════════════════════════════════
   Shared primitives
═══════════════════════════════════════════════════════════════ */

const iCls = 'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-[#07bf9b] focus:ring-1 focus:ring-[#07bf9b]/20 focus:bg-white transition-colors';

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none"
      style={{ backgroundColor: value ? '#07bf9b' : '#cbd5e1' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: value ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

/** Two-column row: label | control */
function Row({ label, children, top = false }) {
  return (
    <div className={`grid gap-3 py-2 border-b border-slate-100 last:border-0 ${top ? 'items-start' : 'items-center'}`}
      style={{ gridTemplateColumns: '110px 1fr' }}>
      <span className="text-sm text-slate-600">{label}</span>
      <div>{children}</div>
    </div>
  );
}

/** Accordion section */
function Section({ title, defaultOpen = true, action = null, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <div className="flex items-center gap-2">
          {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
          {open
            ? <Minus className="w-3.5 h-3.5 text-slate-400" />
            : <Plus  className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

/** Pill button group */
function Pills({ options, value, onChange }) {
  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden">
      {options.map((opt) => {
        const active = (Array.isArray(value) ? value : [value]).includes(opt.value ?? opt);
        const label  = opt.label ?? opt;
        const val    = opt.value ?? opt;
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`flex-1 py-1 text-xs font-medium transition-colors ${
              active ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
            style={active ? { backgroundColor: '#07bf9b' } : {}}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main export
═══════════════════════════════════════════════════════════════ */
export default function RightPanel() {
  const { selectedId, elements, deselectElement, removeElement, duplicateElement, formSettings, updateFormSettings } = useFormStore();
  const [showSettings, setShowSettings] = useState(false);

  const el = elements.find((e) => e.id === selectedId);

  const panelStyle = { width: 300, flexShrink: 0, height: 'calc(100vh - 52px)' };

  /* ── Empty state ──────────────────────────────────────── */
  if (!el && !showSettings) {
    return (
      <div className="bg-white border-l border-slate-200 flex flex-col" style={panelStyle}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-500">Properties</span>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-2 py-1 transition-colors"
          >
            <Settings className="w-3 h-3" /> Settings
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <LayoutGrid className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">Select an element on the canvas to edit its properties</p>
        </div>
      </div>
    );
  }

  /* ── Form settings ────────────────────────────────────── */
  if (showSettings) {
    return (
      <div className="bg-white border-l border-slate-200 flex flex-col" style={panelStyle}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800">Form Settings</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {[
            { key: 'title', label: 'Form title' },
            { key: 'description', label: 'Description', multi: true },
            { key: 'submitText', label: 'Submit button text' },
            { key: 'successMessage', label: 'Success message', multi: true },
          ].map(({ key, label, multi }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              {multi ? (
                <textarea className={`${iCls} resize-none`} rows={3} value={formSettings[key] || ''} onChange={(e) => updateFormSettings({ [key]: e.target.value })} />
              ) : (
                <input className={iCls} value={formSettings[key] || ''} onChange={(e) => updateFormSettings({ [key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Element panel ────────────────────────────────────── */
  return (
    <div className="bg-white border-l border-slate-200 flex flex-col overflow-hidden" style={panelStyle}>
      <ElementPanel el={el} onClose={deselectElement} onDelete={() => removeElement(el.id)} onDuplicate={() => duplicateElement(el.id)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Element panel body
═══════════════════════════════════════════════════════════════ */
function ElementPanel({ el, onClose, onDelete, onDuplicate }) {
  const { updateElement } = useFormStore();
  const info = getFieldInfo(el.type);
  const up = (key, val) => updateElement(el.id, { [key]: val });
  const upV = (key, val) => updateElement(el.id, { validation: { ...el.validation, [key]: val } });
  const upC = (key, val) => updateElement(el.id, { conditions: { ...el.conditions, [key]: val } });
  const upA = (key, val) => updateElement(el.id, { attributes: { ...el.attributes, [key]: val } });

  const isInput    = ['text','number','email','phone','password','url','location','signature'].includes(el.type);
  const hasOptions = ['select','multiselect','checkboxgroup','radiogroup','tags'].includes(el.type);
  const isStatic   = ['h1','h2','h3','divider','spacer','button','submit','link','group','steps'].includes(el.type);
  const hasPlaceholder = !['h1','h2','h3','divider','spacer','checkbox','toggle','group','steps'].includes(el.type);

  return (
    <>
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="Close">
          <X className="w-4 h-4" />
        </button>
        <div
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: info.color + '20' }}
        >
          <info.icon className="w-3 h-3" style={{ color: info.color }} />
        </div>
        <span className="text-sm font-mono font-semibold text-slate-800 flex-1 truncate">{el.name}</span>
        <div className="flex items-center gap-0.5">
          <ActionBtn icon={Copy}  title="Duplicate" onClick={onDuplicate} />
          <ActionBtn icon={Trash2} title="Delete"   onClick={onDelete}    danger />
        </div>
      </div>

      {/* ── Scrollable content ───────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Properties */}
        <Section title="Properties">
          {/* Label */}
          {!['divider','spacer'].includes(el.type) && (
            <Row label="Label">
              <input className={iCls} value={el.label || ''} onChange={(e) => up('label', e.target.value)} placeholder="Label text" />
            </Row>
          )}

          {/* Content for static elements */}
          {['h1','h2','h3'].includes(el.type) && (
            <Row label="Content" top>
              <textarea className={`${iCls} resize-none`} rows={2} value={el.content || ''} onChange={(e) => up('content', e.target.value)} />
            </Row>
          )}
          {el.type === 'h1' && (
            <Row label="Level">
              <Pills options={['h1','h2','h3','h4','h5','h6'].map(v => ({ label: v.toUpperCase(), value: v }))} value={el.headingLevel || 'h1'} onChange={(v) => up('headingLevel', v)} />
            </Row>
          )}

          {/* Spacer height */}
          {el.type === 'spacer' && (
            <Row label="Height (px)">
              <input className={iCls} type="number" min={4} max={200} value={el.height || 24} onChange={(e) => up('height', Number(e.target.value))} />
            </Row>
          )}

          {/* Button / Submit / Link */}
          {['button','submit'].includes(el.type) && (
            <>
              <Row label="Button text"><input className={iCls} value={el.buttonLabel || ''} onChange={(e) => up('buttonLabel', e.target.value)} /></Row>
              <Row label="Variant">
                <Pills options={[{label:'Primary',value:'primary'},{label:'Secondary',value:'secondary'},{label:'Danger',value:'danger'}]} value={el.buttonVariant || 'primary'} onChange={(v) => up('buttonVariant', v)} />
              </Row>
            </>
          )}
          {el.type === 'link' && (
            <>
              <Row label="Text"><input className={iCls} value={el.linkText || ''} onChange={(e) => up('linkText', e.target.value)} /></Row>
              <Row label="URL"><input className={iCls} value={el.linkUrl || ''} onChange={(e) => up('linkUrl', e.target.value)} placeholder="https://" /></Row>
            </>
          )}

          {/* Standard field properties */}
          {!isStatic && (
            <Row label="Description" top>
              <input className={iCls} value={el.description || ''} onChange={(e) => up('description', e.target.value)} placeholder="Help text" />
            </Row>
          )}
          {hasPlaceholder && (
            <Row label="Placeholder">
              <input className={iCls} value={el.placeholder || ''} onChange={(e) => up('placeholder', e.target.value)} />
            </Row>
          )}
          {/* Checkbox text */}
          {el.type === 'checkbox' && (
            <Row label="Checkbox text" top>
              <textarea className={`${iCls} resize-none`} rows={2} value={el.text || ''} onChange={(e) => up('text', e.target.value)} />
            </Row>
          )}
          {/* Textarea rows */}
          {el.type === 'textarea' && (
            <Row label="Rows">
              <input className={iCls} type="number" min={1} max={20} value={el.rows || 3} onChange={(e) => up('rows', Number(e.target.value))} />
            </Row>
          )}
          {/* Toggle labels */}
          {el.type === 'toggle' && (
            <>
              <Row label="On label"><input className={iCls} value={el.trueLabel || 'Yes'} onChange={(e) => up('trueLabel', e.target.value)} /></Row>
              <Row label="Off label"><input className={iCls} value={el.falseLabel || 'No'} onChange={(e) => up('falseLabel', e.target.value)} /></Row>
            </>
          )}

          {/* Prefix / Suffix */}
          {isInput && (
            <>
              <Row label="Prefix"><input className={iCls} value={el.decorators?.prefix || ''} onChange={(e) => up('decorators', { ...el.decorators, prefix: e.target.value })} placeholder="e.g. https://" /></Row>
              <Row label="Suffix"><input className={iCls} value={el.decorators?.suffix || ''} onChange={(e) => up('decorators', { ...el.decorators, suffix: e.target.value })} placeholder="e.g. .com" /></Row>
            </>
          )}

          {/* Disabled / Readonly / Use expression value */}
          {!['h1','h2','h3','divider','spacer'].includes(el.type) && (
            <Row label="Disabled"><Toggle value={el.attributes?.disabled || false} onChange={(v) => upA('disabled', v)} /></Row>
          )}
          {isInput && (
            <Row label="Readonly"><Toggle value={el.attributes?.readonly || false} onChange={(v) => upA('readonly', v)} /></Row>
          )}
          {isInput && (
            <Row label="Use expression value"><Toggle value={el.useExpression || false} onChange={(v) => up('useExpression', v)} /></Row>
          )}
        </Section>

        {/* Options (select / radio / checkbox group) */}
        {hasOptions && (
          <Section title="Options">
            <OptionsEditor options={el.options || []} onChange={(opts) => up('options', opts)} />
            {['select','multiselect','tags'].includes(el.type) && (
              <Row label="Searchable">
                <Toggle value={el.searchable || false} onChange={(v) => up('searchable', v)} />
              </Row>
            )}
          </Section>
        )}

        {/* Phone Options: include / exclude countries */}
        {el.type === 'phone' && (
          <Section title="Options">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Include Countries</p>
                <CountryTagInput
                  value={el.includeCountries || []}
                  onChange={(v) => up('includeCountries', v)}
                />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Exclude Countries</p>
                <CountryTagInput
                  value={el.excludeCountries || []}
                  onChange={(v) => up('excludeCountries', v)}
                />
              </div>
            </div>
          </Section>
        )}

        {/* Slider config */}
        {['slider','rangeslider'].includes(el.type) && (
          <Section title="Options">
            <Row label="Min"><input className={iCls} type="number" value={el.min ?? 0}   onChange={(e) => up('min', Number(e.target.value))} /></Row>
            <Row label="Max"><input className={iCls} type="number" value={el.max ?? 100} onChange={(e) => up('max', Number(e.target.value))} /></Row>
            <Row label="Step"><input className={iCls} type="number" min={1} value={el.step ?? 1} onChange={(e) => up('step', Number(e.target.value))} /></Row>
          </Section>
        )}

        {/* File config */}
        {['file','multifile','image','multiimage'].includes(el.type) && (
          <Section title="Options">
            <Row label="Accept"><input className={iCls} value={el.accept || ''} onChange={(e) => up('accept', e.target.value)} placeholder="image/*, .pdf" /></Row>
            <Row label="Max size (MB)"><input className={iCls} type="number" min={1} value={el.maxSize || 5} onChange={(e) => up('maxSize', Number(e.target.value))} /></Row>
            {['multifile','multiimage'].includes(el.type) && (
              <Row label="Max files"><input className={iCls} type="number" min={1} value={el.maxFiles || 10} onChange={(e) => up('maxFiles', Number(e.target.value))} /></Row>
            )}
          </Section>
        )}

        {/* Layout */}
        <Section title="Layout">
          <Row label="Shrink element">
            <Toggle value={el.shrinkElement || false} onChange={(v) => up('shrinkElement', v)} />
          </Row>
          {el.shrinkElement && (
            <Row label="Element size">
              <Pills
                options={[{label:'1/4',value:'1/4'},{label:'1/3',value:'1/3'},{label:'1/2',value:'1/2'}]}
                value={el.elementSize || '1/2'}
                onChange={(v) => up('elementSize', v)}
              />
            </Row>
          )}
          {!isStatic && (
            <Row label="Label position">
              <Pills
                options={[{label:'Left',value:'left'},{label:'Top',value:'top'}]}
                value={el.labelPosition || 'top'}
                onChange={(v) => up('labelPosition', v)}
              />
            </Row>
          )}
          <Row label="Size">
            <Pills
              options={[{label:'Default',value:'default'},{label:'Small',value:'sm'},{label:'Medium',value:'md'},{label:'Large',value:'lg'}]}
              value={el.size || 'default'}
              onChange={(v) => up('size', v)}
            />
          </Row>
          {!isStatic && (
            <Row label="Show label">
              <Toggle value={el.showLabel !== false} onChange={(v) => up('showLabel', v)} />
            </Row>
          )}
        </Section>

        {/* Validation */}
        {!isStatic && (
          <Section title="Validation" defaultOpen={false}>
            <Row label="Required">
              <Toggle value={el.validation?.required || false} onChange={(v) => upV('required', v)} />
            </Row>
            {el.validation?.required && (
              <Row label="Message" top>
                <input className={iCls} value={el.validation?.requiredMessage || ''} onChange={(e) => upV('requiredMessage', e.target.value)} placeholder="This field is required" />
              </Row>
            )}
            {['text','textarea','email','password','url'].includes(el.type) && (
              <>
                <Row label="Min length">
                  <input className={iCls} type="number" min={0} value={el.validation?.minLength || ''} onChange={(e) => upV('minLength', e.target.value)} placeholder="—" />
                </Row>
                <Row label="Max length">
                  <input className={iCls} type="number" min={0} value={el.validation?.maxLength || ''} onChange={(e) => upV('maxLength', e.target.value)} placeholder="—" />
                </Row>
                <Row label="Pattern" top>
                  <input className={iCls} value={el.validation?.pattern || ''} onChange={(e) => upV('pattern', e.target.value)} placeholder="/^[a-z]+$/" />
                </Row>
              </>
            )}
            {['number','slider','rangeslider'].includes(el.type) && (
              <>
                <Row label="Min"><input className={iCls} type="number" value={el.validation?.min || ''} onChange={(e) => upV('min', e.target.value)} placeholder="—" /></Row>
                <Row label="Max"><input className={iCls} type="number" value={el.validation?.max || ''} onChange={(e) => upV('max', e.target.value)} placeholder="—" /></Row>
              </>
            )}
            <Row label="Validate on">
              <Pills options={[{label:'Change',value:'change'},{label:'Blur',value:'blur'},{label:'Submit',value:'submit'}]} value={el.validation?.validateOn || 'submit'} onChange={(v) => upV('validateOn', v)} />
            </Row>
            <CustomRules rules={el.validation?.rules || []} onChange={(rules) => upV('rules', rules)} />
          </Section>
        )}

        {/* Logic (Conditions) */}
        {!isStatic && (
          <LogicSection el={el} upC={upC} />
        )}

        {/* Attributes */}
        <Section title="Attributes" defaultOpen={false}>
          <Row label="Name">
            <input
              className={`${iCls} bg-slate-50 text-slate-400`}
              value={el.name || ''}
              readOnly
            />
          </Row>
          {isInput && (
            <Row label="Autocomplete">
              <input className={iCls} value={el.attributes?.autocomplete || ''} onChange={(e) => upA('autocomplete', e.target.value)} placeholder="off / email / name…" />
            </Row>
          )}
          <Row label="ID">
            <input className={iCls} value={el.attributes?.id || ''} onChange={(e) => upA('id', e.target.value)} placeholder="element-id" />
          </Row>
          <Row label="Class">
            <input className={iCls} value={el.attributes?.class || ''} onChange={(e) => upA('class', e.target.value)} placeholder="my-class" />
          </Row>
          {isInput && (
            <Row label="Autofocus">
              <Toggle value={el.attributes?.autofocus || false} onChange={(v) => upA('autofocus', v)} />
            </Row>
          )}
        </Section>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════ */

function ActionBtn({ icon: Icon, title, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        danger
          ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function OptionsEditor({ options, onChange }) {
  const [newLabel, setNewLabel] = useState('');

  const add = () => {
    const label = newLabel.trim() || `Option ${options.length + 1}`;
    onChange([...options, { label, value: label.toLowerCase().replace(/\s+/g, '_') }]);
    setNewLabel('');
  };

  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5 group">
          <input
            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#07bf9b] bg-white"
            value={opt.label}
            onChange={(e) => onChange(options.map((o, j) => j === i ? { ...o, label: e.target.value } : o))}
            placeholder="Label"
          />
          <input
            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#07bf9b] text-slate-400 bg-white"
            value={opt.value}
            onChange={(e) => onChange(options.map((o, j) => j === i ? { ...o, value: e.target.value } : o))}
            placeholder="Value"
          />
          <button
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            className="p-1 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-1.5 mt-2">
        <input
          className="flex-1 px-2 py-1 text-xs border border-dashed border-slate-200 rounded focus:outline-none focus:border-[#07bf9b] bg-slate-50"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New option…"
        />
        <button
          onClick={add}
          className="px-2.5 py-1 text-xs text-white rounded transition-colors"
          style={{ backgroundColor: '#07bf9b' }}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function CustomRules({ rules, onChange }) {
  const [sel, setSel] = useState('');
  const used = rules.map((r) => r.rule);
  const available = VALIDATION_RULES.filter((r) => !used.includes(r.value));

  const NEEDS_VAL = ['min','max','min_length','max_length','regex','same','different','before','after','in_list','not_in_list'];

  return (
    <div className="mt-2 space-y-1.5">
      {rules.map((rule, i) => {
        const info = VALIDATION_RULES.find((r) => r.value === rule.rule);
        const needsVal = NEEDS_VAL.includes(rule.rule);
        return (
          <div key={i} className="flex items-center gap-1.5 group bg-slate-50 rounded px-2 py-1.5">
            <span className="text-xs font-medium text-slate-600 flex-1">{info?.label || rule.rule}</span>
            {needsVal && (
              <input
                className="w-20 px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white focus:outline-none"
                value={rule.value || ''}
                onChange={(e) => onChange(rules.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                placeholder="value"
              />
            )}
            <button onClick={() => onChange(rules.filter((_, j) => j !== i))} className="p-0.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      {available.length > 0 && (
        <div className="flex gap-1.5">
          <select
            className="flex-1 px-2 py-1 text-xs border border-dashed border-slate-200 rounded bg-slate-50 focus:outline-none"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          >
            <option value="">Add rule…</option>
            {available.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button
            onClick={() => { if (sel) { onChange([...rules, { rule: sel, value: '' }]); setSel(''); } }}
            disabled={!sel}
            className="px-2 py-1 text-xs text-white rounded disabled:opacity-40"
            style={{ backgroundColor: '#07bf9b' }}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Logic section (replaces "Conditions") ── */
function LogicSection({ el, upC }) {
  const [editing, setEditing] = useState(false);
  const cond = el.conditions || { enabled: false, logic: 'AND', rules: [] };
  const hasRules = cond.enabled && (cond.rules || []).length > 0;

  return (
    <Section title="Logic">
      {!editing && !hasRules ? (
        <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <span className="text-xs text-slate-500">The element has no conditions</span>
          <button
            onClick={() => { upC('enabled', true); setEditing(true); }}
            className="px-3 py-1 text-xs font-semibold text-white rounded transition-colors flex-shrink-0"
            style={{ backgroundColor: '#07bf9b' }}
          >
            Edit
          </button>
        </div>
      ) : (
        <>
          <ConditionsEditor el={el} upC={upC} />
          {hasRules && (
            <button
              onClick={() => setEditing(false)}
              className="mt-2 text-xs text-slate-400 hover:text-slate-600"
            >
              Collapse
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/* ── Country multiselect dropdown (matches Vueform style) ── */
const COUNTRIES = [
  { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },        { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },       { code: 'FR', name: 'France' },
  { code: 'IN', name: 'India' },         { code: 'CN', name: 'China' },
  { code: 'JP', name: 'Japan' },         { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },        { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },         { code: 'RU', name: 'Russia' },
  { code: 'KR', name: 'South Korea' },   { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },        { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },       { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },        { code: 'TR', name: 'Turkey' },
  { code: 'SA', name: 'Saudi Arabia' },  { code: 'AE', name: 'UAE' },
  { code: 'SG', name: 'Singapore' },     { code: 'HK', name: 'Hong Kong' },
  { code: 'TH', name: 'Thailand' },      { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },   { code: 'VN', name: 'Vietnam' },
];

function CountryTagInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');

  const filtered = COUNTRIES.filter(
    (c) => !value.includes(c.code) &&
      (c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase())),
  );

  const remove = (code) => onChange(value.filter((v) => v !== code));
  const add    = (code) => { onChange([...value, code]); setQ(''); };
  const getName = (code) => COUNTRIES.find((c) => c.code === code)?.name || code;

  return (
    <div className="relative">
      {/* Trigger box — styled like Vueform's gray dropdown */}
      <div
        className="w-full min-h-[34px] px-2.5 py-1.5 border border-slate-200 rounded-md bg-slate-50 flex items-center gap-1 flex-wrap cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        {value.length === 0 ? (
          <span className="text-slate-400 text-xs flex-1" />
        ) : (
          value.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded text-slate-600 shadow-sm">
              {getName(code)}
              <button
                onClick={(e) => { e.stopPropagation(); remove(code); }}
                className="text-slate-300 hover:text-red-400 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto flex-shrink-0" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg">
          <div className="p-1.5 border-b border-slate-100">
            <input
              autoFocus
              className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded outline-none focus:border-[#07bf9b]"
              placeholder="Search countries…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">No results</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  onMouseDown={(e) => { e.preventDefault(); add(c.code); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <span className="text-[10px] font-mono text-slate-400 w-6">{c.code}</span>
                  {c.name}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 p-1.5">
            <button
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConditionsEditor({ el, upC }) {
  const { elements } = useFormStore();
  const cond = el.conditions || { enabled: false, logic: 'AND', rules: [] };
  const rules = cond.rules || [];
  const available = elements.filter((e) => e.id !== el.id);

  const addRule = () => upC('rules', [...rules, { field: available[0]?.name || '', operator: '==', value: '' }]);
  const updateRule = (i, key, val) => upC('rules', rules.map((r, j) => j === i ? { ...r, [key]: val } : r));
  const removeRule = (i) => upC('rules', rules.filter((_, j) => j !== i));

  const NEEDS_VAL = OPERATORS.filter((o) => !['empty','not_empty'].includes(o.value)).map((o) => o.value);

  return (
    <div>
      <Row label="Enabled">
        <Toggle value={cond.enabled || false} onChange={(v) => upC('enabled', v)} />
      </Row>

      {cond.enabled && (
        <>
          <Row label="Logic">
            <Pills options={['AND','OR']} value={cond.logic || 'AND'} onChange={(v) => upC('logic', v)} />
          </Row>

          <div className="mt-3 space-y-2">
            {rules.map((rule, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 border border-slate-200 group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IF</span>
                  <button onClick={() => removeRule(i)} className="p-0.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <select className={`${iCls} text-xs`} value={rule.field} onChange={(e) => updateRule(i, 'field', e.target.value)}>
                  <option value="">Select field…</option>
                  {available.map((f) => <option key={f.id} value={f.name}>{f.label || f.name}</option>)}
                </select>
                <select className={`${iCls} text-xs`} value={rule.operator} onChange={(e) => updateRule(i, 'operator', e.target.value)}>
                  {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {NEEDS_VAL.includes(rule.operator) && (
                  <input className={`${iCls} text-xs`} value={rule.value || ''} onChange={(e) => updateRule(i, 'value', e.target.value)} placeholder="Expected value" />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addRule}
            disabled={available.length === 0}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-dashed rounded-lg transition-colors disabled:opacity-40"
            style={{ borderColor: '#07bf9b', color: '#07bf9b' }}
          >
            <Plus className="w-3.5 h-3.5" /> Add condition
          </button>
          {available.length === 0 && (
            <p className="text-[10px] text-slate-400 text-center mt-1">Add more elements to use as conditions</p>
          )}
        </>
      )}
    </div>
  );
}
