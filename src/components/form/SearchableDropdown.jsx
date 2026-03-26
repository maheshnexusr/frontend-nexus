/**
 * SearchableDropdown — filterable single / multi-select
 *
 * react-hook-form  register() pattern (single):
 *   const { field } = useController({ name: 'status', control });
 *   <FormField label="Status" error={errors.status?.message}>
 *     <SearchableDropdown options={opts} {...field} />
 *   </FormField>
 *
 * react-hook-form  Controller pattern (multi):
 *   <Controller
 *     name="roles"
 *     control={control}
 *     render={({ field }) => (
 *       <SearchableDropdown options={roleOpts} multiple {...field} />
 *     )}
 *   />
 */

import {
  useState, useRef, useEffect, useCallback, useId,
} from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, X, Check, Search, Loader2 } from 'lucide-react';
import useDebounce from '@/hooks/useDebounce';
import styles from './SearchableDropdown.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalise(v) {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function labelOf(options, val) {
  return options.find((o) => o.value === val)?.label ?? val;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  multiple,
  loading,
  disabled,
  error,
  onSearch,
  name,
  onBlur,
}) {
  const id            = useId();
  const containerRef  = useRef(null);
  const searchRef     = useRef(null);
  const listRef       = useRef(null);

  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [highlighted, setHighlighted] = useState(-1);

  const selected    = normalise(value);
  const debQuery    = useDebounce(query, 300);

  // Fire server-side search hook
  useEffect(() => { onSearch?.(debQuery); }, [debQuery]); // eslint-disable-line

  // Client-side filter (used when onSearch is NOT provided)
  const filtered = onSearch
    ? options
    : options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()),
      );

  /* ── Open / close ──────────────────────────────────────────────────────── */
  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setHighlighted(-1);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setQuery('');
    onBlur?.();
  }, [onBlur]);

  // Click-outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeDropdown]);

  /* ── Selection ─────────────────────────────────────────────────────────── */
  const select = (val) => {
    if (multiple) {
      const next = selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val];
      onChange?.(next);
    } else {
      onChange?.(val);
      closeDropdown();
    }
  };

  const removeTag = (val, e) => {
    e.stopPropagation();
    onChange?.(selected.filter((v) => v !== val));
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange?.(multiple ? [] : null);
  };

  /* ── Keyboard ──────────────────────────────────────────────────────────── */
  const handleTriggerKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') { closeDropdown(); return; }

    if (e.key === 'Backspace' && !query && multiple && selected.length) {
      onChange?.(selected.slice(0, -1));
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      select(filtered[highlighted].value);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return;
    const item = listRef.current.children[highlighted];
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  /* ── Derived display ───────────────────────────────────────────────────── */
  const hasValue  = selected.length > 0;
  const singleLabel = !multiple && hasValue ? labelOf(options, selected[0]) : '';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={clx(
        styles.wrapper,
        open     && styles.wrapperOpen,
        error    && styles.wrapperError,
        disabled && styles.wrapperDisabled,
      )}
    >
      {/* ── Trigger ── */}
      <div
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={styles.trigger}
        onClick={openDropdown}
        onKeyDown={handleTriggerKeyDown}
        name={name}
      >
        {/* Multi tags */}
        {multiple && selected.map((v) => (
          <span key={v} className={styles.tag}>
            {labelOf(options, v)}
            <button
              type="button"
              className={styles.tagRemove}
              onClick={(e) => removeTag(v, e)}
              aria-label={`Remove ${labelOf(options, v)}`}
              tabIndex={-1}
            >
              <X size={10} />
            </button>
          </span>
        ))}

        {/* Placeholder / single label */}
        {!multiple && (
          <span className={clx(styles.triggerText, !hasValue && styles.placeholder)}>
            {singleLabel || placeholder}
          </span>
        )}
        {multiple && !hasValue && (
          <span className={styles.placeholder}>{placeholder}</span>
        )}

        {/* Right icons */}
        <span className={styles.triggerIcons}>
          {hasValue && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearAll}
              aria-label="Clear selection"
              tabIndex={-1}
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={15}
            className={clx(styles.chevron, open && styles.chevronOpen)}
          />
        </span>
      </div>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className={styles.dropdown} role="listbox" aria-multiselectable={multiple}>
          {/* Search input */}
          <div className={styles.searchRow}>
            <Search size={14} className={styles.searchIcon} />
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(-1); }}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search options"
            />
          </div>

          {/* Options list */}
          <ul ref={listRef} className={styles.list}>
            {loading ? (
              <li className={styles.loadingRow}>
                <Loader2 size={16} className={styles.spinner} />
                <span>Loading…</span>
              </li>
            ) : filtered.length === 0 ? (
              <li className={styles.emptyRow}>No options found</li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={clx(
                      styles.option,
                      isSelected    && styles.optionSelected,
                      idx === highlighted && styles.optionHighlighted,
                    )}
                    onMouseDown={(e) => { e.preventDefault(); select(opt.value); }}
                    onMouseEnter={() => setHighlighted(idx)}
                  >
                    {opt.icon && <span className={styles.optionIcon}>{opt.icon}</span>}
                    <span className={styles.optionLabel}>{opt.label}</span>
                    {isSelected && <Check size={13} className={styles.checkIcon} />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PropTypes
// ─────────────────────────────────────────────────────────────────────────────

SearchableDropdown.propTypes = {
  options:          PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon:  PropTypes.node,
    }),
  ),
  /** Single value (string) or array of values when multiple=true */
  value:            PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange:         PropTypes.func,
  placeholder:      PropTypes.string,
  searchPlaceholder: PropTypes.string,
  /** Enable multi-select tag mode */
  multiple:         PropTypes.bool,
  /** Show spinner inside dropdown while options are loading */
  loading:          PropTypes.bool,
  disabled:         PropTypes.bool,
  /** Applies error border styling */
  error:            PropTypes.bool,
  /** Called with debounced query string for server-side search */
  onSearch:         PropTypes.func,
  name:             PropTypes.string,
  onBlur:           PropTypes.func,
};

SearchableDropdown.defaultProps = {
  options:           [],
  value:             null,
  onChange:          null,
  placeholder:       'Select…',
  searchPlaceholder: 'Search…',
  multiple:          false,
  loading:           false,
  disabled:          false,
  error:             false,
  onSearch:          null,
  name:              '',
  onBlur:            null,
};
