/**
 * PasswordInput — password field with show/hide toggle + optional strength meter
 *
 * react-hook-form  register() pattern:
 *   <FormField label="Password" error={errors.password?.message}>
 *     <PasswordInput
 *       {...register('password')}
 *       showStrengthMeter
 *       placeholder="Enter password"
 *     />
 *   </FormField>
 *
 * react-hook-form  Controller pattern:
 *   <Controller
 *     name="password"
 *     control={control}
 *     render={({ field }) => (
 *       <PasswordInput {...field} showStrengthMeter />
 *     )}
 *   />
 */

import { useState, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordInput.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/* ── Strength calculation ────────────────────────────────────────────────── */

function calcStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8)                        score++;
  if (password.length >= 12)                       score++;
  if (/[A-Z]/.test(password))                      score++;
  if (/[a-z]/.test(password))                      score++;
  if (/[0-9]/.test(password))                      score++;
  if (/[^A-Za-z0-9]/.test(password))              score++;
  // Map 0-6 → 0-4
  if (score <= 1) return 1; // Weak
  if (score <= 3) return 2; // Fair
  if (score <= 5) return 3; // Good
  return 4;                  // Strong
}

const STRENGTH_META = {
  0: { label: '',       className: ''                },
  1: { label: 'Weak',   className: styles.strengthWeak   },
  2: { label: 'Fair',   className: styles.strengthFair   },
  3: { label: 'Good',   className: styles.strengthGood   },
  4: { label: 'Strong', className: styles.strengthStrong },
};

/* ── Component ───────────────────────────────────────────────────────────── */

const PasswordInput = forwardRef(function PasswordInput(
  { showStrengthMeter, value, onChange, className, error, disabled, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);

  // When used with register(), `value` may come from the DOM (uncontrolled).
  // We track the live value for the strength meter via the `value` prop when
  // using Controller, or read it directly when not.
  const currentValue = value ?? '';
  const strength     = showStrengthMeter ? calcStrength(currentValue) : 0;
  const meta         = STRENGTH_META[strength];

  return (
    <div className={styles.wrapper}>
      {/* Input row */}
      <div
        className={clx(
          styles.inputRow,
          error    && styles.inputRowError,
          disabled && styles.inputRowDisabled,
        )}
      >
        <input
          {...rest}
          ref={ref}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={clx(styles.input, className)}
          aria-invalid={error ? 'true' : undefined}
          autoComplete="current-password"
        />

        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          disabled={disabled}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {/* Strength meter */}
      {showStrengthMeter && currentValue && (
        <div className={styles.strengthMeter} aria-live="polite">
          <div className={styles.strengthBars}>
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={clx(
                  styles.bar,
                  strength >= level && meta.className,
                )}
              />
            ))}
          </div>
          <span className={clx(styles.strengthLabel, meta.className)}>
            {meta.label}
          </span>
        </div>
      )}
    </div>
  );
});

PasswordInput.propTypes = {
  /** Show the 4-segment strength meter below the input */
  showStrengthMeter: PropTypes.bool,
  value:             PropTypes.string,
  onChange:          PropTypes.func,
  disabled:          PropTypes.bool,
  /** Applies error border (set by FormField automatically via CSS :has) */
  error:             PropTypes.bool,
  placeholder:       PropTypes.string,
  className:         PropTypes.string,
  name:              PropTypes.string,
};

PasswordInput.defaultProps = {
  showStrengthMeter: false,
  value:             undefined,
  onChange:          undefined,
  disabled:          false,
  error:             false,
  placeholder:       'Enter password',
  className:         '',
  name:              '',
};

export default PasswordInput;
