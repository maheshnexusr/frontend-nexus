/**
 * FormulaBuilder — no-code editor for the Formula (calculated) field type.
 *
 * Rendered by SFBRight's FieldPropsPanel when field.type === 'formula'. Lets a
 * designer compose an expression that references other form fields by their
 * Internal Field Name (fieldKey), with insert panels (fields / operators /
 * functions), a highlighted editor, field-name autocomplete, and a live preview
 * that validates + evaluates the formula against sample values.
 *
 * Persists `expression`, `outputType`, `precision`, and derived `dependencies`
 * back through the standard `up(key, value)` helper.
 */
import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Search, Lock, Check, AlertCircle, Save } from 'lucide-react';
import { selectAllFields, fieldKeyOf } from '@/features/cro/store/studyFormSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import {
  FUNCTIONS, validateFormula, extractDependencies, evaluateExpression, coerceOutput,
} from './formulaEngine';
import { parameterizeExpression } from './formulaTemplates';
import FormulaTemplateMapper from './FormulaTemplateMapper';
import useFormulaTemplates from './useFormulaTemplates';
import s from './SFBRight.module.css';

const OPERATORS = ['+', '-', '*', '/', '(', ')', '==', '!=', '>', '<', '>=', '<=', 'AND', 'OR'];
const RESERVED = new Set([...FUNCTIONS, 'AND', 'OR', 'TRUE', 'FALSE']);

// Token classes for the lightweight syntax-highlight overlay.
const HILITE_RE = /("(?:[^"]*)")|(\b\d+(?:\.\d+)?\b)|(\b(?:IF|SUM|AVG|MIN|MAX|ROUND)\b)|(\b(?:AND|OR|TRUE|FALSE)\b)|(==|!=|>=|<=|[+\-*/()<>,])/g;
const TOKEN_COLOR = { str: '#b45309', num: '#2563eb', func: '#7c3aed', kw: '#0f766e', op: '#64748b' };

