/**
 * TableFieldInput — spreadsheet-like runtime for a Table / Grid field.
 *
 * Value shape (what gets persisted under values[field.id]):
 *   [ { [col.fieldKey]: cellValue, _rowId, _meta:{createdBy,createdAt,updatedBy,updatedAt} }, … ]
 *
 * Features: all 16 column types, inline validation, calculated/formula columns,
 * sticky header, search, per-column sort, pagination, column resize + reorder,
 * comfortable/compact density, add/duplicate/delete rows (gated by config), and
 * row-level audit metadata. Column show/hide/read-only honour col.condition via
 * the shared runtimeEngine. Read-only/locked state is inherited from the parent
 * <fieldset disabled> wrapper in StudyFormRunner.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Plus, Trash2, Copy, Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Table2, Star, X, Paperclip,
} from 'lucide-react';
import { selectCurrentUser } from '@/features/auth/authSlice';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
import { evaluateField } from '@/features/cro/components/study-form/runtime/runtimeEngine';
import { evaluateFormula, grandTotal, validateCell, toNum, colKey } from './tableEngine';
import s from './TableFieldInput.module.css';

const uid = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const nowISO = () => new Date().toISOString();

const isBlankCell = (v) =>
  v === '' || v == null || v === false || (Array.isArray(v) && v.length === 0);

export default function TableFieldInput({ field, value, onChange, allValues, loading = false, showErrors = false }) {
  const user = useSelector(selectCurrentUser);
  const actorName = user?.fullName || user?.full_name || user?.name || user?.email || 'Unknown';

  // Normalise every column to carry a usable, unique fieldKey. Columns authored
  // with a blank/null fieldKey fall back to their unique `key` so cells never
  // share a storage slot (which made one input fill the whole row).
  const columns = useMemo(
    () => (field.columns || []).map((c) => ({ ...c, fieldKey: colKey(c) })),
    [field.columns],
  );
  const rows = Array.isArray(value) ? value : [];

  const rs = field.rowSettings || {};
  const minRows = Number(rs.minRows) || 0;
  const maxRows = rs.maxRows === '' || rs.maxRows == null ? Infinity : Number(rs.maxRows);
  const allowAdd       = field.allowAddRow !== false;
  const allowDelete    = field.allowDeleteRow !== false;
  const allowDuplicate = field.allowDuplicateRow !== false;
  const allowEdit      = field.allowEditRow !== false;     // false → existing cells are read-only
  const showRowNumbers = field.rowNumbering !== false;
  const compact        = field.density === 'compact';

  /* ── Per-column effective state (static + col.condition via runtimeEngine) ──
     Memoised into a { colKey: {hidden,readOnly,required} } map so it's computed
     once per render instead of once per cell — keeps large tables snappy. */
  const colEffMap = useMemo(() => Object.fromEntries(columns.map((col) => [
    col.key,
    evaluateField(
      { condition: col.condition, readOnly: col.readOnly, hiddenByDefault: col.hidden, required: col.required },
      allValues || {},
    ),
  ])), [columns, allValues]);
  const liveColumns = useMemo(() => columns.filter((c) => !colEffMap[c.key]?.hidden), [columns, colEffMap]);

  /* ── Local UI state ──────────────────────────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState({ key: null, dir: 1 });
  const [pageIdx, setPageIdx] = useState(0);
  const [widths, setWidths] = useState({});           // { colKey: px }
  const [order, setOrder]   = useState(null);          // [colKey,…] reorder override
  const [dragKey, setDragKey] = useState(null);

  // Ordered, visible columns (reorder override applied).
  const orderedColumns = useMemo(() => {
    if (!order) return liveColumns;
    const byKey = Object.fromEntries(liveColumns.map((c) => [c.key, c]));
    const front = order.map((k) => byKey[k]).filter(Boolean);
    const rest  = liveColumns.filter((c) => !order.includes(c.key));
    return [...front, ...rest];
  }, [order, liveColumns]);

  /* ── Row factory + formula recompute ─────────────────────────────────────── */
  const blankCell = (col) => {
    if (col.type === 'multiselect') return [];
    if (col.type === 'checkbox')    return false;
    if (col.type === 'rating')      return 0;
    return col.defaultValue ?? '';
  };
  const makeRow = () => {
    const row = { _rowId: uid(), _meta: { createdBy: actorName, createdAt: nowISO(), updatedBy: actorName, updatedAt: nowISO() } };
    columns.forEach((c) => { if (!c.formula?.enabled) row[c.fieldKey] = blankCell(c); });
    return row;
  };
  const recompute = (list) => list.map((row) => {
    let next = row;
    columns.forEach((c) => {
      if (c.formula?.enabled) {
        if (next === row) next = { ...row };
        next[c.fieldKey] = evaluateFormula(c.formula.expr, next, list, columns);
      }
    });
    return next;
  });
  const commit = (list) => {
    let next = list;
    if (rs.autoAddEmptyRow && next.length < maxRows) {
      const last = next[next.length - 1];
      const lastFilled = last && columns.some((c) => !c.formula?.enabled && !isBlankCell(last[c.fieldKey]));
      if (!next.length || lastFilled) next = [...next, makeRow()];
    }
    onChange(recompute(next));
  };

  /* ── Default rows ─────────────────────────────────────────────────────────
     Seed `defaultRowCount` (min `minRows`) blank rows on first open. Also
     re-apply when the designer changes the count WHILE every current row is
     still blank — so setting it to 0 in the builder actually clears the seeded
     row. Rows the user has typed into are never touched. */
  const allRowsBlank = (list) => list.every((r) =>
    columns.every((c) => c.formula?.enabled || isBlankCell(r?.[c.fieldKey])));
  useEffect(() => {
    const desired = Math.max(Number(rs.defaultRowCount) || 0, minRows);
    if (value == null) {
      if (desired > 0) onChange(recompute(Array.from({ length: desired }, makeRow)));
      return;
    }
    if (Array.isArray(value) && value.length !== desired && allRowsBlank(value)) {
      onChange(recompute(Array.from({ length: desired }, makeRow)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rs.defaultRowCount, minRows]);

  /* ── Mutations (operate by _rowId so search/sort/paging stay correct) ────── */
  const setCell = (rowId, key, val) => commit(rows.map((r) =>
    r._rowId === rowId
      ? { ...r, [key]: val, _meta: { ...r._meta, updatedBy: actorName, updatedAt: nowISO() } }
      : r,
  ));
  const addRow = () => { if (allowAdd && rows.length < maxRows) commit([...rows, makeRow()]); };
  const duplicateRow = (rowId) => {
    if (!allowDuplicate || rows.length >= maxRows) return;
    const src = rows.find((r) => r._rowId === rowId);
    if (!src) return;
    const clone = { ...src, _rowId: uid(), _meta: { createdBy: actorName, createdAt: nowISO(), updatedBy: actorName, updatedAt: nowISO() } };
    const i = rows.findIndex((r) => r._rowId === rowId);
    commit([...rows.slice(0, i + 1), clone, ...rows.slice(i + 1)]);
  };
  const deleteRow = (rowId) => { if (allowDelete && rows.length > minRows) commit(rows.filter((r) => r._rowId !== rowId)); };

  /* ── Column resize ───────────────────────────────────────────────────────── */
  const resizing = useRef(null);
  const startResize = (e, col) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = { key: col.key, startX: e.clientX, startW: widths[col.key] ?? col.width ?? 160 };
    const onMove = (ev) => {
      if (!resizing.current) return;
      const w = Math.max(60, resizing.current.startW + (ev.clientX - resizing.current.startX));
      setWidths((prev) => ({ ...prev, [resizing.current.key]: w }));
    };
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /* ── Column reorder (HTML5 DnD on headers) ───────────────────────────────── */
  const dropOnCol = (targetKey) => {
    if (!dragKey || dragKey === targetKey) { setDragKey(null); return; }
    const cur = (order || liveColumns.map((c) => c.key));
    const from = cur.indexOf(dragKey);
    const to   = cur.indexOf(targetKey);
    if (from === -1 || to === -1) { setDragKey(null); return; }
    const arr = [...cur];
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    setOrder(arr);
    setDragKey(null);
  };

  /* ── Search → sort → paginate (view only; edits map back via _rowId) ─────── */
  const cellText = (row, col) => {
    const v = row?.[col.fieldKey];
    if (Array.isArray(v)) return v.join(', ');
    if (v == null) return '';
    return String(v);
  };
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => orderedColumns.some((c) => cellText(r, c).toLowerCase().includes(q)));
  }, [rows, search, orderedColumns]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.fieldKey === sort.key);
    const numeric = col && ['number', 'currency', 'rating', 'formula'].includes(col.type);
    return [...filtered].sort((a, b) => {
      const av = a?.[sort.key]; const bv = b?.[sort.key];
      const cmp = numeric ? toNum(av) - toNum(bv) : String(av ?? '').localeCompare(String(bv ?? ''));
      return cmp * sort.dir;
    });
  }, [filtered, sort, columns]);

  const pgEnabled = !!field.pagination?.enabled;
  const pageSize  = Math.max(1, Number(field.pagination?.pageSize) || 25);
  const pageCount = pgEnabled ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const curPage   = Math.min(pageIdx, pageCount - 1);
  const pageRows  = pgEnabled ? sorted.slice(curPage * pageSize, curPage * pageSize + pageSize) : sorted;

  const toggleSort = (key) => setSort((p) => (p.key === key ? { key, dir: -p.dir } : { key, dir: 1 }));

  /* ── Validation (computed once per render; reused by every cell) ───────────
     "Required & empty" cells are held back until the user tries to submit
     (showErrors) — matching how the rest of the form defers its mandatory
     flags. Cells the user actually filled with an invalid value always flag. */
  const validation = useMemo(() => {
    const errors = {}; let count = 0;
    rows.forEach((r) => liveColumns.forEach((c) => {
      const val = r?.[c.fieldKey];
      const msg = validateCell(c, val, r, rows);
      if (!msg) return;
      const requiredEmpty = c.required && isBlankCell(val);
      if (requiredEmpty && !showErrors) return;       // defer until submit attempt
      (errors[r._rowId] ??= {})[c.fieldKey] = msg; count += 1;
    }));
    return { errors, count };
  }, [rows, liveColumns, showErrors]);
  const errorCount = validation.count;

  const footerCols = orderedColumns.filter((c) => c.formula?.enabled && c.formula?.grandTotal);

  /* ── Render ──────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={s.stateBox}>
        <div className={s.spinner} />
        <span>Loading table…</span>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      {/* Toolbar */}
      <div className={s.toolbar}>
        <div className={s.searchBox}>
          <Search size={13} className={s.searchIcon} />
          <input
            className={s.searchInput}
            placeholder="Search rows…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPageIdx(0); }}
          />
        </div>
        <span className={s.rowCount}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
        {errorCount > 0 && <span className={s.errBadge}>{errorCount} issue{errorCount !== 1 ? 's' : ''}</span>}
        <span className={s.spacer} />
        {allowAdd && (
          <button type="button" className={s.addRowBtn} onClick={addRow} disabled={rows.length >= maxRows}>
            <Plus size={13} /> Add row
          </button>
        )}
      </div>

      {/* Grid — column headers are ALWAYS shown so the designed structure is
          visible even before the user adds any rows. */}
      <div className={`${s.scroller} ${compact ? s.compact : ''}`}>
          <table className={s.table}>
            <thead>
              <tr>
                {showRowNumbers && <th className={`${s.th} ${s.thNum}`}>#</th>}
                {orderedColumns.map((col) => (
                  <th
                    key={col.key}
                    className={s.th}
                    style={{ width: widths[col.key] ?? col.width ?? 160 }}
                    draggable
                    onDragStart={() => setDragKey(col.key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOnCol(col.key)}
                  >
                    <span className={s.thInner}>
                      <button type="button" className={s.thLabel} onClick={() => toggleSort(col.fieldKey)}>
                        {col.label || col.fieldKey}
                        {col.required && <span className={s.req}>*</span>}
                        {sort.key === col.fieldKey
                          ? (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                          : <ChevronsUpDown size={12} className={s.sortIdle} />}
                      </button>
                      <span className={s.resizeHandle} onMouseDown={(e) => startResize(e, col)} />
                    </span>
                  </th>
                ))}
                {(allowDelete || allowDuplicate) && <th className={`${s.th} ${s.thActions}`} />}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td className={s.emptyCell} colSpan={(showRowNumbers ? 1 : 0) + orderedColumns.length + ((allowDelete || allowDuplicate) ? 1 : 0)}>
                    <Table2 size={22} strokeWidth={1.25} className={s.emptyIcon} />
                    <span className={s.emptyTitle}>{search ? 'No rows match your search' : 'No rows yet'}</span>
                    {allowAdd && !search && (
                      <button type="button" className={s.addRowBtn} onClick={addRow}><Plus size={13} /> Add first row</button>
                    )}
                  </td>
                </tr>
              )}
              {pageRows.map((row) => {
                const absIdx = rows.findIndex((r) => r._rowId === row._rowId);
                return (
                  <tr key={row._rowId}>
                    {showRowNumbers && <td className={`${s.td} ${s.tdNum}`}>{absIdx + 1}</td>}
                    {orderedColumns.map((col) => {
                      const eff = colEffMap[col.key] || {};
                      const err = validation.errors[row._rowId]?.[col.fieldKey];
                      return (
                        <td key={col.key} className={`${s.td} ${err ? s.tdError : ''}`} title={err || undefined}>
                          <TableCell
                            col={col}
                            name={`${row._rowId}_${col.key}`}
                            value={row[col.fieldKey]}
                            readOnly={eff.readOnly || !allowEdit}
                            onChange={(v) => setCell(row._rowId, col.fieldKey, v)}
                          />
                        </td>
                      );
                    })}
                    {(allowDelete || allowDuplicate) && (
                      <td className={`${s.td} ${s.tdActions}`}>
                        {allowDuplicate && (
                          <button type="button" className={s.rowBtn} title="Duplicate row" onClick={() => duplicateRow(row._rowId)} disabled={rows.length >= maxRows}>
                            <Copy size={13} />
                          </button>
                        )}
                        {allowDelete && (
                          <button type="button" className={`${s.rowBtn} ${s.rowBtnDanger}`} title="Delete row" onClick={() => deleteRow(row._rowId)} disabled={rows.length <= minRows}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {footerCols.length > 0 && (
              <tfoot>
                <tr>
                  {showRowNumbers && <td className={`${s.td} ${s.tdFoot}`} />}
                  {orderedColumns.map((col) => (
                    <td key={col.key} className={`${s.td} ${s.tdFoot}`}>
                      {footerCols.includes(col) ? <strong>{Math.round(grandTotal(col, rows, columns) * 1e4) / 1e4}</strong> : null}
                    </td>
                  ))}
                  {(allowDelete || allowDuplicate) && <td className={`${s.td} ${s.tdFoot}`} />}
                </tr>
              </tfoot>
            )}
          </table>
      </div>

      {/* Pagination */}
      {pgEnabled && sorted.length > pageSize && (
        <div className={s.pager}>
          <button type="button" className={s.pageBtn} disabled={curPage === 0} onClick={() => setPageIdx(curPage - 1)}><ChevronLeft size={14} /></button>
          <span className={s.pageInfo}>Page {curPage + 1} of {pageCount}</span>
          <button type="button" className={s.pageBtn} disabled={curPage >= pageCount - 1} onClick={() => setPageIdx(curPage + 1)}><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}

/* ── Per-cell input by column type ──────────────────────────────────────────*/
function TableCell({ col, value, onChange, readOnly, name }) {
  const ro = readOnly || col.formula?.enabled;
  const base = s.cellInput;

  if (col.formula?.enabled) {
    return <span className={s.cellFormula}>{value === '' || value == null ? '—' : value}</span>;
  }

  switch (col.type) {
    case 'textarea':
      return <textarea className={s.cellTextarea} rows={1} value={value ?? ''} disabled={ro} placeholder={col.placeholder || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
    case 'currency':
      return (
        <span className={col.type === 'currency' ? s.currencyWrap : undefined}>
          {col.type === 'currency' && <span className={s.currencySign}>$</span>}
          <input type="number" className={base} value={value ?? ''} disabled={ro} placeholder={col.placeholder || ''} onChange={(e) => onChange(e.target.value)} />
        </span>
      );
    case 'email':
    case 'phone':
    case 'url':
      return <input type={col.type === 'phone' ? 'tel' : col.type === 'url' ? 'url' : 'email'} className={base} value={value ?? ''} disabled={ro} placeholder={col.placeholder || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <PlatformDatePicker value={value ?? ''} onChange={onChange} disabled={ro} />;
    case 'datetime':
      return <input type="datetime-local" className={base} value={value ?? ''} disabled={ro} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select className={base} value={value ?? ''} disabled={ro} onChange={(e) => onChange(e.target.value)}>
          <option value="">{col.placeholder || 'Select…'}</option>
          {(col.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'multiselect': {
      const sel = Array.isArray(value) ? value : [];
      return (
        <select
          className={base}
          multiple
          size={Math.min(4, Math.max(2, (col.options || []).length))}
          value={sel}
          disabled={ro}
          onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
        >
          {(col.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case 'radiogroup':
      return (
        <span className={s.cellChoices}>
          {(col.options || []).map((o) => (
            <label key={o.value} className={s.cellRadio}>
              <input type="radio" name={name} checked={value === o.value} disabled={ro} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </span>
      );
    case 'checkbox':
      return <input type="checkbox" className={s.cellCheckbox} checked={!!value} disabled={ro} onChange={(e) => onChange(e.target.checked)} />;
    case 'rating': {
      const r = Number(value) || 0;
      return (
        <span className={s.cellStars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={15} className={s.starIcon} style={{ color: n <= r ? '#f59e0b' : '#cbd5e1', cursor: ro ? 'default' : 'pointer' }} onClick={() => !ro && onChange(n)} />
          ))}
        </span>
      );
    }
    case 'file':
      return <FileCell value={value} onChange={onChange} disabled={ro} />;
    default:
      return <input type="text" className={base} value={value ?? ''} disabled={ro} placeholder={col.placeholder || ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

/* Compact file cell — stores { name, dataUrl } inline (Phase 1, no disk upload). */
function FileCell({ value, onChange, disabled }) {
  const inputRef = useRef(null);
  const pick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  };
  if (value?.name) {
    return (
      <span className={s.fileChip} title={value.name}>
        <Paperclip size={12} /> <span className={s.fileName}>{value.name}</span>
        {!disabled && <button type="button" className={s.fileX} onClick={() => onChange('')}><X size={11} /></button>}
      </span>
    );
  }
  return (
    <>
      <button type="button" className={s.fileBtn} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Paperclip size={12} /> Upload
      </button>
      <input ref={inputRef} type="file" hidden onChange={pick} />
    </>
  );
}
