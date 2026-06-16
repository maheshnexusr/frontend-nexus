/**
 * tableEngine — pure helpers shared by the Table/Grid runtime (TableFieldInput)
 * and the design-time preview. No React, no DOM: formula evaluation + validation
 * only, so it's trivially testable and reusable.
 *
 * Row shape:  { [col.fieldKey]: value, _rowId, _meta:{...} }
 * Column shape comes from studyFormSlice.makeColumn().
 */
import { evaluateExpression } from '@/features/cro/components/study-form/formulaEngine';

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
