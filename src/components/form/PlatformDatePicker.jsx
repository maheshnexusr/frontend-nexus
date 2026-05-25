/**
 * PlatformDatePicker — custom date picker used everywhere a date is captured.
 *
 * Trigger button shows the platform-standard `DD-MMM-YYYY` (e.g. "12-MAY-2026")
 * or the placeholder, with a calendar icon on the right. Clicking opens a
 * popover calendar anchored to the trigger.
 *
 * Popover has three stacked views the user can switch between via the header
 * label:
 *   - "days"   (default) — month grid with weekday columns
 *   - "months" — 4×3 grid of month names for the current year
 *   - "years"  — 4×3 grid of years, paginated 12 at a time
 *
 * The popover renders into `document.body` via createPortal so it's never
 * clipped by overflow:hidden ancestors (modals, drawers, scrollable tables).
 * Closes on outside click and Escape.
 *
 * API mirrors `<input type="date">`:
 *   <PlatformDatePicker
 *     value="2026-05-12"
 *     onChange={(iso) => …}
 *     min="2020-01-01"
 *     max="2030-12-31"
 *     disabled={false}
 *     placeholder="DD-MMM-YYYY"
 *     error={false}
 *   />
 *
 * onChange is called with the ISO string. The codebase's common
 * `set(field) => (e)` helpers already accept either a value or an event, so a
 * bare string is the safer default.
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DATE_PLACEHOLDER, formatDate, toIsoDate } from '@/utils/formatDate';
import s from './PlatformDatePicker.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

const MONTHS_LONG  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS     = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const POPOVER_W = 296;
const POPOVER_H = 332;

/** Parse a "YYYY-MM-DD" or full ISO string into a local Date, or null. */
function parseIsoToLocalDate(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function sameDay(a, b) {
  return !!a && !!b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth()    === b.getMonth()
    && a.getDate()     === b.getDate();
}
function sameMonth(a, b) {
  return !!a && !!b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth()    === b.getMonth();
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addMonths(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return x;
}
function addYears(d, n) {
  return new Date(d.getFullYear() + n, d.getMonth(), 1);
}

/** Monday-first weekday index (0 = Mon … 6 = Sun). */
function mondayIndex(day) {
  return (day + 6) % 7;
}

/**
 * Build a 6×7 day grid for the month `view`. Each cell carries its Date and
 * whether it belongs to the current month so styling can mute outside days.
 */
function buildMonthGrid(view) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const lead  = mondayIndex(first.getDay());
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, currentMonth: d.getMonth() === view.getMonth() });
  }
  return cells;
}

/**
 * Position the popover so it stays inside the viewport: prefer below the
 * trigger, flip above if there's no room, and clamp to the left/right edges.
 */
function computePopoverPos(triggerRect) {
  const gap = 4;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const spaceBelow = vh - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  const wantBelow  = spaceBelow >= POPOVER_H + gap || spaceBelow >= spaceAbove;
  const top = wantBelow
    ? Math.min(triggerRect.bottom + gap, vh - POPOVER_H - 4)
    : Math.max(triggerRect.top - POPOVER_H - gap, 4);
  let left = triggerRect.left;
  if (left + POPOVER_W > vw - 4) left = Math.max(4, vw - POPOVER_W - 4);
  if (left < 4) left = 4;
  return { top, left };
}

