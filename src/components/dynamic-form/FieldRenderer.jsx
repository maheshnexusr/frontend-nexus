/**
 * FieldRenderer — renders a single form field based on its `type`.
 *
 * Supported types:
 *   text | email | phone | number | password
 *   textarea
 *   date | datetime | time
 *   select
 *   radiogroup  (options: [{ value, label }] OR ["string"])
 *   checkboxgroup
 *   toggle
 *   file
 *   rating
 *   h2 | paragraph | divider   (layout-only, no input)
 */
import s from './DynamicForm.module.css';

/* normalise options → always [{ value, label }] */
function normaliseOptions(options = []) {
  return options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
}

export default function FieldRenderer({ field, value, error, onChange, readOnly }) {
  const { type, label, placeholder, helpText, required, options = [], rows, validation = {} } = field;

  /* ── layout-only elements ─────────────────────────────────────────────── */
  if (type === 'h2')       return <h2  className={s.layoutH2}>{label || 'Section'}</h2>;
  if (type === 'paragraph') return <p   className={s.layoutPara}>{field.content || label || ''}</p>;
  if (type === 'divider')   return <hr  className={s.layoutDivider} />;

  const opts = normaliseOptions(options);

  /* ── shared input props ───────────────────────────────────────────────── */
  const baseClass = `${s.input} ${error ? s.inputError : ''} ${readOnly ? s.inputReadonly : ''}`;

  return (
    <div className={s.fieldWrap}>
      {/* Label */}
      {label && (
        <label className={s.label} htmlFor={field.id}>
          {label}
          {required && <span className={s.req}> *</span>}
        </label>
      )}

      {/* Help text */}
      {helpText && <p className={s.help}>{helpText}</p>}

      {/* Input */}
      {renderInput()}

      {/* Validation error */}
      {error && <p className={s.errorMsg}>{error}</p>}
    </div>
  );

  /* ── input switch ─────────────────────────────────────────────────────── */
  function renderInput() {
    const v   = value ?? '';
    const set = (val) => !readOnly && onChange(val);

    switch (type) {

      /* ─ single-line text inputs ─ */
      case 'text':
      case 'email':
      case 'number':
      case 'password':
        return (
          <input
            id={field.id}
            type={type}
            className={baseClass}
            value={v}
            placeholder={placeholder || ''}
            readOnly={readOnly}
            min={validation.min   || undefined}
            max={validation.max   || undefined}
            minLength={validation.minLength || undefined}
            maxLength={validation.maxLength || undefined}
            pattern={validation.pattern    || undefined}
            onChange={(e) => set(e.target.value)}
          />
        );

      case 'phone':
        return (
          <input
            id={field.id}
            type="tel"
            className={baseClass}
            value={v}
            placeholder={placeholder || '+1 555 000 0000'}
            readOnly={readOnly}
            onChange={(e) => set(e.target.value)}
          />
        );

      /* ─ textarea ─ */
      case 'textarea':
        return (
          <textarea
            id={field.id}
            className={`${baseClass} ${s.textarea}`}
            value={v}
            placeholder={placeholder || ''}
            rows={rows ?? 3}
            readOnly={readOnly}
            minLength={validation.minLength || undefined}
            maxLength={validation.maxLength || undefined}
            onChange={(e) => set(e.target.value)}
          />
        );

      /* ─ date / time pickers ─ */
      case 'date':
        return (
          <input id={field.id} type="date" className={baseClass}
            value={v} readOnly={readOnly} onChange={(e) => set(e.target.value)} />
        );
      case 'datetime':
        return (
          <input id={field.id} type="datetime-local" className={baseClass}
            value={v} readOnly={readOnly} onChange={(e) => set(e.target.value)} />
        );
      case 'time':
        return (
          <input id={field.id} type="time" className={baseClass}
            value={v} readOnly={readOnly} onChange={(e) => set(e.target.value)} />
        );

      /* ─ select ─ */
      case 'select':
        return (
          <select
            id={field.id}
            className={`${baseClass} ${s.select}`}
            value={v}
            disabled={readOnly}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">{placeholder || 'Select an option…'}</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );

      /* ─ radio group ─ */
      case 'radiogroup':
      case 'radio':
        return (
          <div className={s.choiceGroup} role="radiogroup" aria-label={label}>
            {opts.map((o) => (
              <label
                key={o.value}
                className={`${s.choiceItem} ${v === o.value ? s.choiceSelected : ''} ${readOnly ? s.choiceReadonly : ''}`}
              >
                <input
                  type="radio"
                  name={field.id}
                  value={o.value}
                  checked={v === o.value}
                  disabled={readOnly}
                  onChange={() => set(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        );

      /* ─ checkbox group ─ */
      case 'checkboxgroup':
      case 'checkbox': {
        const checked = Array.isArray(v) ? v : [];
        const toggle  = (val) => {
          if (readOnly) return;
          const next = checked.includes(val)
            ? checked.filter((x) => x !== val)
            : [...checked, val];
          set(next);
        };
        return (
          <div className={s.choiceGroup}>
            {opts.map((o) => (
              <label
                key={o.value}
                className={`${s.choiceItem} ${checked.includes(o.value) ? s.choiceSelected : ''} ${readOnly ? s.choiceReadonly : ''}`}
              >
                <input
                  type="checkbox"
                  value={o.value}
                  checked={checked.includes(o.value)}
                  disabled={readOnly}
                  onChange={() => toggle(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        );
      }

      /* ─ toggle (boolean) ─ */
      case 'toggle': {
        const on = Boolean(v);
        return (
          <div
            className={`${s.toggleWrap} ${readOnly ? s.choiceReadonly : ''}`}
            onClick={() => !readOnly && set(!on)}
          >
            <div className={s.toggleTrack} style={{ background: on ? '#2563eb' : '#cbd5e1' }}>
              <div
                className={s.toggleThumb}
                style={{ transform: on ? 'translateX(18px)' : 'translateX(0)' }}
              />
            </div>
            <span className={s.toggleLabel}>{on ? 'Yes' : 'No'}</span>
          </div>
        );
      }

      /* ─ file upload ─ */
      case 'file':
        return (
          <label className={s.fileZone}>
            <input
              id={field.id}
              type="file"
              className={s.fileInput}
              disabled={readOnly}
              onChange={(e) => set(e.target.files?.[0] ?? null)}
            />
            <span className={s.fileIcon}>📎</span>
            <span className={s.fileText}>
              {v?.name ? v.name : 'Click to upload or drag & drop'}
            </span>
          </label>
        );

      /* ─ rating (stars) ─ */
      case 'rating': {
        const stars = Number(v) || 0;
        const max   = Number(field.max) || 5;
        return (
          <div className={s.stars}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`${s.star} ${n <= stars ? s.starFilled : ''}`}
                disabled={readOnly}
                onClick={() => set(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
            {stars > 0 && (
              <span className={s.ratingLabel}>{stars} / {max}</span>
            )}
          </div>
        );
      }

      /* ─ fallback ─ */
      default:
        return (
          <input
            id={field.id}
            type="text"
            className={baseClass}
            value={v}
            placeholder={placeholder || ''}
            readOnly={readOnly}
            onChange={(e) => set(e.target.value)}
          />
        );
    }
  }
}
