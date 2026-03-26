import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after
 * `delay` ms have elapsed without a new value being supplied.
 *
 * @param {*}      value - Value to debounce.
 * @param {number} delay - Delay in milliseconds (default 300).
 * @returns {*} Debounced value.
 */
export default function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