export default function FormulaBuilder({ field, up }) {
  const allFields = useSelector(selectAllFields);
  const currentUser = useSelector(selectCurrentUser);
  const { userTemplates, saveTemplate, removeTemplate } = useFormulaTemplates();
  const taRef = useRef(null);
  const [search, setSearch] = useState('');
  const [autocomplete, setAutocomplete] = useState(null); // { items, start, end }

  const expr = field.expression ?? '';

  // Other fields a formula may reference (exclude self + layout fields). Each
  // carries `fk` = its effective reference key (explicit fieldKey, else derived
  // from the label), deduped by that key.
  const refFields = useMemo(() => {
    const seen = new Set();
    return allFields
      .filter((f) => f.id !== field.id && !['h2', 'h3', 'paragraph', 'divider'].includes(f.type))
      .map((f) => ({ ...f, fk: fieldKeyOf(f) }))
      .filter((f) => f.fk && !seen.has(f.fk) && seen.add(f.fk));
  }, [allFields, field.id]);

  const fieldKeys = useMemo(() => new Set(refFields.map((f) => f.fk)), [refFields]);

  // Live validation + preview.
  const result = useMemo(() => {
    const v = validateFormula(expr, { fieldKeys });
    if (!v.valid) return { valid: false, error: v.error };
    // Sample scope: 1 for each dependency (or a small distinct value) so the
    // preview shows a representative computed result.
    const scope = {};
    v.dependencies.forEach((d, i) => { scope[d] = i + 1; });
    const { value, error } = evaluateExpression(expr, scope);
    if (error) return { valid: false, error: error.message };
    return { valid: true, value: coerceOutput(value, field.outputType, field.precision), deps: v.dependencies };
  }, [expr, fieldKeys, field.outputType, field.precision]);

  // Persist expression + recomputed dependencies together.
  const setExpr = (next) => {
    up('expression', next);
    up('dependencies', extractDependencies(next).filter((d) => fieldKeys.has(d)));
  };

  // Insert text at the caret, keeping focus + caret position sensible.
  const insertAtCaret = (text, caretBack = 0) => {
    const ta = taRef.current;
    const start = ta ? ta.selectionStart : expr.length;
    const end = ta ? ta.selectionEnd : expr.length;
    const needsSpaceBefore = start > 0 && !/\s$/.test(expr.slice(0, start)) && !/^[)\s]/.test(text);
    const ins = (needsSpaceBefore ? ' ' : '') + text;
    const next = expr.slice(0, start) + ins + expr.slice(end);
    setExpr(next);
    setAutocomplete(null);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      const caret = start + ins.length - caretBack;
      taRef.current.focus();
      taRef.current.setSelectionRange(caret, caret);
    });
  };

  // Field-name autocomplete: when the caret sits inside an identifier, offer
  // matching fieldKeys.
  const onEditorChange = (e) => {
    const val = e.target.value;
    setExpr(val);
    const caret = e.target.selectionStart;
    const before = val.slice(0, caret);
    const m = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    if (m && m[0].length >= 1) {
      const frag = m[0].toLowerCase();
      const items = refFields
        .filter((f) => f.fk.toLowerCase().includes(frag) && f.fk.toLowerCase() !== frag)
        .slice(0, 6);
      setAutocomplete(items.length ? { items, start: caret - m[0].length, end: caret } : null);
    } else setAutocomplete(null);
  };

  const applyAutocomplete = (key) => {
    const { start, end } = autocomplete;
    const next = expr.slice(0, start) + key + expr.slice(end);
    setExpr(next);
    setAutocomplete(null);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      const caret = start + key.length;
      taRef.current.focus();
      taRef.current.setSelectionRange(caret, caret);
    });
  };

  const filteredFields = refFields.filter((f) =>
    !search.trim()
    || f.fk.toLowerCase().includes(search.toLowerCase())
    || (f.label || '').toLowerCase().includes(search.toLowerCase()));

  // Formula Source: 'builtin' (pick a library template + map fields) or 'custom'
  // (the full expression builder). New formula fields default to the library.
  const source = field.formulaSource || (field.templateId ? 'builtin' : (field.expression ? 'custom' : 'builtin'));
  const setSource = (next) => {
    up('formulaSource', next);
    if (next === 'custom') up('templateId', '');
  };

  // Save the current custom expression as a reusable template: auto-parameterize
  // its referenced fields into mappable inputs (so it works in other studies).
  const saveAsTemplate = async (name) => {
    const deps = result.deps || extractDependencies(expr).filter((d) => fieldKeys.has(d));
    const keyTypes = {};
    refFields.forEach((f) => { keyTypes[f.fk] = f.type; });
    const { expression, inputs } = parameterizeExpression(expr, deps, keyTypes);
    await saveTemplate({
      name,
      expression,
      inputs,
      outputType: field.outputType ?? 'number',
      precision: field.precision ?? 2,
      createdByName: currentUser?.fullName || currentUser?.email || null,
    });
  };

  return (
    <div className={s.accordionBodyInner}>
      {/* Formula Source */}
      <SFieldLocal label="Formula Source">
        <div className={s.formulaChips}>
          <button type="button" className={s.formulaChip} style={source === 'builtin' ? activeChip : undefined} onClick={() => setSource('builtin')}>Built-in Formula</button>
          <button type="button" className={s.formulaChip} style={source === 'custom' ? activeChip : undefined} onClick={() => setSource('custom')}>Custom Formula</button>
        </div>
      </SFieldLocal>

      <div className={s.condNote} style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '6px 0' }}>
        <Lock size={11} /> Always read-only — end users can’t edit a formula result.
      </div>

      {source === 'builtin' ? (
        <BuiltInFormula
          field={field} up={up} refFields={refFields} fieldKeys={fieldKeys}
          userTemplates={userTemplates} onDeleteTemplate={removeTemplate} currentUserId={currentUser?.id}
        />
      ) : (
        <CustomEditor
          field={field} up={up} expr={expr} result={result} taRef={taRef}
          autocomplete={autocomplete} setAutocomplete={setAutocomplete}
          onEditorChange={onEditorChange} applyAutocomplete={applyAutocomplete}
          insertAtCaret={insertAtCaret} search={search} setSearch={setSearch}
          filteredFields={filteredFields} onSaveTemplate={saveAsTemplate}
        />
      )}
    </div>
  );
}

