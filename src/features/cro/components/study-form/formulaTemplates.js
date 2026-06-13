/**
 * formulaTemplates — system-wide Built-in Formula Library.
 *
 * Each template declares its required inputs and a parameterised expression with
 * `{key}` placeholders. The designer picks a template and MAPS each input to a
 * real field/column; `generateExpression()` substitutes the mapping to produce a
 * concrete expression that the shared formulaEngine runs. Studies reuse the same
 * template with different field names — no rebuilding.
 *
 * Phase 1: built-in only (code-defined, available everywhere; no DB).
 *
 * Input kinds:
 *   field   — single field/column reference (filtered by `fieldType`)
 *   fields  — one or more references (for SUM/AVG/MIN/MAX); `{key}` → "a, b, c"
 *   option  — a fixed choice (e.g. date unit); `{key}` → the chosen value
 */

export const FORMULA_TEMPLATES = [
  {
    id: 'bmi',
    name: 'BMI Calculation',
    category: 'Clinical',
    description: 'Body Mass Index from weight (kg) and height (cm).',
    inputs: [
      { key: 'weight', label: 'Weight Field (kg)', kind: 'field', fieldType: 'number' },
      { key: 'height', label: 'Height Field (cm)', kind: 'field', fieldType: 'number' },
    ],
    expression: 'ROUND({weight} / POWER(({height} / 100), 2), 2)',
    outputType: 'number', precision: 2,
  },
  {
    id: 'age',
    name: 'Age Calculation',
    category: 'Clinical',
    description: 'Age in whole years from a date of birth.',
    inputs: [
      { key: 'dob', label: 'Date of Birth Field', kind: 'field', fieldType: 'date' },
    ],
    expression: 'DATEDIFF(TODAY(), {dob}, "years")',
    outputType: 'number', precision: 0,
  },
  {
    id: 'date_difference',
    name: 'Date Difference',
    category: 'Date',
    description: 'Difference between two dates in days, months, or years.',
    inputs: [
      { key: 'start', label: 'Start Date Field', kind: 'field', fieldType: 'date' },
      { key: 'end', label: 'End Date Field', kind: 'field', fieldType: 'date' },
      { key: 'unit', label: 'Unit', kind: 'option', options: ['days', 'months', 'years'], default: 'days' },
    ],
    expression: 'DATEDIFF({end}, {start}, "{unit}")',
    outputType: 'number', precision: 0,
  },
  {
    id: 'visit_duration',
    name: 'Visit Duration',
    category: 'Date',
    description: 'Number of days between a start and end date.',
    inputs: [
      { key: 'start', label: 'Start Date Field', kind: 'field', fieldType: 'date' },
      { key: 'end', label: 'End Date Field', kind: 'field', fieldType: 'date' },
    ],
    expression: 'DATEDIFF({end}, {start}, "days")',
    outputType: 'number', precision: 0,
  },
  {
    id: 'percentage',
    name: 'Percentage',
    category: 'Math',
    description: 'Part ÷ Total × 100.',
    inputs: [
      { key: 'part', label: 'Part / Numerator Field', kind: 'field', fieldType: 'number' },
      { key: 'whole', label: 'Total / Denominator Field', kind: 'field', fieldType: 'number' },
    ],
    expression: 'ROUND({part} / {whole} * 100, 2)',
    outputType: 'number', precision: 2,
  },
  {
    id: 'total_amount',
    name: 'Total Amount',
    category: 'Math',
    description: 'Price × Quantity.',
    inputs: [
      { key: 'price', label: 'Price Field', kind: 'field', fieldType: 'number' },
      { key: 'quantity', label: 'Quantity Field', kind: 'field', fieldType: 'number' },
    ],
    expression: '{price} * {quantity}',
    outputType: 'number', precision: 2,
  },
  {
    id: 'sum',
    name: 'Sum',
    category: 'Aggregate',
    description: 'Sum of two or more numeric fields.',
    inputs: [{ key: 'values', label: 'Fields to Sum', kind: 'fields', fieldType: 'number' }],
    expression: 'SUM({values})',
    outputType: 'number', precision: 2,
  },
  {
    id: 'average',
    name: 'Average',
    category: 'Aggregate',
    description: 'Average of two or more numeric fields.',
    inputs: [{ key: 'values', label: 'Fields to Average', kind: 'fields', fieldType: 'number' }],
    expression: 'AVG({values})',
    outputType: 'number', precision: 2,
  },
  {
    id: 'minimum',
    name: 'Minimum',
    category: 'Aggregate',
    description: 'Smallest of the selected numeric fields.',
    inputs: [{ key: 'values', label: 'Fields', kind: 'fields', fieldType: 'number' }],
    expression: 'MIN({values})',
    outputType: 'number', precision: 2,
  },
  {
    id: 'maximum',
    name: 'Maximum',
    category: 'Aggregate',
    description: 'Largest of the selected numeric fields.',
    inputs: [{ key: 'values', label: 'Fields', kind: 'fields', fieldType: 'number' }],
    expression: 'MAX({values})',
    outputType: 'number', precision: 2,
  },
];