export default function PlatformDatePicker({
  value, onChange,
  min, max, disabled, error,
  placeholder, name, onBlur, className,
  id, autoFocus,
}) {
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState(null);
  const [mode, setMode] = useState('days'); // 'days' | 'months' | 'years'
  const [view, setView] = useState(() => parseIsoToLocalDate(value) ?? new Date());

  const selected = useMemo(() => parseIsoToLocalDate(value), [value]);
  const fromDate = useMemo(() => {
    const d = parseIsoToLocalDate(min);
    return d ? startOfDay(d) : null;
  }, [min]);
  const toDate = useMemo(() => {
    const d = parseIsoToLocalDate(max);
    return d ? startOfDay(d) : null;
  }, [max]);

  const display = formatDate(value);
  const today   = useMemo(() => startOfDay(new Date()), []);

  // Refresh the displayed month whenever the controlled value changes externally.
  useEffect(() => {
    if (selected) setView(selected);
  }, [selected]);

  // Reset to day view each time the popover opens so the user always lands on
  // the calendar, not whichever sub-view was last left behind.
  useEffect(() => {
    if (open) setMode('days');
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    if (onBlur) onBlur({ target: { name, value: value ?? '' } });
  }, [onBlur, name, value]);

  // Position on open + on window resize / scroll.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const reposition = () => {
      const el = triggerRef.current;
      if (!el) return;
      setPos(computePopoverPos(el.getBoundingClientRect()));
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  // Outside-click + Escape to close.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const t = e.target;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown',   onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  const emit = (iso) => {
    if (onChange) onChange(iso);
  };

  const handleSelectDay = (date) => {
    if (!date) { emit(''); close(); return; }
    emit(toIsoDate(date));
    close();
  };

  const handleToday = () => {
    if (!isDayAllowed(today)) return;
    handleSelectDay(today);
  };

  const handleClear = () => { emit(''); close(); };

  // ─── Day / month / year availability vs. min & max ──────────────────────
  function isDayAllowed(d) {
    const t = startOfDay(d).getTime();
    if (fromDate && t < fromDate.getTime()) return false;
    if (toDate   && t > toDate.getTime())   return false;
    return true;
  }
  function isMonthAllowed(year, month) {
    // A month is reachable if any day in it is allowed.
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd   = new Date(year, month + 1, 0).getTime();
    if (fromDate && monthEnd   < fromDate.getTime()) return false;
    if (toDate   && monthStart > toDate.getTime())   return false;
    return true;
  }
  function isYearAllowed(year) {
    const yStart = new Date(year, 0, 1).getTime();
    const yEnd   = new Date(year, 11, 31).getTime();
    if (fromDate && yEnd   < fromDate.getTime()) return false;
    if (toDate   && yStart > toDate.getTime())   return false;
    return true;
  }

  // ─── Header nav (prev/next) — meaning shifts with the current mode ──────
  const navStep = (dir) => {
    if (mode === 'days')   setView(addMonths(view, dir));
    if (mode === 'months') setView(addYears(view,  dir));
    if (mode === 'years')  setView(addYears(view,  dir * 12));
  };

  const canPrev = (() => {
    if (!fromDate) return true;
    if (mode === 'days')   return addMonths(view, -1).getFullYear()      >= fromDate.getFullYear()
                              || (addMonths(view, -1).getFullYear() === fromDate.getFullYear()
                                  && addMonths(view, -1).getMonth() >= fromDate.getMonth());
    if (mode === 'months') return view.getFullYear() - 1 >= fromDate.getFullYear();
    if (mode === 'years')  return yearGridStart(view) - 1 >= fromDate.getFullYear();
    return true;
  })();
  const canNext = (() => {
    if (!toDate) return true;
    if (mode === 'days')   return addMonths(view, 1).getFullYear()      <= toDate.getFullYear()
                              || (addMonths(view, 1).getFullYear() === toDate.getFullYear()
                                  && addMonths(view, 1).getMonth() <= toDate.getMonth());
    if (mode === 'months') return view.getFullYear() + 1 <= toDate.getFullYear();
    if (mode === 'years')  return yearGridStart(view) + 12 <= toDate.getFullYear();
    return true;
  })();

  const days   = useMemo(() => buildMonthGrid(view), [view]);
  const ySpan  = useMemo(() => {
    const start = yearGridStart(view);
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [view]);

  const headerLabel = mode === 'days'
    ? `${MONTHS_LONG[view.getMonth()]} ${view.getFullYear()}`
    : mode === 'months'
      ? String(view.getFullYear())
      : `${ySpan[0]} – ${ySpan[ySpan.length - 1]}`;

  const onHeaderClick = () => {
    if (mode === 'days')   setMode('months');
    else if (mode === 'months') setMode('years');
    else setMode('days');
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        name={name}
        className={clx(
          s.trigger,
          !display && s.triggerPlaceholder,
          error    && s.triggerError,
          disabled && s.triggerDisabled,
          open     && s.triggerOpen,
          className,
        )}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? 'true' : undefined}
        autoFocus={autoFocus}
      >
        <span className={s.triggerText}>{display || placeholder || DATE_PLACEHOLDER}</span>
        <CalendarDays size={14} className={s.triggerIcon} aria-hidden="true" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className={s.popover}
          style={{ top: pos.top, left: pos.left }}
          role="dialog"
          aria-label="Choose date"
        >
          <div className={s.header}>
            <button
              type="button"
              className={s.headerLabel}
              onClick={onHeaderClick}
              aria-label={
                mode === 'days'   ? 'Switch to month picker'
                : mode === 'months' ? 'Switch to year picker'
                : 'Back to calendar'
              }
            >
              {headerLabel}
            </button>
            <div className={s.headerNav}>
              <button
                type="button"
                className={s.navBtn}
                onClick={() => navStep(-1)}
                disabled={!canPrev}
                aria-label="Previous"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={s.navBtn}
                onClick={() => navStep(1)}
                disabled={!canNext}
                aria-label="Next"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {mode === 'days' && (
            <div className={s.daysWrap}>
              <div className={s.weekdays}>
                {WEEKDAYS.map((w) => (
                  <div key={w} className={s.weekday}>{w}</div>
                ))}
              </div>
              <div className={s.dayGrid}>
                {days.map(({ date, currentMonth }) => {
                  const isSel  = sameDay(date, selected);
                  const isTdy  = sameDay(date, today);
                  const allow  = isDayAllowed(date);
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      className={clx(
                        s.day,
                        !currentMonth && s.dayOutside,
                        isTdy  && s.dayToday,
                        isSel  && s.daySelected,
                        !allow && s.dayDisabled,
                      )}
                      onClick={() => allow && handleSelectDay(date)}
                      disabled={!allow}
                      tabIndex={currentMonth ? 0 : -1}
                      aria-pressed={isSel}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'months' && (
            <div className={s.gridQuarters}>
              {MONTHS_SHORT.map((label, idx) => {
                const isSel  = !!selected
                  && selected.getFullYear() === view.getFullYear()
                  && selected.getMonth()    === idx;
                const isCur  = sameMonth(today, new Date(view.getFullYear(), idx, 1));
                const allow  = isMonthAllowed(view.getFullYear(), idx);
                return (
                  <button
                    key={label}
                    type="button"
                    className={clx(
                      s.tile,
                      isCur  && s.tileToday,
                      isSel  && s.tileSelected,
                      !allow && s.tileDisabled,
                    )}
                    onClick={() => {
                      if (!allow) return;
                      setView(new Date(view.getFullYear(), idx, 1));
                      setMode('days');
                    }}
                    disabled={!allow}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {mode === 'years' && (
            <div className={s.gridQuarters}>
              {ySpan.map((y) => {
                const isSel  = !!selected && selected.getFullYear() === y;
                const isCur  = today.getFullYear() === y;
                const allow  = isYearAllowed(y);
                return (
                  <button
                    key={y}
                    type="button"
                    className={clx(
                      s.tile,
                      isCur  && s.tileToday,
                      isSel  && s.tileSelected,
                      !allow && s.tileDisabled,
                    )}
                    onClick={() => {
                      if (!allow) return;
                      setView(new Date(y, view.getMonth(), 1));
                      setMode('months');
                    }}
                    disabled={!allow}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          <div className={s.footer}>
            <button
              type="button"
              className={s.footerLink}
              onClick={handleToday}
              disabled={!isDayAllowed(today)}
            >
              Today
            </button>
            {selected && (
              <button type="button" className={s.footerLinkSubtle} onClick={handleClear}>
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** First year of the 12-cell year grid that contains `view`. Anchored on
 * 12-year buckets (e.g. 1980-1991, 1992-2003) so navigation is predictable. */
function yearGridStart(view) {
  const y = view.getFullYear();
  return y - (y % 12);
}

PlatformDatePicker.propTypes = {
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
  id:          PropTypes.string,
  autoFocus:   PropTypes.bool,
};

PlatformDatePicker.defaultProps = {
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
  id:          undefined,
  autoFocus:   false,
};
