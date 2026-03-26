/**
 * TextArea — auto-resizing textarea with optional character count
 *
 * react-hook-form  register() pattern:
 *   <FormField label="Description" error={errors.desc?.message}>
 *     <TextArea
 *       {...register('desc')}
 *       maxLength={500}
 *       placeholder="Enter description…"
 *     />
 *   </FormField>
 *
 * react-hook-form  Controller pattern:
 *   <Controller
 *     name="notes"
 *     control={control}
 *     render={({ field }) => (
 *       <FormField label="Notes" error={errors.notes?.message}>
 *         <TextArea {...field} maxLength={1000} />
 *       </FormField>
 *     )}
 *   />
 */

import { forwardRef, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './TextArea.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

const MIN_ROWS = 3;
const MAX_ROWS = 10;

const TextArea = forwardRef(function TextArea(
  {
    value,
    onChange,
    maxLength,
    disabled,
    error,
    placeholder,
    name,
    onBlur,
    className,
    rows,
    ...rest
  },
  forwardedRef,
) {
  // Internal ref for auto-resize; merged with the forwarded ref
  const innerRef = useRef(null);

  const setRefs = useCallback(
    (el) => {
      innerRef.current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef],
  );

  /* ── Auto-resize ─────────────────────────────────────────────────────── */
  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;

    // Reset to min height so shrinkage works
    el.style.height = 'auto';

    const lineHeight  = parseInt(getComputedStyle(el).lineHeight, 10) || 22;
    const paddingTop  = parseInt(getComputedStyle(el).paddingTop, 10)  || 8;
    const paddingBot  = parseInt(getComputedStyle(el).paddingBottom, 10) || 8;

    const minH = MIN_ROWS * lineHeight + paddingTop + paddingBot;
    const maxH = MAX_ROWS * lineHeight + paddingTop + paddingBot;

    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`;
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, []);

  // Re-run resize whenever the value changes (covers Controller / register)
  useEffect(() => { resize(); }, [value, resize]);

  const handleChange = (e) => {
    onChange?.(e);
    resize();
  };

  /* ── Character count ─────────────────────────────────────────────────── */
  const currentLength = typeof value === 'string' ? value.length : 0;
  const nearLimit     = maxLength && currentLength >= maxLength * 0.9;
  const atLimit       = maxLength && currentLength >= maxLength;

  return (
    <div className={styles.wrapper}>
      <textarea
        {...rest}
        ref={setRefs}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        maxLength={maxLength || undefined}
        disabled={disabled}
        placeholder={placeholder}
        rows={MIN_ROWS}
        className={clx(
          styles.textarea,
          error    && styles.textareaError,
          disabled && styles.textareaDisabled,
          className,
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={maxLength ? `${name}-char-count` : undefined}
      />

      {maxLength && (
        <p
          id={`${name}-char-count`}
          className={clx(
            styles.charCount,
            nearLimit && styles.charCountNear,
            atLimit   && styles.charCountAt,
          )}
          aria-live="polite"
        >
          {currentLength} / {maxLength}
        </p>
      )}
    </div>
  );
});

TextArea.propTypes = {
  value:       PropTypes.string,
  onChange:    PropTypes.func,
  /** Maximum character length — enables char counter display */
  maxLength:   PropTypes.number,
  disabled:    PropTypes.bool,
  /** Applies error border styling */
  error:       PropTypes.bool,
  placeholder: PropTypes.string,
  name:        PropTypes.string,
  onBlur:      PropTypes.func,
  className:   PropTypes.string,
  rows:        PropTypes.number,
};

TextArea.defaultProps = {
  value:       undefined,
  onChange:    undefined,
  maxLength:   null,
  disabled:    false,
  error:       false,
  placeholder: '',
  name:        '',
  onBlur:      undefined,
  className:   '',
  rows:        MIN_ROWS,
};

export default TextArea;
