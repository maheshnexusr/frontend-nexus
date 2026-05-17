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

  if (field.required && isEmpty) {
    return field.requiredMessage || `${field.label || 'This field'} is required.`;
  }
  if (isEmpty) return null;

  const v = value;

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone': {
      const str = String(v);
      if (field.minLength != null && str.length < Number(field.minLength)) {
        return `Must be at least ${field.minLength} characters.`;
      }
      if (field.maxLength != null && str.length > Number(field.maxLength)) {
        return `Must be at most ${field.maxLength} characters.`;
      }
      if (field.regex) {
        try {
          const re = new RegExp(field.regex);
          if (!re.test(str)) return field.regexMessage || 'Invalid format.';
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
      if (field.minValue != null && n < Number(field.minValue)) {
        return `Must be at least ${field.minValue}.`;
      }
      if (field.maxValue != null && n > Number(field.maxValue)) {
        return `Must be at most ${field.maxValue}.`;
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

function compare(operator, fieldValue, ruleValue) {
  const isEmpty = (x) => x === undefined || x === null || x === '' || (Array.isArray(x) && x.length === 0);
  switch (operator) {
    case 'eq':       return String(fieldValue) === String(ruleValue);
    case 'ne':       return String(fieldValue) !== String(ruleValue);
    case 'in':       return Array.isArray(ruleValue) && ruleValue.map(String).includes(String(fieldValue));
    case 'gt':       return Number(fieldValue) >  Number(ruleValue);
    case 'lt':       return Number(fieldValue) <  Number(ruleValue);
    case 'gte':      return Number(fieldValue) >= Number(ruleValue);
    case 'lte':      return Number(fieldValue) <= Number(ruleValue);
    case 'contains': return String(fieldValue ?? '').toLowerCase().includes(String(ruleValue ?? '').toLowerCase());
    case 'isEmpty':  return  isEmpty(fieldValue);
    case 'isFilled': return !isEmpty(fieldValue);
    default:         return false;
  }
}

function evaluateRule(rule, allValues) {
  const { match = 'all', when = [] } = rule;
  if (when.length === 0) return false;
  const hits = when.map((w) => compare(w.operator, allValues[w.fieldId], w.value));
  return match === 'any' ? hits.some(Boolean) : hits.every(Boolean);
}

/**
 * Evaluate every rule attached to a field and return the resulting
 * "effective" config: { hidden, disabled, required }.
 */
export function evaluateField(field, allValues) {
  const result = {
    hidden:   false,
    disabled: false,
    required: !!field.required,
  };
  if (!field) return result;

  const rules = Array.isArray(field.logicRules)
    ? field.logicRules
    : (field.logic ? [field.logic] : []);

  for (const rule of rules) {
    if (!evaluateRule(rule, allValues)) continue;
    const action = rule.then;
    if (action === 'show')       result.hidden   = false;
    else if (action === 'hide')  result.hidden   = true;
    else if (action === 'enable')      result.disabled = false;
    else if (action === 'disable')     result.disabled = true;
    else if (action === 'require')     result.required = true;
    else if (action === 'unrequire')   result.required = false;
    else if (action && typeof action === 'object') {
      if ('setValue' in action)     result.setValue   = action.setValue;
      if (action.clearValue)        result.clearValue = true;
    }
  }

  return result;
}
