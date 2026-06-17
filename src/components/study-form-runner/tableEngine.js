/**
 * tableEngine — pure helpers shared by the Table/Grid runtime (TableFieldInput)
 * and the design-time preview. No React, no DOM: formula evaluation + validation
 * only, so it's trivially testable and reusable.
 *
 * Row shape:  { [col.fieldKey]: value, _rowId, _meta:{...} }
 * Column shape comes from studyFormSlice.makeColumn().
 */
import { evaluateExpression } from '@/features/cro/components/study-form/formulaEngine';
import { compareOp } from '@/features/cro/components/study-form/runtime/runtimeEngine';

/* ── Small numeric helpers ──────────────────────────────────────────────── */

// The storage key for a column's cell value. Prefer the designer's fieldKey,
// but fall back to the column's always-unique `key` so columns with a missing /
// blank / duplicate fieldKey never collide (which would make one input fill the
// whole row). Used everywhere a cell value is read or written.
export const colKey = (c) => (c && (c.fieldKey || c.key)) || '';

export const toNum = (v) => {
  if (v === '' || v == null) return 0;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const isBlank = (v) =>
  v === '' || v == null || (Array.isArray(v) && v.length === 0);

// Numeric (non-formula) columns participating in ROWTOTAL().
const NUMERIC_TYPES = ['number', 'currency', 'rating'];

/* ── Formula evaluation ─────────────────────────────────────────────────── */
// Column formulas reuse the shared formulaEngine (IF, ROUND, DATEDIFF, SUM, AVG,
// MIN, MAX, comparison, arithmetic). References are the OTHER columns' keys in
// the SAME row, e.g.  DATEDIFF(end_date, start_date)  or  qty * unit_price.
//   • ROWTOTAL()      → sum of this row's numeric, non-formula columns (extra).
//   • legacy {key}    → still accepted (older saved formulas) and de-braced.

/**
 * Evaluate a formula column's expression for a single row. Returns a Number
 * (rounded), a string, or '' when the expression is empty/invalid.
 */
export function evaluateFormula(expr, row, allRows = [], columns = []) {
  if (!expr || typeof expr !== 'string') return '';

  // Legacy {fieldKey} braces → bare identifiers so old formulas still parse.
  let s = expr.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, '$1');

  // ROWTOTAL() → sum of this row's numeric, non-formula columns.
  s = s.replace(/\bROWTOTAL\s*\(\s*\)/gi, () => {
    const total = columns
      .filter((c) => NUMERIC_TYPES.includes(c.type) && !c.formula?.enabled)
      .reduce((acc, c) => acc + toNum(row?.[colKey(c)]), 0);
    return `(${total})`;
  });

  // Scope = this row's values addressed by each column's key (raw values, so
  // dates stay strings for DATEDIFF; the engine coerces numbers as needed).
  // ALSO alias the designer's Internal Field Name in both casings: the capture
  // runtime sees the structure snake_case (`field_key`), so colKey falls back to
  // the internal column key and a formula referencing `end_date` / `start_date`
  // (e.g. DATEDIFF over two date columns) would resolve to undefined → blank.
  // Aliasing leaves the cell STORAGE key untouched (no data migration), it only
  // makes the expression's identifiers resolve. See [[form-structure-snake-camel-runtime]].
  const scope = {};
  columns.forEach((c) => {
    const k = colKey(c);
    const v = row?.[k];
    scope[k] = v;
    if (c.fieldKey  && c.fieldKey  !== k) scope[c.fieldKey]  = v;
    if (c.field_key && c.field_key !== k) scope[c.field_key] = v;
  });

  const { value, error } = evaluateExpression(s, scope);
  if (error || value == null) return '';
  if (typeof value === 'number') return Math.round(value * 1e4) / 1e4;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
}

/** Grand total (sum) of a formula/numeric column across all rows. */
export function grandTotal(col, allRows = [], columns = []) {
  return allRows.reduce((acc, row) => {
    const v = col.formula?.enabled
      ? evaluateFormula(col.formula.expr, row, allRows, columns)
      : row?.[colKey(col)];
    return acc + toNum(v);
  }, 0);
}

/* ── Per-row column conditional behaviour ───────────────────────────────────
 * A column's `rowRules` reference SIBLING columns in the SAME row (by their
 * storage key) and act on THIS column's cell in that row, evaluated
 * independently per row. Source value lookup is `row[when.col]` (rules store the
 * sibling's colKey, matching how the row is keyed). Reuses runtimeEngine's
 * compareOp so the operator vocabulary matches the rest of the platform. */

// Resolve a `when.col` reference to its cell value in the row. Rules store the
// sibling's designer fieldKey, but the row is keyed by `colKey` — and in the
// capture runtime the structure is snake_case, so `fieldKey` is absent and
// colKey falls back to the column's uid `key`. So a direct `row[when.col]` only
// works in the camelCase draft (preview). Map the reference through the columns
// (fieldKey / field_key / key / colKey) to the actual storage key in either
// casing. See [[form-structure-snake-camel-runtime]].
function resolveCellValue(key, row, columns) {
  if (!row) return undefined;
  if (key in row) return row[key];                       // camel draft: direct hit
  const c = (columns || []).find(
    (cc) => cc && (cc.fieldKey === key || cc.field_key === key || cc.key === key || colKey(cc) === key),
  );
  return c ? row[colKey(c)] : row[key];
}

