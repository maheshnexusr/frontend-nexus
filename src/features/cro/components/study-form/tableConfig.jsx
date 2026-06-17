/**
 * tableConfig — Table/Grid configuration UI for the Study Form Builder right panel.
 *
 *   <TableConfigPanel field up />   row settings, behaviour toggles, density, pagination
 *   <ColumnBuilder    field up />   add / edit / reorder / delete columns
 *
 * Rendered by SFBRight's FieldPropsPanel when field.type === 'table'. Updates flow
 * through the same `up(key, value)` helper used by every other tab, so the whole
 * table config round-trips through form_structure jsonb unchanged.
 */
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Trash2, ChevronDown, ChevronRight, Minus, GripVertical, Check, AlertCircle, Save } from 'lucide-react';
import { makeColumn, toColumnKey, selectAllFields } from '@/features/cro/store/studyFormSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { REGEX_PRESETS } from '@/features/form-builder/lib/fieldSchema';
import { colKey } from '@/components/study-form-runner/tableEngine';
import { FUNCTIONS, validateFormula, extractDependencies } from './formulaEngine';
import { parameterizeExpression } from './formulaTemplates';
import FormulaTemplateMapper from './FormulaTemplateMapper';
import useFormulaTemplates from './useFormulaTemplates';
import s from './SFBRight.module.css';

// Operators offered for a column condition's source field (codes understood by
// runtimeEngine.compareOp). Value-less operators hide the value input.
const COND_OPS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];
const NO_VALUE_OPS = new Set(['is_empty', 'is_not_empty']);
const COND_ACTIONS = [
  { value: 'show', label: 'Show column when…' },
  { value: 'hide', label: 'Hide column when…' },
  { value: 'readonly', label: 'Make read-only when…' },
];

/* Per-row column rules — sibling-column-driven behaviour applied independently
 * to each row (codes understood by tableEngine.evaluateRowColumn / compareOp). */
const ROW_RULE_ACTIONS = [
  { value: 'show',      label: 'Show this column' },
  { value: 'hide',      label: 'Hide this column' },
  { value: 'enable',    label: 'Enable this column' },
  { value: 'disable',   label: 'Disable this column' },
  { value: 'readonly',  label: 'Make read-only' },
  { value: 'editable',  label: 'Make editable' },
  { value: 'require',   label: 'Make required' },
  { value: 'unrequire', label: 'Make optional' },
  { value: 'clear',     label: 'Clear value' },
  { value: 'setvalue',  label: 'Set value' },
];
const ROW_OP_LABELS = {
  equals: 'Equals', not_equals: 'Not equals', contains: 'Contains', does_not_contain: 'Does not contain',
  greater_than: 'Greater than', less_than: 'Less than', gte: '≥', lte: '≤',
  is_empty: 'Is empty', is_not_empty: 'Is not empty', checked: 'Is checked', unchecked: 'Is not checked',
  before: 'Before', after: 'After',
};
const NO_VAL_ROW_OPS = new Set(['is_empty', 'is_not_empty', 'checked', 'unchecked']);
const rowOp = (...keys) => keys.map((k) => ({ value: k, label: ROW_OP_LABELS[k] }));
function opsForColType(type) {
  switch (type) {
    case 'checkbox':    return rowOp('checked', 'unchecked');
    case 'number': case 'currency': case 'rating':
      return rowOp('equals', 'not_equals', 'greater_than', 'less_than', 'gte', 'lte', 'is_empty', 'is_not_empty');
    case 'select': case 'radiogroup': return rowOp('equals', 'not_equals', 'is_empty', 'is_not_empty');
    case 'multiselect': return rowOp('contains', 'does_not_contain', 'is_empty', 'is_not_empty');
    case 'date': case 'datetime': return rowOp('equals', 'before', 'after', 'is_empty', 'is_not_empty');
    default: return rowOp('equals', 'not_equals', 'contains', 'does_not_contain', 'is_empty', 'is_not_empty');
  }
}

