/**
 * RatingMatrixInput — survey / Likert runtime for a Table field in 'rating' mode.
 *
 * Layout: ROWS are the items/questions (down the side), the rating OPTIONS are
 * the scale (across the top). Each row allows exactly ONE selection (radio
 * behaviour, single-selection-per-row), with an optional trailing N/A column.
 *
 * Value shape (persisted under values[field.id]):
 *   { [rowKey]: optionValue }    e.g.  { headache: 'mild', fatigue: 'moderate' }
 *
 * This is reached only via TableFieldInput, which delegates here when
 * tableEngine.isRatingMatrix(field) is true. Read-only / locked state is
 * inherited from the parent <fieldset disabled> wrapper in StudyFormRunner.
 */
import { useMemo } from 'react';
import { Table2 } from 'lucide-react';
import {
  matrixRows, matrixOptions, matrixAllowNA, matrixNALabel,
  matrixRequireAll, matrixUnique, matrixRowKey, matrixValueMap, MATRIX_NA_VALUE,
} from './tableEngine';
import s from './RatingMatrixInput.module.css';

export default function RatingMatrixInput({ field, value, onChange, showErrors = false }) {
  const rows = useMemo(() => matrixRows(field), [field]);
  const baseOptions = useMemo(() => matrixOptions(field), [field]);
  const allowNA = matrixAllowNA(field);
  const requireAll = matrixRequireAll(field);
  const unique = matrixUnique(field);

  // The scale columns, plus an optional trailing N/A pseudo-column.
  const scale = useMemo(() => {
    const opts = baseOptions.map((o) => ({ value: o.value, label: o.label }));
    if (allowNA) opts.push({ value: MATRIX_NA_VALUE, label: matrixNALabel(field), isNA: true });
    return opts;
  }, [baseOptions, allowNA, field]);

  const map = matrixValueMap(value);

  // Unique selection: map each already-chosen option → the row that owns it, so
  // it can be disabled in every OTHER row. N/A is exempt (any row may be N/A).
  // Recomputed from the value each render, so changing/clearing a row's choice
  // frees the option immediately.
  const takenBy = useMemo(() => {
    if (!unique) return {};
    const t = {};
    rows.forEach((row, idx) => {
      const rk = matrixRowKey(row, idx);
      const v = map[rk];
      if (v != null && v !== '' && v !== MATRIX_NA_VALUE) t[v] = rk;
    });
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unique, rows, value]);

  const select = (rowKey, optValue) => {
    // Single selection per row — clicking the chosen option again clears it
    // (so a non-required item can be un-answered).
    const next = { ...map };
    if (next[rowKey] === optValue) delete next[rowKey];
    else next[rowKey] = optValue;
    onChange(next);
  };

  if (!rows.length || !scale.length) {
    return (
      <div className={s.stateBox}>
        <Table2 size={22} strokeWidth={1.25} className={s.emptyIcon} />
        <span>
          {rows.length ? 'Add rating options' : 'Add rows to rate'} in the builder
          to configure this matrix.
        </span>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <div className={s.scroller}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={`${s.th} ${s.thItem}`} />
              {scale.map((o) => (
                <th key={o.value} className={`${s.th} ${o.isNA ? s.thNA : ''}`}>{o.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const rowKey = matrixRowKey(row, idx);
              const sel = map[rowKey];
              const missing = showErrors && requireAll && (sel === undefined || sel === null || sel === '');
              return (
                <tr key={rowKey} className={missing ? s.rowMissing : undefined}>
                  <th scope="row" className={`${s.td} ${s.tdItem}`}>
                    {row.label || rowKey}
                    {requireAll && <span className={s.req}>*</span>}
                  </th>
                  {scale.map((o) => {
                    const inputName = `${field.id}_${rowKey}`;
                    const checked = sel === o.value;
                    // Unique mode: an option taken by ANOTHER row is disabled here
                    // (this row's own selection stays selectable; N/A is exempt).
                    const owner = unique && !o.isNA ? takenBy[o.value] : undefined;
                    const lockedByUnique = !!owner && owner !== rowKey;
                    return (
                      <td key={o.value} className={`${s.td} ${s.tdRadio}`}>
                        <label className={`${s.radioLabel} ${lockedByUnique ? s.disabled : ''}`} title={lockedByUnique ? `${o.label} — already assigned` : o.label}>
                          <input
                            type="radio"
                            name={inputName}
                            checked={checked}
                            disabled={lockedByUnique}
                            onChange={() => select(rowKey, o.value)}
                            onClick={() => { if (checked) select(rowKey, o.value); }}
                          />
                          <span className={s.radioText}>{o.label}</span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
