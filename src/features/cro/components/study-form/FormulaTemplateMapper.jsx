/**
 * FormulaTemplateMapper — shared Built-in Formula picker + field/column mapping.
 *
 * Used by both the field-level FormulaBuilder and the table-column FormulaEditor.
 * Presentational: it renders the template dropdown, the typed input mappers, and
 * the read-only generated expression, then calls `onApply(bundle)` whenever the
 * selection or a mapping changes. The parent persists the bundle however it wants
 * (a field via `up(key,val)`, a column via `onPatch({formula})`).
 *
 * `refFields`: array of { id, fk, label, type } — the fields/columns that can be
 * referenced (each carries `fk` = its reference key).
 */
import {
  FORMULA_TEMPLATES, getTemplate, generateExpression, templateDependencies,
  isMappingComplete, fieldTypeMatches,
} from './formulaTemplates';
import { Check, AlertCircle, Trash2 } from 'lucide-react';
import s from './SFBRight.module.css';

export default function FormulaTemplateMapper({ templateId, mapping = {}, refFields, fieldKeys, onApply, userTemplates = [], onDeleteTemplate, currentUserId }) {
  // Library = built-in registry + the user's saved templates (looked up by id).
  const allTemplates = [...FORMULA_TEMPLATES, ...userTemplates];
  const template = getTemplate(templateId) || userTemplates.find((t) => t.id === templateId) || null;
  const keySet = fieldKeys instanceof Set ? fieldKeys : new Set(refFields.map((f) => f.fk));

  const apply = (tpl, nextMapping) => {
    onApply({
      templateId: tpl.id,
      fieldMapping: nextMapping,
      outputType: tpl.outputType ?? 'number',
      precision: tpl.precision ?? 2,
      expression: generateExpression(tpl, nextMapping),
      dependencies: templateDependencies(tpl, nextMapping).filter((d) => keySet.has(d)),
    });
  };

  const resolve = (id) => allTemplates.find((t) => t.id === id) || null;
  const pickTemplate = (id) => {
    const tpl = resolve(id);
    if (!tpl) { onApply({ templateId: '', fieldMapping: {}, expression: '', dependencies: [] }); return; }
    const seed = {};
    (tpl.inputs || []).forEach((inp) => { if (inp.kind === 'option') seed[inp.key] = inp.default ?? inp.options?.[0]; });
    apply(tpl, seed);
  };
  const setInput = (key, value) => apply(template, { ...mapping, [key]: value });

  const generated = template ? generateExpression(template, mapping) : '';
  const complete = template && isMappingComplete(template, mapping);
  const categories = [...new Set(FORMULA_TEMPLATES.map((t) => t.category))];
  const isSaved = template && userTemplates.some((t) => t.id === template.id);
  const ownsCurrent = isSaved && (!currentUserId || template.createdBy === currentUserId);

  return (
    <>
      <SField label="Built-in Formula">
        <select className={s.sselect} value={templateId || ''} onChange={(e) => pickTemplate(e.target.value)}>
          <option value="">Select a formula…</option>
          {categories.map((cat) => (
            <optgroup key={cat} label={cat}>
              {FORMULA_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
          ))}
          {userTemplates.length > 0 && (
            <optgroup label="My Saved">
              {userTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          )}
        </select>
      </SField>

      {template && (
        <>
          {ownsCurrent && onDeleteTemplate && (
            <button
              type="button"
              className={s.formulaChip}
              style={{ marginTop: 4, color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => onDeleteTemplate(template.id)}
            >
              <Trash2 size={11} /> Delete this saved template
            </button>
          )}
          {template.description && <p className={s.hintText} style={{ marginTop: 2 }}>{template.description}</p>}

          <p className={s.subSectionLabel} style={{ marginTop: 10 }}>Required Inputs</p>
          {template.inputs.map((inp) => (
            <TemplateInput key={inp.key} input={inp} value={mapping[inp.key]} refFields={refFields} onChange={(v) => setInput(inp.key, v)} />
          ))}

          <p className={s.subSectionLabel} style={{ marginTop: 10 }}>Generated Expression</p>
          <pre className={s.formulaHighlight} style={{ position: 'static', minHeight: 0, whiteSpace: 'pre-wrap' }}>{generated || '—'}</pre>
          {complete
            ? <div className={s.formulaOk} style={{ marginTop: 6 }}><Check size={12} /> Ready</div>
            : <div className={s.formulaErr} style={{ marginTop: 6 }}><AlertCircle size={12} /> Map every required input</div>}
        </>
      )}
    </>
  );
}

function TemplateInput({ input, value, refFields, onChange }) {
  const matches = refFields.filter((f) => fieldTypeMatches(input.fieldType, f.type));

  if (input.kind === 'option') {
    return (
      <SField label={input.label}>
        <select className={s.sselect} value={value ?? input.default ?? ''} onChange={(e) => onChange(e.target.value)}>
          {input.options.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
        </select>
      </SField>
    );
  }

  if (input.kind === 'fields') {
    const sel = Array.isArray(value) ? value : [];
    const toggle = (fk) => onChange(sel.includes(fk) ? sel.filter((k) => k !== fk) : [...sel, fk]);
    return (
      <SField label={input.label}>
        {matches.length === 0
          ? <p className={s.hintText}>No matching fields.</p>
          : (
            <div className={s.formulaFieldList} style={{ maxHeight: 140 }}>
              {matches.map((f) => (
                <label key={f.id} className={s.formulaFieldItem} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={sel.includes(f.fk)} onChange={() => toggle(f.fk)} />
                  <span className={s.formulaFieldLabel}>{f.label || f.fk}</span>
                  <span className={s.formulaFieldType}>{f.type}</span>
                </label>
              ))}
            </div>
          )}
      </SField>
    );
  }

  return (
    <SField label={input.label}>
      <select className={s.sselect} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a field…</option>
        {matches.map((f) => <option key={f.id} value={f.fk}>{f.label || f.fk}</option>)}
      </select>
      {matches.length === 0 && <p className={s.hintText} style={{ marginTop: 2 }}>No matching field available.</p>}
    </SField>
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
