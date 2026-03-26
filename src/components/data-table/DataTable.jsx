import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Search, X, Download,
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import useDebounce from '@/hooks/useDebounce';
import EmptyState from './EmptyState';
import styles from './DataTable.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const clx = (...a) => a.filter(Boolean).join(' ');

/**
 * Build page-number array for the pagination strip.
 * Returns numbers and the string 'ellipsis' as placeholders.
 */
function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [1];

  if (current > 3) pages.push('ellipsis-start');

  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  for (let p = lo; p <= hi; p++) pages.push(p);

  if (current < total - 2) pages.push('ellipsis-end');

  pages.push(total);
  return pages;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort icon
// ─────────────────────────────────────────────────────────────────────────────

function SortIcon({ columnKey, sortKey, sortDir }) {
  if (columnKey !== sortKey) return <ChevronsUpDown size={13} className={styles.sortIconNeutral} />;
  if (sortDir === 'asc')      return <ChevronUp    size={13} className={styles.sortIconActive}  />;
  return                              <ChevronDown  size={13} className={styles.sortIconActive}  />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton row
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRows({ columns, count }) {
  return Array.from({ length: count }, (_, rowIdx) => (
    <tr key={rowIdx} className={styles.row}>
      {columns.map((col) => (
        <td key={col.key} className={styles.cell}>
          <div
            className={styles.skeleton}
            style={{ width: rowIdx % 3 === 0 ? '80%' : rowIdx % 3 === 1 ? '60%' : '70%' }}
          />
        </td>
      ))}
    </tr>
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// DataTable
// ─────────────────────────────────────────────────────────────────────────────

export default function DataTable({
  columns,
  data,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSort,
  onSearch,
  onExport,
  searchPlaceholder,
  emptyStateMessage,
  emptyStateIllustration,
}) {
  // ── Local search state (debounced before firing onSearch) ─────────────────
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearch = useDebounce(searchValue, 300);

  useEffect(() => {
    onSearch?.(debouncedSearch);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sort state (controlled locally; parent is notified via onSort) ─────────
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(null);

  const handleSort = useCallback((key) => {
    let nextDir;
    if (sortKey !== key) {
      nextDir = 'asc';
      setSortKey(key);
    } else if (sortDir === 'asc') {
      nextDir = 'desc';
    } else {
      nextDir = null;
      setSortKey(null);
    }
    setSortDir(nextDir);
    onSort?.(key, nextDir);
  }, [sortKey, sortDir, onSort]);

  // ── Pagination calculations ────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeFrom  = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo    = Math.min(page * pageSize, totalCount);
  const pageList   = buildPageList(page, totalPages);

  const isEmpty = !loading && data.length === 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.tableContainer}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchWrapper}>
            <Search size={15} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label={searchPlaceholder}
            />
            {searchValue && (
              <button
                className={styles.searchClear}
                onClick={() => setSearchValue('')}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {onExport && (
            <button className={styles.exportBtn} onClick={onExport} type="button">
              <Download size={14} />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clx(styles.headerCell, col.sortable && styles.sortableHeader)}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    col.sortable && sortKey === col.key
                      ? sortDir === 'asc' ? 'ascending' : 'descending'
                      : undefined
                  }
                >
                  <span className={styles.headerContent}>
                    {col.label}
                    {col.sortable && (
                      <SortIcon columnKey={col.key} sortKey={sortKey} sortDir={sortDir} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <SkeletonRows columns={columns} count={pageSize} />
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className={styles.emptyCell}>
                  <EmptyState
                    message={emptyStateMessage}
                    illustration={emptyStateIllustration}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row.id ?? rowIndex}
                  className={clx(styles.row, rowIndex % 2 === 1 && styles.rowStriped)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={styles.cell}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!isEmpty && (
        <div className={styles.pagination}>
          {/* Left: info + page-size selector */}
          <div className={styles.paginationLeft}>
            <span className={styles.paginationInfo}>
              {totalCount === 0
                ? 'No results'
                : `Showing ${rangeFrom}–${rangeTo} of ${totalCount} results`}
            </span>

            <label className={styles.pageSizeLabel}>
              <span className={styles.pageSizeText}>Rows:</span>
              <select
                className={styles.pageSizeSelect}
                value={pageSize}
                onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {[10, 25, 50].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Right: page buttons */}
          {totalPages > 1 && (
            <div className={styles.pageButtons}>
              <button
                className={styles.pageButton}
                disabled={page === 1}
                onClick={() => onPageChange?.(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>

              {pageList.map((entry, idx) =>
                typeof entry === 'string' ? (
                  <span key={entry} className={styles.ellipsis}>…</span>
                ) : (
                  <button
                    key={entry}
                    className={clx(styles.pageButton, entry === page && styles.pageButtonActive)}
                    onClick={() => onPageChange?.(entry)}
                    aria-label={`Page ${entry}`}
                    aria-current={entry === page ? 'page' : undefined}
                  >
                    {entry}
                  </button>
                )
              )}

              <button
                className={styles.pageButton}
                disabled={page === totalPages}
                onClick={() => onPageChange?.(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PropTypes
// ─────────────────────────────────────────────────────────────────────────────

DataTable.propTypes = {
  /** Column definitions */
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      /** Dot-notation key mapping to a row field */
      key:      PropTypes.string.isRequired,
      /** Column header label */
      label:    PropTypes.string.isRequired,
      /** Enable sort arrow on this column */
      sortable: PropTypes.bool,
      /** Fixed column width (e.g. "120px") */
      width:    PropTypes.string,
      /** Custom cell renderer: (cellValue, row) => ReactNode */
      render:   PropTypes.func,
    })
  ).isRequired,
  /** Rows to render (current page only) */
  data:        PropTypes.array.isRequired,
  /** Show skeleton loading rows */
  loading:     PropTypes.bool,
  /** Total records across all pages (used for pagination calculation) */
  totalCount:  PropTypes.number,
  /** Current 1-based page number */
  page:        PropTypes.number,
  /** Rows per page */
  pageSize:    PropTypes.number,
  /** Called with new page number */
  onPageChange:     PropTypes.func,
  /** Called with new page size */
  onPageSizeChange: PropTypes.func,
  /** Called with (columnKey, 'asc'|'desc'|null) */
  onSort:           PropTypes.func,
  /** Called with debounced search string */
  onSearch:         PropTypes.func,
  /** If provided, an Export button appears in the toolbar */
  onExport:         PropTypes.func,
  searchPlaceholder:      PropTypes.string,
  emptyStateMessage:      PropTypes.string,
  emptyStateIllustration: PropTypes.node,
};

DataTable.defaultProps = {
  loading:                false,
  totalCount:             0,
  page:                   1,
  pageSize:               10,
  onPageChange:           null,
  onPageSizeChange:       null,
  onSort:                 null,
  onSearch:               null,
  onExport:               null,
  searchPlaceholder:      'Search…',
  emptyStateMessage:      'No records found.',
  emptyStateIllustration: null,
};