/* ── Custom expression editor (the original Formula Builder + Save as template) */
function CustomEditor({ field, up, expr, result, taRef, autocomplete, setAutocomplete, onEditorChange, applyAutocomplete, insertAtCaret, search, setSearch, filteredFields, onSaveTemplate }) {
  return (
    <>
      {/* Output settings */}
      <SFieldLocal label="Output Type">
        <select className={s.sselect} value={field.outputType ?? 'number'} onChange={(e) => up('outputType', e.target.value)}>
          <option value="number">Number</option>
          <option value="text">Text</option>
          <option value="boolean">Boolean</option>
        </select>
      </SFieldLocal>
      {(field.outputType ?? 'number') === 'number' && (
        <SFieldLocal label="Decimal Precision">
          <input
            type="number" className={s.sinput} min={0} max={10}
            value={field.precision ?? 2}
            onChange={(e) => up('precision', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </SFieldLocal>
      )}

      {/* Editor */}
      <p className={s.subSectionLabel} style={{ marginTop: 12 }}>Formula Expression</p>
      <div style={{ position: 'relative' }}>
        <pre aria-hidden="true" className={s.formulaHighlight}>{renderHighlighted(expr)}</pre>
        <textarea
          ref={taRef}
          className={s.formulaEditor}
          value={expr}
          spellCheck={false}
          rows={3}
          placeholder={'e.g.  price * quantity'}
          onChange={onEditorChange}
          onBlur={() => setTimeout(() => setAutocomplete(null), 150)}
        />
        {autocomplete && (
          <div className={s.formulaAutocomplete}>
            {autocomplete.items.map((f) => (
              <button key={f.fk} type="button" className={s.formulaAcItem} onMouseDown={(e) => { e.preventDefault(); applyAutocomplete(f.fk); }}>
                <code>{f.fk}</code>
                {f.label && <span className={s.formulaAcLabel}>{f.label}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview / validation */}
      {expr.trim() && (
        result.valid ? (
          <div className={s.formulaOk}>
            <Check size={12} /> Valid · result&nbsp;<strong>{formatPreview(result.value)}</strong>
          </div>
        ) : (
          <div className={s.formulaErr}><AlertCircle size={12} /> {result.error}</div>
        )
      )}

      {/* Operators */}
      <p className={s.subSectionLabel} style={{ marginTop: 12 }}>Operators</p>
      <div className={s.formulaChips}>
        {OPERATORS.map((op) => (
          <button key={op} type="button" className={s.formulaChip} onClick={() => insertAtCaret(op)}>{op}</button>
        ))}
      </div>

      {/* Functions */}
      <p className={s.subSectionLabel} style={{ marginTop: 10 }}>Functions</p>
      <div className={s.formulaChips}>
        {FUNCTIONS.map((fn) => (
          <button key={fn} type="button" className={s.formulaChip} title={FN_HINT[fn]} onClick={() => insertAtCaret(`${fn}()`, 1)}>{fn}()</button>
        ))}
      </div>

      {/* Available fields */}
      <p className={s.subSectionLabel} style={{ marginTop: 10 }}>Available Fields</p>
      <div className={s.msWrap} style={{ marginBottom: 6 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
          <input className={s.sinput} style={{ paddingLeft: 26 }} placeholder="Search fields…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className={s.formulaFieldList}>
        {filteredFields.length === 0 ? (
          <p className={s.hintText} style={{ padding: '4px 2px' }}>No other fields to reference yet.</p>
        ) : filteredFields.map((f) => (
          <button key={f.id} type="button" className={s.formulaFieldItem} onClick={() => insertAtCaret(f.fk)}>
            <code>{f.fk}</code>
            <span className={s.formulaFieldLabel}>{f.label || '(no label)'}</span>
            <span className={s.formulaFieldType}>{f.type}</span>
          </button>
        ))}
      </div>

      <SaveTemplateRow canSave={!!result?.valid} onSave={onSaveTemplate} />
    </>
  );
}

/* Inline "Save as template" — name prompt appears on click; saves when valid. */
function SaveTemplateRow({ canSave, onSave }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await onSave(name.trim()); setDone(true); setOpen(false); setName(''); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <div style={{ marginTop: 12 }}>
        <button type="button" className={s.formulaChip} disabled={!canSave} onClick={() => { setOpen(true); setDone(false); }}>
          <Save size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} /> Save as template
        </button>
        {done && <span className={s.formulaOk} style={{ marginLeft: 8, display: 'inline-flex', padding: '2px 8px' }}><Check size={11} /> Saved</span>}
        {!canSave && <p className={s.hintText} style={{ marginTop: 4 }}>Enter a valid formula to save it as a reusable template.</p>}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        className={s.sinput}
        autoFocus
        placeholder="Template name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
      />
      <button type="button" className={s.formulaChip} style={{ background: '#2563eb', color: '#fff' }} disabled={!name.trim() || busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" className={s.formulaChip} onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

/* ── Built-in template picker (thin wrapper over the shared mapper) ───────── */
function BuiltInFormula({ field, up, refFields, fieldKeys, userTemplates, onDeleteTemplate, currentUserId }) {
  return (
    <FormulaTemplateMapper
      templateId={field.templateId}
      mapping={field.fieldMapping}
      refFields={refFields}
      fieldKeys={fieldKeys}
      userTemplates={userTemplates}
      onDeleteTemplate={onDeleteTemplate}
      currentUserId={currentUserId}
      onApply={(b) => {
        up('templateId', b.templateId);
        up('fieldMapping', b.fieldMapping);
        if (b.outputType != null) up('outputType', b.outputType);
        if (b.precision != null) up('precision', b.precision);
        up('expression', b.expression);
        up('dependencies', b.dependencies || []);
      }}
    />
  );
}

const activeChip = { background: '#2563eb', color: '#fff', borderColor: '#2563eb' };

const FN_HINT = {
  IF: 'IF(condition, trueValue, falseValue)',
  SUM: 'SUM(a, b, …)',
  AVG: 'AVG(a, b, …)',
  MIN: 'MIN(a, b, …)',
  MAX: 'MAX(a, b, …)',
  ROUND: 'ROUND(value, decimals)',
  POWER: 'POWER(base, exponent)',
  DATEDIFF: 'DATEDIFF(later, earlier[, "days"|"months"|"years"])',
  TODAY: 'TODAY() — current date',
};

function formatPreview(v) {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

// Build highlighted spans for the overlay. Keeps the trailing newline so the
// <pre> and <textarea> stay the same height.
function renderHighlighted(text) {
  if (!text) return '';
  const out = [];
  let last = 0; let m; let k = 0;
  HILITE_RE.lastIndex = 0;
  while ((m = HILITE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const cls = m[1] ? 'str' : m[2] ? 'num' : m[3] ? 'func' : m[4] ? 'kw' : 'op';
    out.push(<span key={k++} style={{ color: TOKEN_COLOR[cls] }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* Local primitives (mirror SFBRight, kept self-contained). */
function SFieldLocal({ label, children }) {
  return (
    <div className={s.sfield}>
      <span className={s.sfieldLabel}>{label}</span>
      {children}
    </div>
  );
}