export const getTemplate = (id) => FORMULA_TEMPLATES.find((t) => t.id === id) || null;

// Field/column types that satisfy a template input's `fieldType`.
export const TYPE_GROUPS = {
  number: ['number', 'currency', 'rating', 'formula'],
  date: ['date', 'datetime'],
  text: ['text', 'textarea', 'email', 'phone', 'url', 'select', 'radiogroup'],
};
export const fieldTypeMatches = (fieldType, t) =>
  !fieldType || (TYPE_GROUPS[fieldType] || []).includes(t);

/** Substitute a template's `{key}` placeholders from a mapping → concrete expr. */
export function generateExpression(template, mapping = {}) {
  if (!template) return '';
  let expr = template.expression;
  for (const inp of template.inputs) {
    const v = mapping[inp.key];
    let sub;
    if (inp.kind === 'fields') sub = (Array.isArray(v) ? v.filter(Boolean) : []).join(', ');
    else if (inp.kind === 'option') sub = v ?? inp.default ?? (inp.options?.[0] ?? '');
    else sub = v ?? '';
    expr = expr.split(`{${inp.key}}`).join(sub);
  }
  return expr;
}

/** Field keys a mapped template depends on (field + fields inputs, not options). */
export function templateDependencies(template, mapping = {}) {
  if (!template) return [];
  const deps = [];
  for (const inp of template.inputs) {
    if (inp.kind === 'option') continue;
    const v = mapping[inp.key];
    if (inp.kind === 'fields') (Array.isArray(v) ? v : []).forEach((k) => k && deps.push(k));
    else if (v) deps.push(v);
  }
  return [...new Set(deps)];
}

// Turn a human label into a friendly input label ("body_weight" → "Body Weight").
const humanize = (k) => String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Auto-parameterize a concrete custom expression into a reusable template.
 * Each referenced field key becomes a mappable `{key}` input; the expression's
 * bare keys are swapped for `{key}` placeholders. `keyTypes` maps a key → its
 * field type (so the reuse picker can filter the dropdowns); defaults to number.
 *
 *   "weight * height"  →  { expression:"{weight} * {height}",
 *                          inputs:[{key:'weight',label:'Weight',kind:'field',fieldType:'number'}, …] }
 */
export function parameterizeExpression(expr, deps = [], keyTypes = {}) {
  let expression = expr;
  // Replace whole-word identifiers only (longest first to avoid partial hits).
  [...deps].sort((a, b) => b.length - a.length).forEach((key) => {
    expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), `{${key}}`);
  });
  const inputs = deps.map((key) => ({
    key,
    label: humanize(key),
    kind: 'field',
    fieldType: TYPE_GROUPS.date.includes(keyTypes[key]) ? 'date'
      : TYPE_GROUPS.number.includes(keyTypes[key]) ? 'number'
      : 'number',
  }));
  return { expression, inputs };
}

/** True when every required input of the template has been mapped. */
export function isMappingComplete(template, mapping = {}) {
  if (!template) return false;
  return template.inputs.every((inp) => {
    const v = mapping[inp.key];
    if (inp.kind === 'fields') return Array.isArray(v) && v.filter(Boolean).length > 0;
    if (inp.kind === 'option') return !!(v ?? inp.default);
    return !!v;
  });
}