// One rule's `when` conditions against a single row → boolean.
function rowRuleMet(rule, row, columns) {
  const when = (rule?.when || []).filter((w) => w && w.col && w.operator);
  if (!when.length) return false;
  const hits = when.map((w) => compareOp(w.operator, resolveCellValue(w.col, row, columns), w.value));
  return String(rule?.match ?? 'all').toLowerCase() === 'any' ? hits.some(Boolean) : hits.every(Boolean);
}

/**
 * Effective per-row state for a column's cell, layering its `rowRules` over the
 * static column flags. Returns { hidden, disabled, readOnly, required,
 * clearValue, setValue }. Config keys may be camel- or snake_case (stored
 * structure casing). `setValue` is undefined unless a set-value rule is active.
 * `columns` is needed to resolve `when.col` references across casings.
 */
export function evaluateRowColumn(col, row, columns) {
  const eff = {
    hidden: !!col?.hidden, disabled: false, readOnly: !!col?.readOnly,
    required: !!col?.required, clearValue: false, setValue: undefined,
  };
  const rules = col?.rowRules ?? col?.row_rules ?? [];
  for (const rule of rules) {
    if (!rowRuleMet(rule, row, columns)) continue;
    switch (String(rule?.action || '').toLowerCase()) {
      case 'show':      eff.hidden = false; break;
      case 'hide':      eff.hidden = true; break;
      case 'enable':    eff.disabled = false; break;
      case 'disable':   eff.disabled = true; break;
      case 'readonly':  eff.readOnly = true; break;
      case 'editable':  eff.readOnly = false; break;
      case 'require':   eff.required = true; break;
      case 'unrequire': eff.required = false; break;
      case 'clear':     eff.clearValue = true; break;
      case 'setvalue':  eff.setValue = rule.setValue ?? rule.set_value ?? ''; break;
      default: break;
    }
  }
  return eff;
}

// True when the column has any setvalue/clear rule active for this row (drives
// the edge-triggered value writer in TableFieldInput).
export function rowColumnValueAction(col, row, columns) {
  const rules = col?.rowRules ?? col?.row_rules ?? [];
  for (const rule of rules) {
    const action = String(rule?.action || '').toLowerCase();
    if ((action === 'clear' || action === 'setvalue') && rowRuleMet(rule, row, columns)) {
      return { action, setValue: rule.setValue ?? rule.set_value ?? '' };
    }
  }
  return null;
}

/* ── Validation engine ──────────────────────────────────────────────────── */

const isValidDate = (v) => !!v && !Number.isNaN(new Date(v).getTime());

/**
 * Validate a single cell. Returns an error message string, or '' when valid.
 * `allRows` is needed for the `unique` rule.
 */
export function validateCell(col, value, row, allRows = []) {
  if (!col || col.formula?.enabled) return '';   // formula cells are computed, never user-invalid
  const val = value;
  const v = col.validation || {};
  const blank = isBlank(val);
  const custom = v.customMessage;

  if (col.required && blank) return custom || `${col.label || 'This field'} is required`;
  if (blank) return '';                          // optional + empty → nothing else to check

  const str = Array.isArray(val) ? val.join(', ') : String(val);

  switch (col.type) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return custom || 'Enter a valid email address';
      break;
    case 'url':
      if (!/^https?:\/\/[^\s]+$/i.test(str)) return custom || 'Enter a valid URL (http/https)';
      break;
    case 'phone':
      if (!/^[+]?[\d\s()-]{6,}$/.test(str)) return custom || 'Enter a valid phone number';
      break;
    case 'date':
    case 'datetime':
      if (!isValidDate(val)) return custom || 'Enter a valid date';
      break;
    default:
      break;
  }

  // Length rules (text-ish).
  if (v.minLength !== '' && v.minLength != null && str.length < Number(v.minLength))
    return custom || `Minimum ${v.minLength} characters`;
  if (v.maxLength !== '' && v.maxLength != null && str.length > Number(v.maxLength))
    return custom || `Maximum ${v.maxLength} characters`;

  // Numeric range.
  if (['number', 'currency', 'rating'].includes(col.type)) {
    const n = toNum(val);
    if (v.min !== '' && v.min != null && n < Number(v.min)) return custom || `Minimum value is ${v.min}`;
    if (v.max !== '' && v.max != null && n > Number(v.max)) return custom || `Maximum value is ${v.max}`;
  }

  // Regex pattern.
  if (v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(str)) return custom || 'Value does not match the required format';
    } catch { /* invalid author regex → skip */ }
  }

  // Unique across rows.
  if (v.unique) {
    const norm = (x) => String(Array.isArray(x) ? x.join(',') : (x ?? '')).trim().toLowerCase();
    const me = norm(val);
    const dupes = allRows.filter((r) => norm(r?.[colKey(col)]) === me).length;
    if (dupes > 1) return custom || `${col.label || 'Value'} must be unique`;
  }

  return '';
}

/**
 * Validate every cell in the table.
 * Returns { errors: { [rowId]: { [colKey]: msg } }, hasErrors, count }.
 */
export function validateTable(field, rows = []) {
  const cols = (field?.columns || []).filter((c) => !c.hidden);
  const errors = {};
  let count = 0;
  rows.forEach((row) => {
    const rowId = row?._rowId || rows.indexOf(row);
    cols.forEach((col) => {
      const msg = validateCell(col, row?.[colKey(col)], row, rows);
      if (msg) {
        (errors[rowId] ??= {})[colKey(col)] = msg;
        count += 1;
      }
    });
  });
  return { errors, hasErrors: count > 0, count };
}
