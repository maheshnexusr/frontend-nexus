/**
 * AnnotationModal — pick ONE annotation from the global master for this field.
 *
 * The Annotations master (CRO → Masters → Annotations) holds the canonical
 * list of { annotation, fullForm, description }. Each field stores a single
 * master id reference (`field.annotationId`).
 *
 * Flow:
 *   1. Fetch the master via annotationsClient.list().
 *   2. Render each row as a radio option; pre-select whatever is already on
 *      the field.
 *   3. Search filter, row-click selects that row.
 *   4. Save → dispatches setFieldAnnotationId with the picked id (or null
 *      if the user clears).
 *   5. Cancel → discards changes.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, X as XIcon, Loader2, ExternalLink, Check } from 'lucide-react';
import { annotationsClient } from '@/features/cro/api/annotationsClient';
import { selectFieldById, setFieldAnnotationId } from '@/features/cro/store/studyFormSlice';
import { addToast } from '@/app/notificationSlice';
import Popover from './Popover';
import s from './runtime.module.css';

export default function AnnotationModal({ fieldId, fieldLabel, anchorRect, onClose }) {
  const dispatch = useDispatch();
  const field    = useSelector(selectFieldById(fieldId));

  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(field?.annotationId ?? null);

  // Resync when the user reopens the popover on a different field.
  useEffect(() => {
    setSelected(field?.annotationId ?? null);
  }, [fieldId, field?.annotationId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    annotationsClient.list()
      .then((list) => { if (alive) setRows(list); })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load annotations.' })))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dispatch]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) =>
      (a.annotation  ?? '').toLowerCase().includes(q) ||
      (a.fullForm    ?? '').toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Click the same row again → clear the selection.
  const pick = (id) => setSelected((cur) => (cur === id ? null : id));

  const handleSave = () => {
    dispatch(setFieldAnnotationId({ fieldId, annotationId: selected }));
    const picked = rows.find((r) => r.id === selected);
    dispatch(addToast({
      type:    'success',
      message: picked
        ? `Annotation '${picked.annotation}' saved on this field.`
        : 'Annotation cleared on this field.',
    }));
    onClose?.();
  };

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Annotation · ${fieldLabel}`}
      width={520}
      maxHeight={560}
      onClose={onClose}
      footer={
        <>
          <a
            href="/cro/masters/annotations"
            target="_blank"
            rel="noreferrer"
            className={s.btnSecondary}
            style={{ textDecoration: 'none' }}
            title="Open the Annotations master"
          >
            <ExternalLink size={13} /> Manage in Masters
          </a>
          <button type="button" className={s.btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={s.btnPrimary} onClick={handleSave} disabled={loading}>
            <Check size={13} /> Save
          </button>
        </>
      }
    >
      <div
        style={{
          fontSize: 12,
          color: '#475569',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '8px 10px',
          marginBottom: 10,
          lineHeight: 1.45,
        }}
      >
        Select an annotation for this field. Click the selected row again to clear.
        Codes are maintained centrally in <strong>Masters → Annotations</strong>.
      </div>

      {rows.length > 0 && (
        <div className={s.searchRow}>
          <Search size={13} className={s.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={s.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${rows.length} annotation${rows.length !== 1 ? 's' : ''}…`}
            autoFocus
          />
          {search && (
            <button
              type="button"
              className={s.searchClear}
              onClick={() => setSearch('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <XIcon size={11} />
            </button>
          )}
          <span className={s.searchCount}>
            {selected ? '1 selected' : 'none selected'} · {visible.length}/{rows.length}
          </span>
        </div>
      )}

      {loading ? (
        <div className={s.emptyState}>
          <Loader2 size={16} className={s.spin} /> Loading annotations…
        </div>
      ) : rows.length === 0 ? (
        <div className={s.emptyState}>
          No annotations yet. Add them in <strong>Masters → Annotations</strong>.
        </div>
      ) : visible.length === 0 ? (
        <div className={s.emptyState}>No annotations match &ldquo;{search}&rdquo;.</div>
      ) : (
        <div
          className={s.itemList}
          role="radiogroup"
          aria-label="Annotation for this field"
        >
          {visible.map((row) => {
            const isChecked = selected === row.id;
            return (
              <div
                key={row.id}
                className={s.item}
                role="radio"
                aria-checked={isChecked}
                tabIndex={0}
                onClick={() => pick(row.id)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(row.id); }
                }}
                style={{
                  cursor: 'pointer',
                  ...(isChecked ? { background: '#eff6ff', borderColor: '#bfdbfe' } : null),
                }}
              >
                <div className={s.itemHead}>
                  <input
                    type="radio"
                    name={`ann-pick-${fieldId}`}
                    checked={isChecked}
                    onChange={() => pick(row.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: 8, flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={s.itemAuthor}>{row.annotation}</span>
                      {row.fullForm && <span className={s.itemMeta}>{row.fullForm}</span>}
                    </div>
                    {row.description && <div className={s.itemBody}>{row.description}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