/* ── Column type catalogue ──────────────────────────────────────────────── */
export const COLUMN_TYPES = [
  { value: 'text',        label: 'Text' },
  { value: 'textarea',    label: 'Text Area' },
  { value: 'number',      label: 'Number' },
  { value: 'date',        label: 'Date' },
  { value: 'datetime',    label: 'Date Time' },
  { value: 'select',      label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi Select' },
  { value: 'radiogroup',  label: 'Radio Group' },
  { value: 'checkbox',    label: 'Checkbox' },
  { value: 'email',       label: 'Email' },
  { value: 'phone',       label: 'Phone' },
  { value: 'currency',    label: 'Currency' },
  { value: 'url',         label: 'URL' },
  { value: 'file',        label: 'File Upload' },
  { value: 'rating',      label: 'Rating' },
  { value: 'formula',     label: 'Formula / Calculated' },
];

const HAS_OPTIONS = ['select', 'multiselect', 'radiogroup', 'checkbox'];
const IS_TEXT     = ['text', 'textarea', 'email', 'phone', 'url'];
const IS_NUM      = ['number', 'currency', 'rating'];

/* ── Local primitives (mirror SFBRight, kept self-contained) ────────────── */
function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      className={s.toggle}
      style={{ background: value ? 'var(--color-primary, #2563eb)' : '#cbd5e1' }}
      onClick={() => onChange(!value)}
    >
      <span className={s.toggleThumb} style={{ transform: value ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className={s.toggleRow}>
      <span className={s.toggleRowLabel}>{label}</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function SField({ label, children }) {
  return (
    <div className={s.sfield}>
      <span className={s.sfieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder, min }) {
  return (
    <input
      type="number"
      className={s.sinput}
      value={value ?? ''}
      min={min}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      placeholder={placeholder}
    />
  );
}

/* ── Options editor (label/value rows) ──────────────────────────────────── */
function OptionsEditor({ options = [], onChange }) {
  const update = (i, k, v) => onChange(options.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  const remove = (i) => onChange(options.filter((_, j) => j !== i));
  const add    = () => { const n = options.length + 1; onChange([...options, { label: `Option ${n}`, value: `opt_${n}` }]); };
  return (
    <div>
      {options.map((opt, i) => (
        <div key={i} className={s.optRow}>
          <input className={s.optInput} value={opt.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Label" />
          <input className={s.optInput} value={opt.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="Value" />
          <button className={s.optDel} onClick={() => remove(i)} aria-label="Remove option">×</button>
        </div>
      ))}
      <button className={s.addBtn} onClick={add}><Plus size={12} /> Add option</button>
    </div>
  );
}

/* ── Table-level config (behaviour, rows, density, pagination) ──────────── */
export function TableConfigPanel({ field, up }) {
  const rs = field.rowSettings || {};
  const pg = field.pagination  || {};
  const upRS = (k, v) => up('rowSettings', { ...rs, [k]: v });
  const upPG = (k, v) => up('pagination',  { ...pg, [k]: v });

  return (
    <div className={s.accordionBodyInner}>
      <p className={s.subSectionLabel}>Behaviour</p>
      <ToggleRow label="Show table label"  value={field.showLabel !== false}        onChange={(v) => up('showLabel', v)} />
      <ToggleRow label="Allow add row"     value={field.allowAddRow !== false}       onChange={(v) => up('allowAddRow', v)} />
      <ToggleRow label="Allow delete row"  value={field.allowDeleteRow !== false}    onChange={(v) => up('allowDeleteRow', v)} />
      <ToggleRow label="Allow edit row"    value={field.allowEditRow !== false}      onChange={(v) => up('allowEditRow', v)} />
      <ToggleRow label="Allow duplicate row" value={field.allowDuplicateRow !== false} onChange={(v) => up('allowDuplicateRow', v)} />
      <ToggleRow label="Row numbering"     value={field.rowNumbering !== false}      onChange={(v) => up('rowNumbering', v)} />
      <ToggleRow label="Allow empty rows"  value={!!field.allowEmptyRows}            onChange={(v) => up('allowEmptyRows', v)} />

      <p className={s.subSectionLabel} style={{ marginTop: 12 }}>Rows</p>
      <SField label="Minimum rows"><NumInput value={rs.minRows} min={0} onChange={(v) => upRS('minRows', v)} placeholder="0" /></SField>
      <SField label="Maximum rows"><NumInput value={rs.maxRows} min={0} onChange={(v) => upRS('maxRows', v)} placeholder="No limit" /></SField>
      <SField label="Default row count"><NumInput value={rs.defaultRowCount} min={0} onChange={(v) => upRS('defaultRowCount', v)} placeholder="1" /></SField>
      <ToggleRow label="Auto-add empty row" value={!!rs.autoAddEmptyRow} onChange={(v) => upRS('autoAddEmptyRow', v)} />

      <p className={s.subSectionLabel} style={{ marginTop: 12 }}>Display</p>
      <SField label="Density">
        <select className={s.sselect} value={field.density || 'comfortable'} onChange={(e) => up('density', e.target.value)}>
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </SField>
      <ToggleRow label="Paginate large tables" value={!!pg.enabled} onChange={(v) => upPG('enabled', v)} />
      {pg.enabled && (
        <SField label="Rows per page"><NumInput value={pg.pageSize} min={1} onChange={(v) => upPG('pageSize', v)} placeholder="25" /></SField>
      )}
    </div>
  );
}

/* ── Column Builder ─────────────────────────────────────────────────────── */
export function ColumnBuilder({ field, up }) {
  const columns = field.columns || [];
  const [openKey, setOpenKey] = useState(columns[0]?.key ?? null);
  const [dragIdx, setDragIdx] = useState(null);

  const setColumns = (next) => up('columns', next);

  // Heal columns saved with a blank/null fieldKey (older tables) — derive a
  // unique key from the label so cells no longer collide (one input filling the
  // whole row). Runs once per selected table; persists the fix.
  useEffect(() => {
    if (!columns.some((c) => !c.fieldKey)) return;
    const seen = new Set();
    const fixed = columns.map((c) => {
      if (c.fieldKey) { seen.add(c.fieldKey); return c; }
      let k = toColumnKey(c.label) || c.key;
      while (seen.has(k)) k = `${k}_${Math.random().toString(36).slice(2, 5)}`;
      seen.add(k);
      return { ...c, fieldKey: k };
    });
    setColumns(fixed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  const patch = (i, updates) => setColumns(columns.map((c, j) => (j === i ? { ...c, ...updates } : c)));
  const remove = (i) => setColumns(columns.filter((_, j) => j !== i));
  const move = (from, to) => {
    if (to < 0 || to >= columns.length || from === to) return;
    const arr = [...columns];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setColumns(arr);
  };
  const add = () => {
    const next = makeColumn('text', columns.length + 1);
    setColumns([...columns, next]);
    setOpenKey(next.key);
  };

  return (
    <div className={s.accordionBodyInner}>
      {columns.length === 0 && <p className={s.hintText}>No columns yet. Add your first column.</p>}

      {columns.map((col, i) => {
        const open = openKey === col.key;
        return (
          <div
            key={col.key}
            className={s.section}
            onDragOver={(e) => { if (dragIdx != null) e.preventDefault(); }}
            onDrop={() => { if (dragIdx != null) move(dragIdx, i); setDragIdx(null); }}
            style={dragIdx === i ? { opacity: 0.5 } : undefined}
          >
            <div className={s.sectionHeader} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragEnd={() => setDragIdx(null)}
                title="Drag to reorder column"
                style={{ display: 'inline-flex', cursor: 'grab' }}
              >
                <GripVertical size={12} style={{ color: '#cbd5e1' }} />
              </span>
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : col.key)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span style={{ fontWeight: 600 }}>{col.label || 'Untitled column'}</span>
                <span className={s.pill} style={{ marginLeft: 'auto' }}>{COLUMN_TYPES.find((t) => t.value === col.type)?.label || col.type}</span>
              </button>
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} style={moveBtn} aria-label="Move up">▲</button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === columns.length - 1} style={moveBtn} aria-label="Move down">▼</button>
              <button type="button" onClick={() => remove(i)} style={{ ...moveBtn, color: '#dc2626' }} aria-label="Delete column"><Trash2 size={12} /></button>
            </div>

            {open && (
              <div className={s.sectionBody}>
                <ColumnEditor col={col} onPatch={(u) => patch(i, u)} columns={columns} selfId={field.id} />
              </div>
            )}
          </div>
        );
      })}

      <button className={s.addBtn} onClick={add}><Plus size={12} /> Add column</button>
    </div>
  );
}

function ColumnEditor({ col, onPatch, columns, selfId }) {
  const v = col.validation || {};
  const upV = (k, val) => onPatch({ validation: { ...v, [k]: val } });
  const fm = col.formula || {};
  const upFm = (k, val) => onPatch({ formula: { ...fm, [k]: val } });

  const handleLabel = (label) => {
    const u = { label };
    if (!col.fieldKeyManual) u.fieldKey = toColumnKey(label);
    onPatch(u);
  };
  const handleTypeChange = (type) => {
    const u = { type };
    if (HAS_OPTIONS.includes(type) && !col.options) {
      u.options = [{ label: 'Option 1', value: 'opt_1' }, { label: 'Option 2', value: 'opt_2' }];
    }
    if (type === 'formula') u.formula = { ...fm, enabled: true };
    else if (fm.enabled) u.formula = { ...fm, enabled: false };
    onPatch(u);
  };

  return (
    <>
      <SField label="Column label">
        <input className={s.sinput} value={col.label} onChange={(e) => handleLabel(e.target.value)} placeholder="Column" />
      </SField>
      <SField label="Field key">
        <input
          className={s.sinput}
          value={col.fieldKey ?? ''}
          onChange={(e) => onPatch({ fieldKey: e.target.value, fieldKeyManual: true })}
          placeholder="column_key"
        />
      </SField>
      <SField label="Type">
        <select className={s.sselect} value={col.type} onChange={(e) => handleTypeChange(e.target.value)}>
          {COLUMN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </SField>

      {col.type !== 'formula' && (
        <>
          {IS_TEXT.concat('number', 'currency').includes(col.type) && (
            <SField label="Placeholder">
              <input className={s.sinput} value={col.placeholder ?? ''} onChange={(e) => onPatch({ placeholder: e.target.value })} placeholder="Enter value…" />
            </SField>
          )}
          <SField label="Default value">
            <input className={s.sinput} value={col.defaultValue ?? ''} onChange={(e) => onPatch({ defaultValue: e.target.value })} placeholder="Optional" />
          </SField>
        </>
      )}

      <SField label="Column width (px)">
        <NumInput value={col.width} min={60} onChange={(val) => onPatch({ width: val })} placeholder="160" />
      </SField>

      <ToggleRow label="Required"  value={!!col.required} onChange={(val) => onPatch({ required: val })} />
      <ToggleRow label="Read-only" value={!!col.readOnly} onChange={(val) => onPatch({ readOnly: val })} />
      <ToggleRow label="Hidden"    value={!!col.hidden}   onChange={(val) => onPatch({ hidden: val })} />

      {HAS_OPTIONS.includes(col.type) && (
        <>
          <p className={s.subSectionLabel} style={{ marginTop: 8 }}>Options</p>
          <OptionsEditor options={col.options || []} onChange={(options) => onPatch({ options })} />
        </>
      )}

      {col.type === 'formula' ? (
        <FormulaEditor formula={fm} columns={columns} selfKey={colKey(col)} patchFm={(patch) => onPatch({ formula: { ...fm, ...patch } })} />
      ) : (
        <>
          <p className={s.subSectionLabel} style={{ marginTop: 8 }}>Validation</p>
          {IS_TEXT.includes(col.type) && (
            <div className={s.twoColRow}>
              <div className={s.twoColField}><SField label="Min length"><NumInput value={v.minLength} min={0} onChange={(val) => upV('minLength', val)} placeholder="—" /></SField></div>
              <div className={s.twoColField}><SField label="Max length"><NumInput value={v.maxLength} min={0} onChange={(val) => upV('maxLength', val)} placeholder="—" /></SField></div>
            </div>
          )}
          {IS_NUM.includes(col.type) && (
            <div className={s.twoColRow}>
              <div className={s.twoColField}><SField label="Min value"><NumInput value={v.min} onChange={(val) => upV('min', val)} placeholder="—" /></SField></div>
              <div className={s.twoColField}><SField label="Max value"><NumInput value={v.max} onChange={(val) => upV('max', val)} placeholder="—" /></SField></div>
            </div>
          )}
          {IS_TEXT.includes(col.type) && (
            <SField label="Regex pattern">
              <select
                className={s.sselect}
                value={v.patternPreset || ''}
                onChange={(e) => {
                  const preset = REGEX_PRESETS.find((r) => r.name === e.target.value);
                  upV('patternPreset', e.target.value);
                  if (preset) upV('pattern', preset.pattern);
                  else if (!e.target.value) upV('pattern', '');
                }}
              >
                <option value="">No pattern</option>
                {REGEX_PRESETS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
              <input className={s.sinput} style={{ marginTop: 6 }} value={v.pattern ?? ''} onChange={(e) => upV('pattern', e.target.value)} placeholder="Custom regex…" />
            </SField>
          )}
          <ToggleRow label="Unique values" value={!!v.unique} onChange={(val) => upV('unique', val)} />
          <SField label="Custom error message">
            <input className={s.sinput} value={v.customMessage ?? ''} onChange={(e) => upV('customMessage', e.target.value)} placeholder="Shown when this cell is invalid" />
          </SField>
        </>
      )}

      <ColumnConditionEditor condition={col.condition} selfId={selfId} onChange={(condition) => onPatch({ condition })} />

      <ColumnRowRulesEditor columns={columns} selfKey={colKey(col)} rowRules={col.rowRules} onChange={(rowRules) => onPatch({ rowRules })} />
    </>
  );
}

/* ── Per-row column behaviour (sibling-column driven, per-row) ───────────────
 * Each rule targets THIS column and fires per row when its `when` conditions
 * (over SIBLING columns in the same row) are met. Supports the full action set;
 * "Set value" carries a literal. Mirrors tableEngine.evaluateRowColumn. */
function ColumnRowRulesEditor({ columns, selfKey, rowRules, onChange }) {
  const siblings = (columns || []).filter((c) => colKey(c) && colKey(c) !== selfKey);
  const rules = rowRules || [];
  const newWhen = () => ({ col: colKey(siblings[0]) || '', operator: opsForColType(siblings[0]?.type)[0]?.value || 'equals', value: '' });
  const addRule = () => onChange([...rules, { match: 'all', when: [newWhen()], action: 'readonly', setValue: '' }]);
  const updRule = (ri, patch) => onChange(rules.map((r, i) => (i === ri ? { ...r, ...patch } : r)));
  const delRule = (ri) => onChange(rules.filter((_, i) => i !== ri));
  const setWhen = (ri, next) => updRule(ri, { when: next });
  const addWhen = (ri) => setWhen(ri, [...(rules[ri].when || []), newWhen()]);
  const updWhen = (ri, wi, patch) => setWhen(ri, (rules[ri].when || []).map((w, i) => (i === wi ? { ...w, ...patch } : w)));
  const delWhen = (ri, wi) => setWhen(ri, (rules[ri].when || []).filter((_, i) => i !== wi));

  return (
    <>
      <p className={s.subSectionLabel} style={{ marginTop: 8 }}>Row behaviour (same-row columns)</p>
      {siblings.length === 0
        ? <p className={s.hintText}>Add other columns to drive this one within a row.</p>
        : (
          <>
            {rules.map((rule, ri) => {
              const action = rule.action || 'readonly';
              const when = rule.when || [];
              return (
                <div key={ri} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, marginBottom: 8, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Rule {ri + 1}</span>
                    <button type="button" className={s.optDel} onClick={() => delRule(ri)} aria-label="Remove rule">×</button>
                  </div>
                  <SField label="Then this column">
                    <select className={s.sselect} value={action} onChange={(e) => updRule(ri, { action: e.target.value })}>
                      {ROW_RULE_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </SField>
                  {action === 'setvalue' && (
                    <SField label="Value to set">
                      <input className={s.sinput} value={rule.setValue ?? ''} onChange={(e) => updRule(ri, { setValue: e.target.value })} placeholder="Value" />
                    </SField>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={s.sfieldLabel} style={{ margin: 0 }}>When (same row)</span>
                    {when.length > 1 && (
                      <select className={s.sselect} style={{ width: 120 }} value={rule.match || 'all'} onChange={(e) => updRule(ri, { match: e.target.value })}>
                        <option value="all">Match ALL</option>
                        <option value="any">Match ANY</option>
                      </select>
                    )}
                  </div>
                  {when.map((w, wi) => {
                    const src = siblings.find((c) => colKey(c) === w.col);
                    const ops = opsForColType(src?.type);
                    const noVal = NO_VAL_ROW_OPS.has(w.operator);
                    const srcOpts = HAS_OPTIONS.includes(src?.type) ? (src?.options || []) : [];
                    return (
                      <div key={wi} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, background: '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="button" className={s.optDel} onClick={() => delWhen(ri, wi)} aria-label="Remove condition">×</button>
                        </div>
                        <select className={s.sselect} value={w.col || ''}
                          onChange={(e) => { const sc = siblings.find((c) => colKey(c) === e.target.value); updWhen(ri, wi, { col: e.target.value, operator: opsForColType(sc?.type)[0]?.value || 'equals', value: '' }); }}>
                          <option value="">Column…</option>
                          {siblings.map((c) => <option key={c.key} value={colKey(c)}>{c.label || colKey(c)}</option>)}
                        </select>
                        <select className={s.sselect} value={w.operator || 'equals'} onChange={(e) => updWhen(ri, wi, { operator: e.target.value })} disabled={!w.col}>
                          {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {noVal ? null : srcOpts.length ? (
                          <select className={s.sselect} value={w.value ?? ''} onChange={(e) => updWhen(ri, wi, { value: e.target.value })} disabled={!w.col}>
                            <option value="">Value…</option>
                            {srcOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input className={s.sinput} value={w.value ?? ''} onChange={(e) => updWhen(ri, wi, { value: e.target.value })} placeholder="Value" disabled={!w.col} />
                        )}
                      </div>
                    );
                  })}
                  <button className={s.addBtn} type="button" onClick={() => addWhen(ri)}><Plus size={12} /> Add condition</button>
                </div>
              );
            })}
            <button className={s.addBtn} type="button" onClick={addRule}><Plus size={12} /> Add row rule</button>
          </>
        )}
    </>
  );
}

/* ── Column conditional visibility (single-rule, form-field driven) ──────── */
function ColumnConditionEditor({ condition, selfId, onChange }) {
  const allFields = useSelector(selectAllFields);
  const sources = (allFields || []).filter((f) => f.id !== selfId && !['h2', 'h3', 'paragraph', 'divider'].includes(f.type));
  const cond = condition || { enabled: false, action: 'show', match: 'AND', rules: [] };
  const rule = cond.rules?.[0] || {};
  const enabled = !!cond.enabled && (cond.rules?.length > 0);

  const setRule = (patch) => {
    const nextRule = { fieldId: rule.fieldId || '', operator: rule.operator || 'equals', value: rule.value ?? '', ...patch };
    onChange({ enabled: true, action: cond.action || 'show', match: 'AND', rules: [nextRule] });
  };

  return (
    <>
      <p className={s.subSectionLabel} style={{ marginTop: 8 }}>Conditional visibility</p>
      <ToggleRow
        label="Enable condition"
        value={enabled}
        onChange={(on) => onChange(on
          ? { enabled: true, action: cond.action || 'show', match: 'AND', rules: [{ fieldId: rule.fieldId || sources[0]?.id || '', operator: rule.operator || 'equals', value: rule.value ?? '' }] }
          : { enabled: false, action: 'show', match: 'AND', rules: [] })}
      />
      {enabled && (
        <>
          <SField label="Action">
            <select className={s.sselect} value={cond.action || 'show'} onChange={(e) => onChange({ ...cond, action: e.target.value })}>
              {COND_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </SField>
          <SField label="When field">
            <select className={s.sselect} value={rule.fieldId || ''} onChange={(e) => setRule({ fieldId: e.target.value })}>
              <option value="">Select a field…</option>
              {sources.map((f) => <option key={f.id} value={f.id}>{f.label || f.fieldKey || f.id}</option>)}
            </select>
          </SField>
          <SField label="Operator">
            <select className={s.sselect} value={rule.operator || 'equals'} onChange={(e) => setRule({ operator: e.target.value })}>
              {COND_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </SField>
          {!NO_VALUE_OPS.has(rule.operator) && (
            <SField label="Value">
              <input className={s.sinput} value={rule.value ?? ''} onChange={(e) => setRule({ value: e.target.value })} placeholder="Compare value" />
            </SField>
          )}
        </>
      )}
    </>
  );
}

/* ── Formula editor (table column) ──────────────────────────────────────────
 * Two sources: Built-in (pick a library template + map columns) or Custom (type
 * an expression referencing other columns by key). Column formulas use the
 * shared engine (DATEDIFF, IF, ROUND, POWER, SUM, AVG, MIN, MAX) per row. */
function FormulaEditor({ formula, columns, selfKey, patchFm }) {
  const fm = formula || {};
  const expr = fm.expr || '';
  const source = fm.source || (fm.templateId ? 'builtin' : (expr ? 'custom' : 'builtin'));
  const setSource = (next) => patchFm(next === 'custom' ? { source: 'custom', templateId: '' } : { source: 'builtin' });

  const currentUser = useSelector(selectCurrentUser);
  const { userTemplates, saveTemplate, removeTemplate } = useFormulaTemplates();

  // Referenceable columns (exclude self), each carrying fk/label/type for the mapper.
  const availCols = columns.filter((c) => colKey(c) && colKey(c) !== selfKey);
  const refFields = useMemo(
    () => availCols.map((c) => ({ id: c.key, fk: colKey(c), label: c.label, type: c.type })),
    [availCols],
  );
  const colKeys = useMemo(() => new Set(columns.map(colKey).filter(Boolean)), [columns]);
  const insert = (token) => patchFm({ expr: `${expr ? `${expr} ` : ''}${token}` });

  const validity = useMemo(() => {
    if (!expr.trim()) return null;
    return validateFormula(expr.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '$1'), { fieldKeys: colKeys });
  }, [expr, colKeys]);

  const saveAsTemplate = async (name) => {
    const cleanExpr = expr.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '$1');
    const deps = extractDependencies(cleanExpr).filter((d) => colKeys.has(d));
    const keyTypes = {};
    columns.forEach((c) => { keyTypes[colKey(c)] = c.type; });
    const { expression, inputs } = parameterizeExpression(cleanExpr, deps, keyTypes);
    await saveTemplate({ name, expression, inputs, outputType: 'number', precision: 2, createdByName: currentUser?.fullName || currentUser?.email || null });
  };

  return (
    <>
      <SField label="Formula Source">
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className={s.pill} style={source === 'builtin' ? { ...chipBtn, ...activeChip } : chipBtn} onClick={() => setSource('builtin')}>Built-in</button>
          <button type="button" className={s.pill} style={source === 'custom' ? { ...chipBtn, ...activeChip } : chipBtn} onClick={() => setSource('custom')}>Custom</button>
        </div>
      </SField>

      {source === 'builtin' ? (
        <FormulaTemplateMapper
          templateId={fm.templateId}
          mapping={fm.mapping}
          refFields={refFields}
          fieldKeys={colKeys}
          userTemplates={userTemplates}
          onDeleteTemplate={removeTemplate}
          currentUserId={currentUser?.id}
          onApply={(b) => patchFm({ source: 'builtin', templateId: b.templateId, mapping: b.fieldMapping, expr: b.expression })}
        />
      ) : (
        <>
          <p className={s.subSectionLabel} style={{ marginTop: 8 }}>Formula</p>
          <textarea
            className={s.stextarea}
            rows={2}
            value={expr}
            onChange={(e) => patchFm({ source: 'custom', expr: e.target.value })}
            placeholder="e.g.  DATEDIFF(end_date, start_date)"
          />
          {validity && (
            validity.valid
              ? <div className={s.formulaOk} style={{ marginTop: 6 }}><Check size={12} /> Valid</div>
              : <div className={s.formulaErr} style={{ marginTop: 6 }}><AlertCircle size={12} /> {validity.error}</div>
          )}
          <p className={s.subSectionLabel} style={{ marginTop: 8 }}>Available Columns</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {availCols.length === 0
              ? <span className={s.hintText}>Add other columns to reference them.</span>
              : availCols.map((c) => (
                <button key={c.key} type="button" className={s.pill} style={chipBtn} title={colKey(c)} onClick={() => insert(colKey(c))}>
                  {c.label || colKey(c)}
                </button>
              ))}
          </div>
          <p className={s.subSectionLabel} style={{ marginTop: 8 }}>Functions</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {FUNCTIONS.map((fn) => (
              <button key={fn} type="button" className={s.pill} style={chipBtn} onClick={() => insert(`${fn}()`)}>{fn}()</button>
            ))}
            {['+', '-', '*', '/', '(', ')'].map((op) => (
              <button key={op} type="button" className={s.pill} style={chipBtn} onClick={() => insert(op)}>{op}</button>
            ))}
          </div>
          <p className={s.hintText} style={{ marginTop: 6 }}>
            Reference other columns by key (e.g. <code>DATEDIFF(end_date, start_date)</code>). Computed per row, read-only.
          </p>
          <SaveColumnTemplate canSave={!!validity?.valid} onSave={saveAsTemplate} />
        </>
      )}

      <ToggleRow label="Show grand total (footer)" value={!!fm.grandTotal} onChange={(v) => patchFm({ grandTotal: v })} />
    </>
  );
}

/* Inline "Save as template" for a column formula. */
function SaveColumnTemplate({ canSave, onSave }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await onSave(name.trim()); setOpen(false); setName(''); } finally { setBusy(false); }
  };
  if (!open) {
    return (
      <button type="button" className={s.pill} style={{ ...chipBtn, marginTop: 8 }} disabled={!canSave} onClick={() => setOpen(true)}>
        <Save size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} /> Save as template
      </button>
    );
  }
  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
      <input className={s.sinput} autoFocus placeholder="Template name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }} />
      <button type="button" className={s.pill} style={{ ...chipBtn, ...activeChip }} disabled={!name.trim() || busy} onClick={submit}>{busy ? '…' : 'Save'}</button>
      <button type="button" className={s.pill} style={chipBtn} onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

const activeChip = { background: '#2563eb', color: '#fff', borderColor: '#2563eb' };

const moveBtn = { background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8', fontSize: 10, padding: '2px 3px', lineHeight: 1 };
const chipBtn = { cursor: 'pointer', border: '1px solid #e2e8f0', background: '#f8fafc' };
