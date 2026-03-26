/**
 * DatePicker — styled native date input
 *
 * react-hook-form  register() pattern:
 *   <FormField label="Date of Birth" error={errors.dob?.message}>
 *     <DatePicker {...register('dob')} min="1900-01-01" max={today} />
 *   </FormField>
 *
 * react-hook-form  Controller pattern:
 *   <Controller
 *     name="visitDate"
 *     control={control}
 *     render={({ field }) => (
 *       <FormField label="Visit Date" error={errors.visitDate?.message}>
 *         <DatePicker {...field} min="2020-01-01" />
 *       </FormField>
 *     )}
 *   />
 */

import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { CalendarDays } from 'lucide-react';
import styles from './DatePicker.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

const DatePicker = forwardRef(function DatePicker(
  { value, onChange, min, max, disabled, error, placeholder, name, onBlur, className, ...rest },
  ref,
) {
  return (
    <div
      className={clx(
        styles.wrapper,
        error    && styles.wrapperError,
        disabled && styles.wrapperDisabled,
      )}
    >
      <input
        {...rest}
        ref={ref}
        type="date"
        name={name}
        value={value ?? ''}
        onChange={onChange}
        onBlur={onBlur}
        min={min}
        max={max}
        disabled={disabled}
        placeholder={placeholder}
        className={clx(styles.input, className)}
        aria-invalid={error ? 'true' : undefined}
      />

      {/* Decorative calendar icon — pointer-events: none so clicks reach the input */}
      <span className={styles.icon} aria-hidden="true">
        <CalendarDays size={15} />
      </span>
    </div>
  );
});

DatePicker.propTypes = {
  /** ISO date string "YYYY-MM-DD" */
  value:       PropTypes.string,
  onChange:    PropTypes.func,
  /** Minimum selectable date "YYYY-MM-DD" */
  min:         PropTypes.string,
  /** Maximum selectable date "YYYY-MM-DD" */
  max:         PropTypes.string,
  disabled:    PropTypes.bool,
  /** Applies error border styling */
  error:       PropTypes.bool,
  placeholder: PropTypes.string,
  name:        PropTypes.string,
  onBlur:      PropTypes.func,
  className:   PropTypes.string,
};

DatePicker.defaultProps = {
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

export default DatePicker;
