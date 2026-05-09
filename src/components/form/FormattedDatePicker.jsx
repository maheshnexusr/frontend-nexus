/**
 * FormattedDatePicker — wraps a native date input but displays the chosen
 * value in DD-mmm-YYYY format (e.g. "09-may-2026", lowercase month).
 *
 * The underlying value is still an ISO string ("YYYY-MM-DD") so it works
 * with the rest of the codebase (slices, axios payloads, native min/max).
 *
 *   <FormattedDatePicker
 *     value={form.startDate}
 *     onChange={(e) => set('startDate')(e)}
 *     min={today}
 *   />
 */

import { forwardRef, useRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import { CalendarDays } from 'lucide-react';
import styles from './FormattedDatePicker.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

function formatDisplay(iso) {
  if (!iso || typeof iso !== 'string') return '';
  // Expect YYYY-MM-DD; bail out if shape doesn't match.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const [, year, month, day] = m;
  const monthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11) return '';
  return `${day}-${monthNames[idx]}-${year}`;
}

const FormattedDatePicker = forwardRef(function FormattedDatePicker(
  { value, onChange, min, max, disabled, error, placeholder, name, onBlur, className, ...rest },
  ref,
) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current, []);

  const display = formatDisplay(value);

  const openPicker = () => {
    if (disabled) return;
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* fall through */ }
    }
    el.focus();
  };

  return (
    <div
      className={clx(
        styles.wrapper,
        error    && styles.wrapperError,
        disabled && styles.wrapperDisabled,
        className,
      )}
      onClick={openPicker}
      role="button"
      tabIndex={-1}
    >
      <span className={clx(styles.display, !display && styles.displayPlaceholder)}>
        {display || placeholder || 'dd-mmm-yyyy'}
      </span>

      <span className={styles.icon} aria-hidden="true">
        <CalendarDays size={15} />
      </span>

      {/* Native input lives behind the visible display so clicks/keyboard still
          reach it, but the rendered value is our formatted string. */}
      <input
        {...rest}
        ref={inputRef}
        type="date"
        name={name}
        value={value ?? ''}
        onChange={onChange}
        onBlur={onBlur}
        min={min}
        max={max}
        disabled={disabled}
        className={styles.nativeInput}
        aria-invalid={error ? 'true' : undefined}
        aria-label={name || 'Date'}
      />
    </div>
  );
});

FormattedDatePicker.propTypes = {
  value:       PropTypes.string,
  onChange:    PropTypes.func,
  min:         PropTypes.string,
  max:         PropTypes.string,
  disabled:    PropTypes.bool,
  error:       PropTypes.bool,
  placeholder: PropTypes.string,
  name:        PropTypes.string,
  onBlur:      PropTypes.func,
  className:   PropTypes.string,
};

FormattedDatePicker.defaultProps = {
  value:       '',
  onChange:    null,
  min:         '',
  max:         '',
  disabled:    false,
  error:       false,
  placeholder: '',
  name:        '',
  onBlur:      null,
  className:   '',
};

export default FormattedDatePicker;
