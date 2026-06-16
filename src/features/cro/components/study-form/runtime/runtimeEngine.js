/**
 * runtimeEngine — pure helpers used by RuntimeFieldRenderer.
 *
 * Two responsibilities:
 *   1. validateField(field, value)         → string|null
 *   2. evaluateField(field, allValues)     → { hidden, disabled, required, value? }
 *
 * Conditional rules live on field.logic (set in the builder), shape:
 *   logic = {
 *     match: 'all' | 'any',
 *     when: [
 *       { fieldId, operator: 'eq'|'ne'|'in'|'gt'|'lt'|'isEmpty'|'isFilled', value }
 *     ],
 *     then: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'unrequire'
 *           | { setValue: ... } | { clearValue: true }
 *   }
 *
 * Multiple rules supported by passing field.logicRules = [logic1, logic2, …].
 */

/* ── Validation ───────────────────────────────────────────────────────────── */

export function validateField(field, value) {
  if (!field) return null;

  const isEmpty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  const interp = (msg) => String(msg).replace(/\{Field Name\}/g, field.label || 'this field');
  // Inline error only for HARD-required (hardCheck default ON). A soft-only
  // required field (hardCheck off, softCheck on) doesn't block — its warning is
  // surfaced at Submit by StudyFormRunner, not here.
  const hardCheck = field.hardCheck ?? field.hard_check;
  const isHardRequired = field.required && (hardCheck !== false);
  if (isHardRequired && isEmpty) {
    const hm = field.hardMessage ?? field.hard_message;
    const rm = field.requiredMessage ?? field.required_message;
    return interp(hm?.trim() || rm?.trim() || '{Field Name} is required.');
  }
  if (isEmpty) return null;

  const v = value;
  // Validation rules live under field.validation in the study builder (SFB);
  // fall back to legacy top-level keys for older saved forms.
  const vc      = field.validation || {};
  const minLen  = vc.minLength ?? field.minLength;
  const maxLen  = vc.maxLength ?? field.maxLength;
  const pattern = vc.pattern ?? field.regex;
  const minNum  = vc.min ?? field.minValue;
  const maxNum  = vc.max ?? field.maxValue;
  const has = (x) => x !== '' && x !== null && x !== undefined;

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
    case 'password': {
      const str = String(v);
      if (has(minLen) && str.length < Number(minLen)) {
        return `Must be at least ${minLen} characters.`;
      }
      if (has(maxLen) && str.length > Number(maxLen)) {
        return `Must be at most ${maxLen} characters.`;
      }
      if (pattern) {
        try {
          const re = new RegExp(pattern);
          if (!re.test(str)) return field.patternMessage?.trim() || field.regexMessage || `${field.label || 'This field'} doesn't match the required format.`;
        } catch { /* malformed regex — ignore */ }
      }
      if (field.type === 'email' && !/^\S+@\S+\.\S+$/.test(str)) {
        return 'Enter a valid email address.';
      }
      return null;
    }

    case 'number':
    case 'slider': {
      const n = Number(v);
      if (Number.isNaN(n)) return 'Enter a valid number.';
      if (has(minNum) && n < Number(minNum)) {
        return `Must be at least ${minNum}.`;
      }
      if (has(maxNum) && n > Number(maxNum)) {
        return `Must be at most ${maxNum}.`;
      }
      return null;
    }

    case 'checkboxgroup':
    case 'multiselect': {
      const arr = Array.isArray(v) ? v : [];
      if (has(field.minSelections) && arr.length < Number(field.minSelections)) {
        return `Please select at least ${field.minSelections} option(s).`;
      }
      if (has(field.maxSelections) && arr.length > Number(field.maxSelections)) {
        return `You can select a maximum of ${field.maxSelections} option(s).`;
      }
      return null;
    }

    case 'date':
    case 'datetime': {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return 'Enter a valid date.';
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (field.disablePast   && d < today) return 'Past dates are not allowed.';
      if (field.disableFuture && d > today) return 'Future dates are not allowed.';
      return null;
    }

    case 'file': {
      const files = Array.isArray(v) ? v : [v];
      const max = field.maxSizeMB ? Number(field.maxSizeMB) * 1024 * 1024 : null;
      const allowed = (field.allowedTypes ?? []).map((t) => t.toLowerCase());
      for (const f of files) {
        if (!f) continue;
        if (max && f.size && f.size > max) {
          return `Each file must be ≤ ${field.maxSizeMB} MB.`;
        }
        if (allowed.length && f.type && !allowed.includes(f.type.toLowerCase())) {
          return `File type "${f.type}" is not allowed.`;
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/* ── Conditional logic ────────────────────────────────────────────────────── */

const isEmptyVal = (x) =>
  x === undefined || x === null || x === '' || (Array.isArray(x) && x.length === 0);

// Coerce a FIELD value into an array (multiselect/checkbox-group already are).
const asArr = (v) => (Array.isArray(v) ? v : (isEmptyVal(v) ? [] : [v]));

// Coerce a RULE value into a list — builder stores list operands as a
// comma-separated string ("a, b, c"), so split + trim those.
const toList = (v) =>
  Array.isArray(v)
    ? v
    : (isEmptyVal(v) ? [] : String(v).split(',').map((x) => x.trim()).filter((x) => x !== ''));

// Truthy test for checkbox / toggle source fields.
const isTruthy = (v) => v === true || v === 1 || v === 'true' || v === 'yes' || v === 'on' || v === 'Yes';

/**
 * Compare one source-field value against a rule value using the spec's operator
 * vocabulary (per-control-type table) PLUS the legacy builder codes
 * (is/is_not/gt/lt/…). Operator strings are normalised to lower snake case so
 * "Not Equals", "not_equals" and "ne" all resolve the same way.
 */
export function compareOp(operator, fieldValue, ruleValue) {
  const op = String(operator || '').toLowerCase().replace(/[\s-]+/g, '_');
  const fv = fieldValue;
  const n = (x) => Number(x);
  switch (op) {
    // equality
    case 'is': case 'eq': case 'equals':
      return String(fv ?? '') === String(ruleValue ?? '');
    case 'is_not': case 'ne': case 'not_equals': case 'does_not_equal':
      return String(fv ?? '') !== String(ruleValue ?? '');
    // text
    case 'contains':
      return String(fv ?? '').toLowerCase().includes(String(ruleValue ?? '').toLowerCase());
    case 'does_not_contain': case 'not_contains':
      return !String(fv ?? '').toLowerCase().includes(String(ruleValue ?? '').toLowerCase());
    case 'starts_with':
      return String(fv ?? '').toLowerCase().startsWith(String(ruleValue ?? '').toLowerCase());
    case 'ends_with':
      return String(fv ?? '').toLowerCase().endsWith(String(ruleValue ?? '').toLowerCase());
    case 'is_empty': case 'isempty':
      return isEmptyVal(fv);
    case 'is_not_empty': case 'isfilled': case 'is_filled':
      return !isEmptyVal(fv);
    // number / slider / calculated
    case 'gt': case 'greater_than':
      return n(fv) > n(ruleValue);
    case 'lt': case 'less_than':
      return n(fv) < n(ruleValue);
    case 'gte': case 'greater_than_or_equal': case 'greater_than_or_equal_to':
      return n(fv) >= n(ruleValue);
    case 'lte': case 'less_than_or_equal': case 'less_than_or_equal_to':
      return n(fv) <= n(ruleValue);
    case 'between': {
      const [a, b] = Array.isArray(ruleValue) ? ruleValue : String(ruleValue ?? '').split(/[,–-]/);
      const x = n(fv);
      return x >= n(a) && x <= n(b);
    }
    // dropdown (single) / radio
    case 'in_list': case 'in':
      return toList(ruleValue).map(String).includes(String(fv));
    case 'not_in_list': case 'not_in':
      return !toList(ruleValue).map(String).includes(String(fv));
    // dropdown (multi) / checkbox group
    case 'includes_any': {
      const set = asArr(fv).map(String);
      return toList(ruleValue).map(String).some((x) => set.includes(x));
    }
    case 'includes_all': {
      const set = asArr(fv).map(String);
      return toList(ruleValue).map(String).every((x) => set.includes(x));
    }
    // checkbox (single) / toggle-switch
    case 'checked': case 'on': case 'is_true':
      return isTruthy(fv);
    case 'unchecked': case 'off': case 'is_false':
      return !isTruthy(fv);
    // file upload / signature
    case 'uploaded': case 'signed':
      return !isEmptyVal(fv);
    case 'not_uploaded': case 'not_signed':
      return isEmptyVal(fv);
    // date / time
    case 'before':
      return new Date(fv).getTime() < new Date(ruleValue).getTime();
    case 'after':
      return new Date(fv).getTime() > new Date(ruleValue).getTime();
    default:
      return false;
  }
}

// The form-save layer snake_cases the payload, so a saved rule's source field
// is `field_id`, while in-builder (Redux) it's `fieldId`. Accept either.
const ruleFieldId = (r) => r?.fieldId ?? r?.field_id;

// Evaluate a set of rules with an AND/OR combinator. Returns true/false, or
// null when there's nothing actionable (no rule with a source field).
function rulesMet(rules, match, allValues) {
  const list = (rules || []).filter((r) => r && ruleFieldId(r) && r.operator);
  if (!list.length) return null;
  const hits = list.map((r) => compareOp(r.operator, allValues?.[ruleFieldId(r)], r.value));
  const m = String(match ?? 'all').toLowerCase();
  return (m === 'any' || m === 'or') ? hits.some(Boolean) : hits.every(Boolean);
}

// Legacy rule shape ({ match, when:[{fieldId,operator,value}], then }).
function evaluateLegacyRule(rule, allValues) {
  const { match = 'all', when = [] } = rule || {};
  if (!when.length) return false;
  const hits = when.map((w) => compareOp(w.operator, allValues?.[ruleFieldId(w)], w.value));
  return String(match).toLowerCase() === 'any' ? hits.some(Boolean) : hits.every(Boolean);
}

/**
 * Evaluate the conditional logic attached to a field and return its effective
 * config: { hidden, disabled, readOnly, required }.
 *
 * Reads BOTH the current builder shape — `field.condition = { action, rules,
 * match }` with action ∈ show|hide|readonly|editable — and the legacy
 * `field.logic`/`field.logicRules` shape, so older forms keep working.
 *
 * Action semantics (builder: "When conditions are met → <action>"):
 *   show     → field is visible ONLY when the condition is met (hidden until)
 *   hide     → field is hidden when the condition is met
 *   readonly → field becomes non-editable when the condition is met
 *   editable → field becomes editable (overrides a static read-only) when met
 */
export function evaluateField(field, allValues) {
  // The form-save layer snake_cases field props, so a saved field's static
  // toggles arrive as `read_only` / `clear_on_hide`; in-builder they're
  // camelCase. Accept either everywhere.
  const readOnlyFlag = field && (field.readOnly ?? field.read_only);
  // "Hidden by Default" — the field starts hidden and is only revealed by a
  // conditional `show` rule that evaluates true. With no rule it stays hidden.
  const hiddenDefault = field && (field.hiddenByDefault ?? field.hidden_by_default);
  const result = {
    hidden:   !!hiddenDefault,
    disabled: false,
    readOnly: !!readOnlyFlag, // static "Read-only" toggle is the baseline
    required: !!(field && field.required),
  };
  if (!field) return result;

  const cond = field.condition;
  if (cond && Array.isArray(cond.rules) && cond.rules.length) {
    const met = rulesMet(cond.rules, cond.match, allValues);
    if (met !== null) {
      switch (cond.action) {
        case 'show':     result.hidden = !met; break;
        case 'hide':     if (met) result.hidden = true; break;
        case 'readonly': if (met) result.readOnly = true; break;
        case 'editable': if (met) result.readOnly = false; break;
        default: break;
      }
    }
  }

  const legacy = Array.isArray(field.logicRules)
    ? field.logicRules
    : (field.logic ? [field.logic] : []);
  for (const rule of legacy) {
    if (!evaluateLegacyRule(rule, allValues)) continue;
    const action = rule.then;
    if (action === 'show')        result.hidden   = false;
    else if (action === 'hide')   result.hidden   = true;
    else if (action === 'enable')      result.disabled = false;
    else if (action === 'disable')     result.disabled = true;
    else if (action === 'readonly')    result.readOnly = true;
    else if (action === 'editable')    result.readOnly = false;
    else if (action === 'require')     result.required = true;
    else if (action === 'unrequire')   result.required = false;
    else if (action && typeof action === 'object') {
      if ('setValue' in action)     result.setValue   = action.setValue;
      if (action.clearValue)        result.clearValue = true;
    }
  }

  // Hidden-field data policy (spec: configurable clear vs retain). Default is
  // RETAIN; a field clears its value when hidden only if it opted in via
  // `clearOnHide` / `clear_on_hide` in the builder.
  if (result.hidden && (field.clearOnHide ?? field.clear_on_hide)) result.clearValue = true;

  return result;
}

/* ── Inclusion / Exclusion eligibility ─────────────────────────────────────── */
// Evaluate the form's eligibility criteria against the current values and return
// the subject's eligibility { status, reason }. Mirrors the backend
// eligibilityEval.js. Exclusion takes priority. Returns status:null when no
// criteria are configured (so the UI shows no badge).
export function evaluateEligibility(criteria, values = {}) {
  const fid   = (c) => c?.fieldId ?? c?.field_id;
  // Human label for the reason text — fieldLabel arrives snake_case in the
  // capture runtime (field_label); only fall back to the opaque id as a last
  // resort so the exclusion popup never shows a raw field id.
  const flabel = (c) => c?.fieldLabel ?? c?.field_label ?? fid(c);
  const ctype = (c) => String(c?.type ?? c?.criteria_type ?? 'inclusion').toLowerCase();
  const rules = (criteria || []).filter((c) => c && fid(c) && c.operator);
  if (!rules.length) return { status: null, reason: null };

  const exclusion = rules.filter((c) => ctype(c) === 'exclusion');
  const inclusion = rules.filter((c) => ctype(c) !== 'exclusion');

  for (const c of exclusion) {
    const fv = values[fid(c)];
    if (isEmptyVal(fv)) continue;
    if (compareOp(c.operator, fv, c.value)) {
      return { status: 'Excluded', reason: `Exclusion met: ${flabel(c)}` };
    }
  }
  if (rules.some((c) => isEmptyVal(values[fid(c)]))) {
    return { status: 'Pending Review', reason: null };
  }
  if (inclusion.length) {
    const failed = inclusion.filter((c) => !compareOp(c.operator, values[fid(c)], c.value));
    if (failed.length) {
      return { status: 'Screen Failed', reason: `Inclusion not met: ${failed.map((c) => flabel(c)).join(', ')}` };
    }
  }
  return { status: 'Included', reason: null };
}
