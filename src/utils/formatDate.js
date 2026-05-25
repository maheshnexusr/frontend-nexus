/**
 * formatDate — platform-wide date formatting.
 *
 * Standard: DD-MMM-YYYY with uppercase 3-letter month.
 *   Placeholder: "DD-MMM-YYYY"
 *   Selected:    "12-MAY-2026"
 *
 * Every list/table/modal/runtime surface that renders a date should call
 * `formatDate(value)` so we never drift back to mixed `toLocaleDateString`
 * outputs. Input is permissive: ISO string ("2026-05-12"), full ISO with
 * time ("2026-05-12T14:30:00Z"), a Date instance, or a millisecond timestamp
 * all produce the same string.
 *
 * Returns "" for null / undefined / invalid input — callers can do
 * `formatDate(x) || '—'` to add a placeholder.
 */

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/** "DD-MMM-YYYY" — used as a placeholder string by inputs / pickers. */
export const DATE_PLACEHOLDER = 'DD-MMM-YYYY';

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    // Fast path: bare YYYY-MM-DD — build a local-date object so a "midnight UTC"
    // string from the backend doesn't slide back a day in negative-offset
    // timezones (a recurring bug when piping form date fields through `new Date`).
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mo, d] = m;
      const dt = new Date(Number(y), Number(mo) - 1, Number(d));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

/**
 * Format a date value as DD-MMM-YYYY (e.g. "12-MAY-2026").
 * Returns "" for null / undefined / invalid input.
 */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const day   = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format a date+time as "DD-MMM-YYYY HH:MM" (24-hour). Returns "" for
 * null / undefined / invalid input.
 */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  const datePart = formatDate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hh}:${mm}`;
}

/**
 * Convert any date value to the ISO `YYYY-MM-DD` form needed by native
 * `<input type="date">` controls + axios payloads. Returns "" on invalid
 * input so it's safe to feed directly into a controlled input's `value`.
 */
export function toIsoDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export default formatDate;
