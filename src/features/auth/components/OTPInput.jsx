/**
 * OTPInput — 6-box one-time password input
 *
 * Features:
 *   - Auto-advance focus on digit entry
 *   - Backspace clears current box and moves to previous
 *   - Arrow keys navigate boxes
 *   - Paste splits digits across all boxes
 *   - Calls onComplete(otp) when all boxes are filled
 *   - autoComplete="one-time-code" on first box (iOS/Android SMS autofill)
 */

import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './OTPInput.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

export default function OTPInput({
  length,
  onComplete,
  onChange,
  disabled,
  error,
}) {
  const [values, setValues]   = useState(() => Array(length).fill(''));
  const inputRefs             = useRef([]);

  const focusAt = useCallback((i) => {
    const el = inputRefs.current[i];
    if (el) { el.focus(); el.select(); }
  }, []);

  const commit = useCallback((next) => {
    setValues(next);
    const joined = next.join('');
    onChange?.(joined);
    if (next.every((v) => v !== '')) {
      onComplete?.(joined);
    }
  }, [onChange, onComplete]);

  const handleChange = (i, e) => {
    // Accept only the last digit typed (handles paste-in-box too)
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    const next  = [...values];
    next[i]     = digit;
    commit(next);
    if (digit && i < length - 1) focusAt(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...values];
      if (next[i]) {
        next[i] = '';
        commit(next);
      } else if (i > 0) {
        next[i - 1] = '';
        commit(next);
        focusAt(i - 1);
      }
    } else if (e.key === 'ArrowLeft'  && i > 0)          focusAt(i - 1);
      else if (e.key === 'ArrowRight' && i < length - 1) focusAt(i + 1);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length);
    if (!pasted) return;
    const next = Array(length).fill('');
    pasted.split('').forEach((c, idx) => { next[idx] = c; });
    commit(next);
    focusAt(Math.min(pasted.length, length - 1));
  };

  return (
    <div
      className={styles.row}
      onPaste={handlePaste}
      role="group"
      aria-label="One-time password input"
    >
      {values.map((v, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={v}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={clx(
            styles.box,
            v        && styles.boxFilled,
            error    && styles.boxError,
            disabled && styles.boxDisabled,
          )}
          aria-label={`Digit ${i + 1} of ${length}`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
        />
      ))}
    </div>
  );
}

OTPInput.propTypes = {
  length:     PropTypes.number,
  onComplete: PropTypes.func,
  onChange:   PropTypes.func,
  disabled:   PropTypes.bool,
  error:      PropTypes.bool,
};

OTPInput.defaultProps = {
  length:     6,
  onComplete: null,
  onChange:   null,
  disabled:   false,
  error:      false,
};
