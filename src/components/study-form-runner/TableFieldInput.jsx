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
import { evaluateFormula, grandTotal, toNum, colKey, evaluateRowColumn, rowColumnValueAction, isRatingMatrix } from './tableEngine';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
import RatingMatrixInput from './RatingMatrixInput';
import s from './TableFieldInput.module.css';

const uid = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const nowISO = () => new Date().toISOString();

const isBlankCell = (v) =>
  v === '' || v == null || v === false || (Array.isArray(v) && v.length === 0);

export default function TableFieldInput({ field, value, onChange, allValues, loading = false, showErrors = false }) {
  // Rating-matrix mode is a fixed survey/Likert grid (object value, one radio
  // selection per row) rather than the repeating spreadsheet below.
  if (isRatingMatrix(field)) {
    return <RatingMatrixInput field={field} value={value} onChange={onChange} showErrors={showErrors} />;
  }
  return <StandardTableFieldInput field={field} value={value} onChange={onChange} allValues={allValues} loading={loading} showErrors={showErrors} />;
}

function StandardTableFieldInput({ field, value, onChange, allValues, loading = false, showErrors = false }) {
  const user = useSelector(selectCurrentUser);
  const actorName = user?.fullName || user?.full_name || user?.name || user?.email || 'Unknown';

  // Normalise every column to carry a usable, unique fieldKey. Columns authored
  // with a blank/null fieldKey fall back to their unique `key` so cells never
  // share a storage slot (which made one input fill the whole row).
  const columns = useMemo(
    () => (field.columns || []).map((c) => ({ ...c, fieldKey: colKey(c) })),
    [field.columns],
  );
  // Normalise every row to carry a stable `_rowId`. The form-data save path
  // deep-snake-cases the answer blob, so a persisted `_rowId` comes back as
  // `_row_id` (and a response camel-pass would make it `RowId`) — i.e. lost. All
  // mutations, the row-number index and the per-row clear/set edge tracking key
  // on `_rowId`, so a missing one breaks editing reloaded data. Recover it from
  // either casing, else mint a fresh one, so saved tables reload fully editable.
  const rows = useMemo(() => {
    if (!Array.isArray(value)) return [];
    return value.map((r) => {
      if (!r || typeof r !== 'object') return { _rowId: uid() };
      if (r._rowId) return r;
      const recovered = r._row_id ?? r.RowId ?? r.rowId;
      return { ...r, _rowId: recovered || uid() };
    });
  }, [value]);

  // The capture runtime serves the form structure SNAKE_CASE (row_settings /
  // min_rows / allow_add_row …) while the builder authors camelCase — so every
  // table-config prop must be read in BOTH casings or it silently falls back to
  // its default (e.g. Minimum Row = 1 was ignored → no row seeded). See
  // [[form-structure-snake-camel-runtime]].
  const fp = (camel, snake) => field[camel] ?? field[snake];
  const rs = field.rowSettings ?? field.row_settings ?? {};
  const rsp = (camel, snake) => rs[camel] ?? rs[snake];
  const minRows = Number(rsp('minRows', 'min_rows')) || 0;
  const maxRowsRaw = rsp('maxRows', 'max_rows');
  const maxRows = maxRowsRaw === '' || maxRowsRaw == null ? Infinity : Number(maxRowsRaw);
  const allowAdd       = fp('allowAddRow', 'allow_add_row') !== false;
  const allowDelete    = fp('allowDeleteRow', 'allow_delete_row') !== false;
  const allowDuplicate = fp('allowDuplicateRow', 'allow_duplicate_row') !== false;
  const allowEdit      = fp('allowEditRow', 'allow_edit_row') !== false;  // false → existing cells read-only
  const showRowNumbers = fp('rowNumbering', 'row_numbering') !== false;
  const compact        = fp('density', 'density') === 'compact';

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

  /* ── Per-ROW effective state ────────────────────────────────────────────────
     Merge the table-scope state (form-field col.condition, above) with the
     per-row rules (sibling-column driven). Computed per (row, col): a checkbox
     in one row can make sibling cells read-only / hidden / required only in THAT
     row. Disable folds into read-only for the cell input. */
  const rowColEff = (col, row) => {
    const base = colEffMap[col.key] || {};
    const rr = evaluateRowColumn(col, row, columns);
    return {
      hidden:   base.hidden || rr.hidden,
      readOnly: base.readOnly || rr.readOnly || rr.disabled,
      required: rr.required,
      disabled: rr.disabled,
    };
  };

  /* ── Local UI state ──────────────────────────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState({ key: null, dir: 1 });
  const [pageIdx, setPageIdx] = useState(0);
  const [widths, setWidths] = useState({});           // { colKey: px }
  const [order, setOrder]   = useState(null);          // [colKey,…] reorder override
  const [dragKey, setDragKey] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);  // row pending delete-confirm

  // Ordered, visible columns (reorder override applied).
  const orderedColumns = useMemo(() => {
    if (!order) return liveColumns;
    const byKey = Object.fromEntries(liveColumns.map((c) => [c.key, c]));
    const front = order.map((k) => byKey[k]).filter(Boolean);
    const rest  = liveColumns.filter((c) => !order.includes(c.key));
    return [...front, ...rest];
  }, [order, liveColumns]);

  /* ── Rank columns (unique rank per row) ──────────────────────────────────────
     A `rank` column offers Rank 1…N where N = the CURRENT row count, and each
     rank may be assigned to only ONE row. Precompute, per rank column, which rank
     value is held by which row (`{ rankValue: _rowId }`) so a taken rank can be
     disabled in every OTHER row's dropdown while the owning row still shows its
     own. Recomputed from `rows` on every change, so changing/clearing a rank frees
     it immediately and adding/deleting a row regrows the 1…N range. Keyed per
     column, so multiple rank columns rank independently. */
  const rankTaken = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      if (col.type !== 'rank') return;
      const byVal = {};
      rows.forEach((r) => {
        const v = r?.[col.fieldKey];
        if (v !== '' && v != null) byVal[String(v)] = r._rowId;
      });
      map[col.fieldKey] = byVal;
    });
    return map;
  }, [columns, rows]);

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
    if (rsp('autoAddEmptyRow', 'auto_add_empty_row') && next.length < maxRows) {
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
    const desired = Math.max(Number(rsp('defaultRowCount', 'default_row_count')) || 0, minRows);
    if (value == null) {
      if (desired > 0) onChange(recompute(Array.from({ length: desired }, makeRow)));
      return;
    }
    if (Array.isArray(value) && value.length !== desired && allRowsBlank(value)) {
      onChange(recompute(Array.from({ length: desired }, makeRow)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rs.defaultRowCount, minRows]);

  /* ── Per-row Clear Value / Set Value (edge-triggered) ───────────────────────
     Pure show/hide/readonly/required derive at render; Clear/Set mutate data, so
     they fire only when a rule transitions inactive→active for a given cell
     (tracked per `${rowId}::${colKey}`). The first time a cell is seen it is only
     SEEDED (never applied), so loading/submitted data is never rewritten — only a
     live change to the source cell triggers a clear/set. */
  const rowRuleEdgeRef = useRef({});
  useEffect(() => {
    const edges = rowRuleEdgeRef.current;
    let changed = false;
    const next = rows.map((row) => {
      let r = row;
      columns.forEach((col) => {
        const va = rowColumnValueAction(col, r, columns);
        const key = `${row._rowId}::${col.key}`;
        const active = !!va;
        const prev = edges[key];
        edges[key] = active;
        if (prev === undefined || prev === active || !active) return; // seed / no inactive→active edge
        const k = col.fieldKey;
        const target = va.action === 'clear' ? blankCell(col) : va.setValue;
        if (JSON.stringify(r[k]) !== JSON.stringify(target)) {
          if (r === row) r = { ...row, _meta: { ...row._meta, updatedBy: actorName, updatedAt: nowISO() } };
          r[k] = target;
          changed = true;
        }
      });
      return r;
    });
    if (changed) commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns]);

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
    const numeric = col && ['number', 'currency', 'rating', 'formula', 'rank'].includes(col.type);
    return [...filtered].sort((a, b) => {
      const av = a?.[sort.key]; const bv = b?.[sort.key];
      const cmp = numeric ? toNum(av) - toNum(bv) : String(av ?? '').localeCompare(String(bv ?? ''));
      return cmp * sort.dir;
    });
  }, [filtered, sort, columns]);

  const pagination = field.pagination ?? {};
  const pgEnabled = !!pagination.enabled;
  const pageSize  = Math.max(1, Number(pagination.pageSize ?? pagination.page_size) || 25);
  const pageCount = pgEnabled ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const curPage   = Math.min(pageIdx, pageCount - 1);
  const pageRows  = pgEnabled ? sorted.slice(curPage * pageSize, curPage * pageSize + pageSize) : sorted;

  const toggleSort = (key) => setSort((p) => (p.key === key ? { key, dir: -p.dir } : { key, dir: 1 }));

  // Cell-level validation is no longer surfaced inside the grid (no red borders /
  // issue badge per spec) — the parent StudyFormRunner still blocks Submit/Next
  // via validateTable and shows a single "Please fill <table>" message.

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
                {(allowDelete || allowDuplicate) && (
                  <th className={`${s.th} ${s.thActions}`}>
                    <span className={s.thActionsLabel}>Actions</span>
                  </th>
                )}
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
                      const eff = rowColEff(col, row);
                      return (
                        <td key={col.key} className={s.td}>
                          {eff.hidden ? (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          ) : (
                            <TableCell
                              col={col}
                              name={`${row._rowId}_${col.key}`}
                              value={row[col.fieldKey]}
                              readOnly={eff.readOnly || !allowEdit}
                              onChange={(v) => setCell(row._rowId, col.fieldKey, v)}
                              rankCount={rows.length}
                              rankTaken={rankTaken[col.fieldKey]}
                              rowId={row._rowId}
                            />
                          )}
                        </td>
                      );
                    })}
                    {(allowDelete || allowDuplicate) && (
                      <td className={`${s.td} ${s.tdActions}`}>
                        <div className={s.rowActions}>
                          {allowDuplicate && (
                            <button type="button" className={s.rowBtn} title="Duplicate row" aria-label="Duplicate row" onClick={() => duplicateRow(row._rowId)} disabled={rows.length >= maxRows}>
                              <Copy size={16} />
                            </button>
                          )}
                          {allowDelete && (
                            <button type="button" className={`${s.rowBtn} ${s.rowBtnDanger}`} title="Delete row" aria-label="Delete row" onClick={() => setConfirmDeleteId(row._rowId)} disabled={rows.length <= minRows}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
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

      {/* Delete-row confirmation — never drop a row silently. */}
      <ConfirmDialog
        open={confirmDeleteId != null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => deleteRow(confirmDeleteId)}
        title="Delete row?"
        message="This row and its data will be removed. This action cannot be undone."
        confirmLabel="Delete row"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}

/* ── Per-cell input by column type ──────────────────────────────────────────*/
function TableCell({ col, value, onChange, readOnly, name, rankCount = 0, rankTaken, rowId }) {
  const ro = readOnly || col.formula?.enabled;
  const base = s.cellInput;

  if (col.formula?.enabled) {
    return <span className={s.cellFormula}>{value === '' || value == null ? '—' : value}</span>;
  }

  switch (col.type) {
    case 'rank': {
      // Options are Rank 1…N (N = current row count). A rank already taken by
      // ANOTHER row is disabled so every rank stays unique; this row's own rank
      // is always selectable. If a delete shrank N below an existing selection,
      // still surface that value so it isn't silently dropped from view.
      const taken = rankTaken || {};
      const cur = value == null ? '' : String(value);
      const nums = Array.from({ length: rankCount }, (_, i) => i + 1);
      const curNum = Number(cur);
      if (cur && Number.isFinite(curNum) && curNum > rankCount) nums.push(curNum);
      return (
        <select className={base} value={cur} disabled={ro} onChange={(e) => onChange(e.target.value)}>
          <option value="">{col.placeholder || 'Not Selected'}</option>
          {nums.map((n) => {
            const rv = String(n);
            const owner = taken[rv];
            return <option key={rv} value={rv} disabled={!!owner && owner !== rowId}>{`Rank ${n}`}</option>;
          })}
        </select>
      );
    }
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
