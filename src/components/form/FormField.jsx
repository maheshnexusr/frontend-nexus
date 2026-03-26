import PropTypes from 'prop-types';
import { AlertCircle } from 'lucide-react';
import styles from './FormField.module.css';

/**
 * FormField — wrapper that provides label, error message and help text around
 * any form control (input, select, textarea…) passed as `children`.
 *
 * Designed to work with react-hook-form field errors out of the box:
 *   <FormField label="Email" error={errors.email?.message}>
 *     <input {...register('email')} />
 *   </FormField>
 */
export default function FormField({ label, name, required, error, helpText, children }) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={name} className={styles.label}>
          {label}
          {required && <span className={styles.asterisk} aria-hidden="true"> *</span>}
        </label>
      )}

      <div className={styles.control}>
        {children}
      </div>

      {error && (
        <p className={styles.error} role="alert" id={name ? `${name}-error` : undefined}>
          <AlertCircle size={13} className={styles.errorIcon} aria-hidden="true" />
          {error}
        </p>
      )}

      {helpText && !error && (
        <p className={styles.helpText}>{helpText}</p>
      )}
    </div>
  );
}

FormField.propTypes = {
  /** Text label rendered above the control */
  label:    PropTypes.string,
  /** Associates label + error with the input via id / aria-describedby */
  name:     PropTypes.string,
  /** Appends a red asterisk after the label */
  required: PropTypes.bool,
  /** Error message string (from react-hook-form `errors.field.message`) */
  error:    PropTypes.string,
  /** Muted hint text shown below the control when there is no error */
  helpText: PropTypes.string,
  /** The actual input / select / textarea element */
  children: PropTypes.node.isRequired,
};

FormField.defaultProps = {
  label:    '',
  name:     '',
  required: false,
  error:    '',
  helpText: '',
};
