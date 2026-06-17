/**
 * SFBPreview — interactive participant-facing preview of the study form.
 *
 * Layout:
 *   • Left rail   — outline navigator with COLLAPSIBLE blocks. Each block
 *                   header expands/collapses its page list. Clicking a page
 *                   jumps the main column to that page.
 *   • Main column — sticky search bar + one page at a time (dense 2-col
 *                   field grid) + Previous / Next / Submit footer.
 *
 * Search results auto-jump to the matching block/page and expand the
 * parent block in the sidebar.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ChevronLeft, ChevronRight, ChevronDown,
  UploadCloud, PenLine, Star, Layers,
  Search, FileText, Type as TypeIcon, CornerDownRight,
} from 'lucide-react';
import { selectBlocks, selectFormMeta, fieldKeyOf } from '@/features/cro/store/studyFormSlice';
import { addToast } from '@/app/notificationSlice';
import { headingStyleToCss } from './headingStyle';
import RuntimeFieldRenderer from './runtime/RuntimeFieldRenderer';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
import TableFieldInput from '@/components/study-form-runner/TableFieldInput';
import { evaluateExpression, coerceOutput } from './formulaEngine';
import { compareOp, dateBounds } from './runtime/runtimeEngine';
import s from './SFBPreview.module.css';

/* ── Helpers ──────────────────────────────────────────────────────────── */
function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function Highlight({ text, needle }) {
  if (!needle) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(needle)})`, 'ig');
  const parts = String(text ?? '').split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === needle.toLowerCase()
      ? <mark key={i} className={s.mark}>{p}</mark>
      : <span key={i}>{p}</span>
  );
}

export default function SFBPreview({ onExitPreview }) {
  const dispatch = useDispatch();
  const blocks = useSelector(selectBlocks);
  const meta   = useSelector(selectFormMeta);

  // Active block / page indices for the main column stepper.
  const [blockIdx,  setBlockIdx]  = useState(0);
  const [pageIdx,   setPageIdx]   = useState(0);
  const [values,    setValues]    = useState({});       // { fieldId: { label, value } }
  // Edge tracker for conditional auto-selection (checkbox group), see effect below.
  const autoSelectStateRef = useRef({ initialized: false, met: {} });

  // Sidebar — which blocks are currently expanded (show their pages).
  const [expanded,  setExpanded]  = useState({});       // { blockId: true }

  // Search state — popover open / highlighted result.
  const [search,    setSearch]    = useState('');
  const [searchOpen,setSearchOpen]= useState(false);
  const [hi,        setHi]        = useState(0);

  const searchRef = useRef(null);
  const popRef    = useRef(null);

  /* Expand the active block in the sidebar by default. */
  useEffect(() => {
    if (blocks.length === 0) return;
    setExpanded((p) => ({ ...p, [blocks[blockIdx]?.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockIdx, blocks.length]);

  /* Ctrl/⌘ + F focuses search; Esc closes popover. */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Close search popover when clicking outside. */
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !searchRef.current?.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const setValue = (fieldId, label, value) =>
    setValues((prev) => ({ ...prev, [fieldId]: { label, value } }));

  // Formula recompute (preview) — mirrors StudyFormRunner. Formulas reference
  // fields by fieldKey; preview `values` is keyed by field.id as { label, value }.
  useEffect(() => {
    const formulaFields = [];
    const keyToId = {};
    for (const blk of blocks || []) {
      for (const pg of blk.pages || []) {
        for (const f of pg.fields || []) {
          const key = fieldKeyOf(f);
          if (key) keyToId[key] = f.id;
          if (f?.type === 'formula' && (f.expression || '').trim()) formulaFields.push(f);
        }
      }
    }
    if (!formulaFields.length) return;
    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (let pass = 0; pass < 10; pass += 1) {
        let passChanged = false;
        const scope = {};
        for (const [key, id] of Object.entries(keyToId)) scope[key] = next[id]?.value;
        for (const f of formulaFields) {
          const { value: raw, error } = evaluateExpression(f.expression, scope);
          const out = error ? null : coerceOutput(raw, f.outputType, f.precision);
          if (JSON.stringify(next[f.id]?.value) !== JSON.stringify(out)) {
            next[f.id] = { label: f.label, value: out }; passChanged = true; changed = true;
          }
        }
        if (!passChanged) break;
      }
      return changed ? next : prev;
    });
  }, [values, blocks]);

  // Conditional auto-selection (checkbox group) — mirrors StudyFormRunner.
  // Edge-triggered: when an option's condition flips unmet→met, auto check/
  // uncheck the option once. First pass only seeds the met-state.
  useEffect(() => {
    const flat = Object.fromEntries(Object.entries(values).map(([k, e]) => [k, e?.value]));
    const state = autoSelectStateRef.current;
    const prevMet = state.met; const nextMet = {}; const patch = {};
    for (const blk of blocks || []) {
      for (const pg of blk.pages || []) {
        for (const f of pg.fields || []) {
          if (f.type !== 'checkboxgroup' || !f.enableOptionAutoSelect) continue;
          for (const o of f.options || []) {
            const rule = o.autoRule;
            if (!rule || rule.enabled !== true) continue;
            const groups = Array.isArray(rule.groups) && rule.groups.length ? rule.groups : [{ match: rule.match, rules: rule.rules }];
            const evalGroup = (g) => {
              const list = (g.rules || []).filter((c) => c && (c.fieldId ?? c.field_id) && c.operator);
              if (!list.length) return null;
              const hits = list.map((c) => compareOp(c.operator, flat[c.fieldId ?? c.field_id], c.value));
              return String(g.match ?? 'all').toLowerCase() === 'any' ? hits.some(Boolean) : hits.every(Boolean);
            };
            const results = groups.map(evalGroup).filter((r) => r !== null);
            if (!results.length) continue;
            const met = String(rule.groupMatch ?? 'all').toLowerCase() === 'any' ? results.some(Boolean) : results.every(Boolean);
            const key = `${f.id}::${o.value}`; nextMet[key] = met;
            if (!state.initialized || met === prevMet[key]) continue;
            const action = String(rule.action ?? 'select').toLowerCase();
            const rawCur = (patch[f.id]?.value) ?? flat[f.id];
            const cur = Array.isArray(rawCur) ? rawCur : (rawCur == null || rawCur === '' ? [] : [rawCur]);
            const has = cur.includes(o.value);
            if (action === 'toggle') {
              if (met && !has) patch[f.id] = { label: f.label, value: [...cur, o.value] };
              else if (!met && has) patch[f.id] = { label: f.label, value: cur.filter((x) => x !== o.value) };
            } else if (met) {
              if (action === 'deselect') { if (has) patch[f.id] = { label: f.label, value: cur.filter((x) => x !== o.value) }; }
              else if (!has) patch[f.id] = { label: f.label, value: [...cur, o.value] };
            }
            const sf = rule.setField;
            const sfId = sf && (sf.fieldId ?? sf.field_id);
            if (met && (action === 'select' || action === 'toggle') && sfId) patch[sfId] = { label: patch[sfId]?.label, value: sf.value };
          }
        }
      }
    }
    autoSelectStateRef.current = { initialized: true, met: nextMet };
    if (Object.keys(patch).length) setValues((prev) => ({ ...prev, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, blocks]);

  const toggleSidebarBlock = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  /* ── Search index ─────────────────────────────────────────────────────
   * NOTE: this hook (and the useEffect below it) must run on every render,
   * which is why they live ABOVE the early-return branches for "no blocks"
   * and "submitted". Moving them below produced a hooks-order violation
   * ("Rendered fewer hooks than expected") when `submitted` flipped true. */
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    const out = [];
    for (const blk of blocks) {
      if ((blk.title ?? '').toLowerCase().includes(needle)) {
        out.push({ kind: 'block', id: blk.id, label: blk.title || 'Untitled Block', blockId: blk.id, path: 'Block' });
      }
      for (const pg of blk.pages ?? []) {
        if ((pg.title ?? '').toLowerCase().includes(needle)) {
          out.push({ kind: 'page', id: pg.id, label: pg.title || 'Untitled Page', blockId: blk.id, pageId: pg.id, path: `${blk.title || 'Block'} › Page` });
        }
        for (const fld of pg.fields ?? []) {
          const hay = `${fld.label ?? ''} ${fld.key ?? ''}`.toLowerCase();
          if (hay.includes(needle)) {
            out.push({ kind: 'field', id: fld.id, label: fld.label || fld.key || '(unnamed field)', blockId: blk.id, pageId: pg.id, fieldId: fld.id, path: `${blk.title || 'Block'} › ${pg.title || 'Page'}` });
          }
        }
      }
    }
    return out.slice(0, 30);
  }, [search, blocks]);

  useEffect(() => { setHi(0); }, [results]);

  /* ── Empty / success states ──────────────────────────────────────── */
  if (blocks.length === 0) {
    return (
      <div className={s.emptyRoot} style={{ flex: 1 }}>
        <Layers size={40} strokeWidth={1.25} className={s.emptyIcon} />
        <p className={s.emptyTitle}>Nothing to preview yet</p>
        <p className={s.emptySub}>Add blocks and fields in the Builder tab first.</p>
      </div>
    );
  }

  /* Guard clamp */
  const bi    = Math.min(blockIdx, blocks.length - 1);
  const block = blocks[bi];
  const pi    = Math.min(pageIdx, block.pages.length - 1);
  const page  = block.pages[pi];

  const isFirstPage = bi === 0 && pi === 0;
  const isLastPage  = bi === blocks.length - 1 && pi === block.pages.length - 1;

  /* ── Navigation between pages/blocks ────────────────────────────── */
  const goNext = () => {
    if (pi < block.pages.length - 1) { setPageIdx(pi + 1); }
    else if (bi < blocks.length - 1) { setBlockIdx(bi + 1); setPageIdx(0); }
  };
  const goPrev = () => {
    if (pi > 0) { setPageIdx(pi - 1); }
    else if (bi > 0) { const pb = blocks[bi - 1]; setBlockIdx(bi - 1); setPageIdx(pb.pages.length - 1); }
  };
  const goToBlockPage = (blockId, pageId) => {
    const targetBi = blocks.findIndex((b) => b.id === blockId);
    if (targetBi < 0) return;
    const targetPi = pageId
      ? Math.max(0, blocks[targetBi].pages.findIndex((p) => p.id === pageId))
      : 0;
    setBlockIdx(targetBi);
    setPageIdx(targetPi);
    // Make sure the side rail shows the destination block expanded.
    setExpanded((p) => ({ ...p, [blockId]: true }));
  };

  const jumpTo = (r) => {
    goToBlockPage(r.blockId, r.pageId);
    setSearchOpen(false);
    if (r.fieldId) {
      requestAnimationFrame(() => {
        const node = document.querySelector(`[data-field-id="${r.fieldId}"]`);
        if (node?.scrollIntoView) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
          node.classList?.add(s.flash);
          setTimeout(() => node.classList?.remove(s.flash), 1400);
        }
      });
    }
  };

  const onSearchKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(i + 1, Math.max(results.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')   { if (results[hi]) { e.preventDefault(); jumpTo(results[hi]); } }
  };

  /* ── Progress ─────────────────────────────────────────────────────── */
  const totalPages = blocks.reduce((acc, b) => acc + b.pages.length, 0);
  const donePages  = blocks.slice(0, bi).reduce((acc, b) => acc + b.pages.length, 0) + pi + 1;
  const pct        = Math.round((donePages / totalPages) * 100);

  const iconFor = (kind) =>
    kind === 'block' ? <Layers   size={13} />
  : kind === 'page'  ? <FileText size={13} />
  :                    <TypeIcon size={13} />;

  return (
    <div className={s.root}>

      {/* ── Left rail: collapsible block outline ─────────────────────── */}
      <aside className={s.sidebar}>
        <div className={s.sidebarHead}>
          <span className={s.sidebarTitle}>{meta.formTitle || 'Study Form'}</span>
          <span className={s.sidebarSub}>{pct}% complete</span>
          <div className={s.progressWrap}>
            <div className={s.progressBar} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <nav className={s.stepList} aria-label="Form outline">
          {blocks.map((blk, i) => {
            const isOpen    = !!expanded[blk.id];
            const isCurrent = i === bi;
            return (
              <div key={blk.id} className={s.stepBlock}>
                <button
                  type="button"
                  className={`${s.stepBlockHead} ${isCurrent ? s.stepBlockHeadActive : ''}`}
                  onClick={() => toggleSidebarBlock(blk.id)}
                  title={blk.title}
                >
                  <span className={s.stepCaret}>
                    {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </span>
                  <span className={s.stepBlockLabel}>{blk.title || `Block ${i + 1}`}</span>
                  <span className={s.stepBlockCount}>{blk.pages.length}</span>
                </button>

                {isOpen && (
                  <ol className={s.pageList}>
                    {blk.pages.map((pg, j) => {
                      const pCurrent = isCurrent && j === pi;
                      return (
                        <li key={pg.id}>
                          <button
                            type="button"
                            className={`${s.pageItem} ${pCurrent ? s.pageItemActive : ''}`}
                            onClick={() => goToBlockPage(blk.id, pg.id)}
                          >
                            <span className={s.pageDot} />
                            <span className={s.pageItemLabel}>{pg.title || `Page ${j + 1}`}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────── */}
      <div className={s.mainCol}>
        <div className={s.contentShell}>

          {/* Sticky search bar */}
          <div className={s.searchBar}>
            <Search size={14} className={s.searchIcon} />
            <input
              ref={searchRef}
              type="text"
              className={s.searchInput}
              placeholder="Search blocks, pages, fields..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => search && setSearchOpen(true)}
              onKeyDown={onSearchKey}
            />
            <span className={s.searchKbd}>Ctrl + F</span>

            {searchOpen && search && (
              <div ref={popRef} className={s.searchPop}>
                {results.length === 0 ? (
                  <div className={s.searchEmpty}>No matches for &ldquo;{search}&rdquo;</div>
                ) : (
                  results.map((r, i) => (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      className={`${s.searchRow} ${i === hi ? s.searchRowActive : ''}`}
                      onMouseEnter={() => setHi(i)}
                      onMouseDown={(e) => { e.preventDefault(); jumpTo(r); }}
                    >
                      <span className={`${s.kindBadge} ${s[`kind_${r.kind}`]}`}>
                        {iconFor(r.kind)} {r.kind}
                      </span>
                      <span className={s.searchLabel}>
                        <Highlight text={r.label} needle={search} />
                      </span>
                      <span className={s.searchPath}>
                        <CornerDownRight size={11} /> {r.path}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Page heading */}
          <div className={s.pageHeading}>
            <div>
              <h2 className={s.pageTitle}>{page.title}</h2>
              {page.description && <p className={s.pageDesc}>{page.description}</p>}
            </div>
            <span className={s.pageCounter}>
              Page {pi + 1} / {block.pages.length} · Block {bi + 1} / {blocks.length}
            </span>
          </div>

          {/* Fields (dense 2-col grid via SFBPreview.module.css) */}
          <div className={s.fields}>
            {page.fields.length === 0 ? (
              <div className={s.noFields}>
                <p>This page has no fields yet.</p>
              </div>
            ) : (
              page.fields.map((field) => {
                const isLayout = ['h2', 'h3', 'paragraph', 'divider'].includes(field.type);
                if (isLayout) {
                  return (
                    <div
                      key={field.id}
                      className={`${s.fieldWrap} ${s.fieldWrapLayout}`}
                      data-field-id={field.id}
                    >
                      <FieldInput
                        field={field}
                        value={values[field.id]?.value}
                        onChange={(v) => setValue(field.id, field.label, v)}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    style={{ minWidth: 0, gridColumn: ({ left: '1 / 2', right: '2 / 3', half: 'auto' }[field.fieldWidth]) || '1 / -1' }}
                  >
                    <RuntimeFieldRenderer
                      field={field}
                      value={values[field.id]?.value}
                      onChange={(v) => setValue(field.id, field.label, v)}
                      allValues={Object.fromEntries(
                        Object.entries(values).map(([k, e]) => [k, e?.value]),
                      )}
                    >
                      {({ field: f, value: v, onChange, disabled }) => (
                        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
                          <FieldInput field={f} value={v} onChange={onChange} />
                        </fieldset>
                      )}
                    </RuntimeFieldRenderer>
                  </div>
                );
              })
            )}
          </div>

          {/* Nav footer */}
          <div className={s.navFooter}>
            <button className={s.btnPrev} onClick={goPrev} disabled={isFirstPage}>
              <ChevronLeft size={15} /> Previous
            </button>

            {block.pages.length > 1 && (
              <div className={s.dots}>
                {block.pages.map((_, i) => (
                  <span
                    key={i}
                    className={`${s.dot} ${i === pi ? s.dotActive : ''} ${i < pi ? s.dotDone : ''}`}
                    onClick={() => goToBlockPage(block.id, block.pages[i].id)}
                  />
                ))}
              </div>
            )}

            {/* Preview has no Submit — it's a design-time test of the form, not a
                real data-capture flow. End users submit from the site workspace. */}
            {isLastPage ? (
              <span className={s.previewEndNote}>End of form — preview only</span>
            ) : pi === block.pages.length - 1 ? (
              <button className={s.btnNextBlock} onClick={goNext}>
                Next: {blocks[bi + 1]?.title} <ChevronRight size={15} />
              </button>
            ) : (
              <button className={s.btnNext} onClick={goNext}>
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>

        </div>{/* /contentShell */}
      </div>{/* /mainCol */}
    </div>
  );
}

/* ── Interactive field renderer (used inside RuntimeFieldRenderer) ───────── */
/* Designer-preview checkbox group. Mirrors the runtime, incl. per-option
 * additional input (field.allowOptionInput) — values are kept in local state
 * since the preview has no submission record. */
function PreviewCheckboxGroup({ field, value, onChange }) {
  const checked = Array.isArray(value) ? value : [];
  const [optInputs, setOptInputs] = useState({});
  const setOptInput = (optVal, inputVal) => setOptInputs((prev) => {
    const next = { ...prev };
    if (inputVal === '' || inputVal == null) delete next[optVal];
    else next[optVal] = inputVal;
    return next;
  });
  return (
    <div className={s.choiceGroup}>
      {(field.options ?? []).map((o) => {
        const isChk = checked.includes(o.value);
        const wantsInput = field.allowOptionInput && o.allowInput;
        return (
          <div key={o.value} style={{ display: 'flex', flexDirection: 'column', flexBasis: '100%' }}>
            <label className={`${s.choiceItem} ${isChk ? s.choiceItemSelected : ''}`}>
              <input
                type="checkbox"
                checked={isChk}
                onChange={() => {
                  const next = isChk ? checked.filter((x) => x !== o.value) : [...checked, o.value];
                  if (isChk && wantsInput) setOptInput(o.value, '');
                  onChange(next);
                }}
              />
              <span>{o.label}</span>
            </label>
            {wantsInput && isChk && (
              o.inputType === 'textarea' ? (
                <textarea className={s.textarea} style={{ marginTop: 6, marginLeft: 24 }} rows={2}
                  placeholder={o.inputPlaceholder || 'Please specify…'} value={optInputs[o.value] ?? ''}
                  onChange={(e) => setOptInput(o.value, e.target.value)} />
              ) : (
                <input type={o.inputType === 'number' ? 'number' : o.inputType === 'date' ? 'date' : 'text'}
                  className={s.input} style={{ marginTop: 6, marginLeft: 24, maxWidth: 'calc(100% - 24px)' }}
                  placeholder={o.inputPlaceholder || 'Please specify…'} value={optInputs[o.value] ?? ''}
                  onChange={(e) => setOptInput(o.value, e.target.value)} />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Designer-preview for option-based child fields. Shows the dependent inputs
 * under each selected parent option; values are local (preview has no record).
 * Reads camelCase designer state directly. */
function PreviewOptionChildren({ field, value }) {
  const [vals, setVals] = useState({}); // `${optionValue}::${childId}` → value
  if (!field.enableOptionChildren) return null;
  const selected = Array.isArray(value) ? value : (value === '' || value == null ? [] : [value]);
  const groups = (field.options ?? []).filter((o) => selected.includes(o.value) && (o.childFields ?? []).length);
  if (!groups.length) return null;
  const setVal = (k, val) => setVals((prev) => ({ ...prev, [k]: val }));
  const renderChild = (c, k) => {
    const opts = c.options ?? [];
    const val = vals[k] ?? '';
    switch (c.type) {
      case 'textarea': return <textarea className={s.textarea} rows={2} placeholder={c.placeholder} value={val} onChange={(e) => setVal(k, e.target.value)} />;
      case 'number':   return <input type="number" className={s.input} placeholder={c.placeholder} value={val} onChange={(e) => setVal(k, e.target.value)} />;
      case 'date':     return <input type="date" className={s.input} value={val} onChange={(e) => setVal(k, e.target.value)} />;
      case 'select':   return (
        <select className={s.select} value={val} onChange={(e) => setVal(k, e.target.value)}>
          <option value="">{c.placeholder || 'Select an option…'}</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>);
      case 'multiselect': {
        const sel = Array.isArray(vals[k]) ? vals[k] : [];
        return (
          <select className={s.select} multiple size={Math.min(5, Math.max(3, opts.length))} value={sel}
            onChange={(e) => setVal(k, Array.from(e.target.selectedOptions, (o) => o.value))}>
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>);
      }
      case 'radiogroup': return (
        <div className={s.choiceGroup}>
          {opts.map((o) => (
            <label key={o.value} className={`${s.choiceItem} ${val === o.value ? s.choiceItemSelected : ''}`}>
              <input type="radio" checked={val === o.value} onChange={() => setVal(k, o.value)} /><span>{o.label}</span>
            </label>))}
        </div>);
      case 'checkboxgroup': {
        const sel = Array.isArray(vals[k]) ? vals[k] : [];
        return (
          <div className={s.choiceGroup}>
            {opts.map((o) => { const on = sel.includes(o.value); return (
              <label key={o.value} className={`${s.choiceItem} ${on ? s.choiceItemSelected : ''}`}>
                <input type="checkbox" checked={on} onChange={() => setVal(k, on ? sel.filter((x) => x !== o.value) : [...sel, o.value])} /><span>{o.label}</span>
              </label>);})}
          </div>);
      }
      default: return <input type="text" className={s.input} placeholder={c.placeholder} value={val} onChange={(e) => setVal(k, e.target.value)} />;
    }
  };
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map((o) => (
        <div key={o.value} style={{ borderLeft: '2px solid #c7d2fe', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(o.childFields ?? []).map((c) => {
            const k = `${o.value}::${c.id}`;
            return (
              <div key={c.id} style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  {c.label || 'Field'}{c.required && <span style={{ color: '#dc2626' }}> *</span>}
                </label>
                {renderChild(c, k)}
                {c.helpText && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{c.helpText}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Display-only Paragraph — renders the designer's rich-text HTML verbatim, or
// legacy plain text with line breaks preserved. Mirrors the runtime renderer.
const PARA_HTML_RE = /<[a-z][\s\S]*>/i;
function RichParagraph({ field }) {
  const raw = field.content ?? field.label ?? '';
  const text = typeof raw === 'string' ? raw : '';
  if (!text.trim()) return <p className={s.paragraph}>Paragraph text.</p>;
  if (PARA_HTML_RE.test(text)) {
    return <div className={s.richParagraph} dangerouslySetInnerHTML={{ __html: text }} />;
  }
  return <div className={`${s.richParagraph} ${s.richParagraphPlain}`}>{text}</div>;
}

function FieldInput({ field, value, onChange }) {
  const v = value ?? '';

  switch (field.type) {
    case 'table':
      return <TableFieldInput field={field} value={value} onChange={onChange} allValues={{}} />;
    case 'formula': {
      const display = coerceOutput(value, field.outputType, field.precision);
      const text = display == null || display === '' ? '—'
        : typeof display === 'boolean' ? (display ? 'True' : 'False') : String(display);
      return (
        <div className={s.input} style={{ background: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'default' }}>{text}</div>
      );
    }
    case 'text':
    case 'number':
    case 'email':
    case 'phone':
      return (
        <input
          type={field.type === 'phone' ? 'tel' : field.type}
          className={s.input}
          placeholder={field.placeholder || ''}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          className={s.textarea}
          placeholder={field.placeholder || ''}
          rows={field.rows ?? 3}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date': {
      const { min, max } = dateBounds(field);
      return <PlatformDatePicker value={v ?? ''} onChange={onChange} min={min ?? undefined} max={max ?? undefined} />;
    }
    case 'datetime': {
      const { min, max } = dateBounds(field);
      return <input type="datetime-local" className={s.input} value={v} onChange={(e) => onChange(e.target.value)}
        min={min ? `${min}T00:00` : undefined} max={max ? `${max}T23:59` : undefined} />;
    }
    case 'time':     return <input type="time"           className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'select': {
      if (field.multiple) {
        const selected = Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);
        return (
          <>
          <select
            className={s.select}
            multiple
            size={Math.min(6, Math.max(3, (field.options ?? []).length))}
            value={selected}
            onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <PreviewOptionChildren field={field} value={v} />
          </>
        );
      }
      return (
        <>
        <select className={s.select} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder || 'Select an option…'}</option>
          {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <PreviewOptionChildren field={field} value={v} />
        </>
      );
    }
    case 'radiogroup':
      return (
        <>
        <div className={s.choiceGroup}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} className={`${s.choiceItem} ${v === o.value ? s.choiceItemSelected : ''}`}>
              <input type="radio" checked={v === o.value} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        <PreviewOptionChildren field={field} value={v} />
        </>
      );
    case 'checkboxgroup':
      return (
        <>
        <PreviewCheckboxGroup field={field} value={v} onChange={onChange} />
        <PreviewOptionChildren field={field} value={v} />
        </>
      );
    case 'toggle':
      return (
        <div className={s.toggleWrap} onClick={() => onChange(!v)}>
          <div className={s.toggleTrack} style={{ background: v ? '#2563eb' : undefined }}>
            <div className={s.toggleThumb} style={{ transform: v ? 'translateX(18px)' : 'translateX(0)' }} />
          </div>
          <span className={s.toggleLabel}>{v ? 'On' : 'Off'}</span>
        </div>
      );
    case 'file': {
      const isMulti = field.multiple != null
        ? !!field.multiple
        : ['multifile', 'multiimage'].includes(field.type);
      const acceptHint = field.accept ? field.accept.replace(/,/g, ', ') : 'Any file type';
      return (
        <div className={s.fileZone}>
          <UploadCloud size={26} className={s.fileIcon} />
          <span className={s.fileText}>{isMulti ? 'Click to upload files' : 'Click to upload a file'}</span>
          <span className={s.fileHint}>
            {[isMulti ? `Up to ${field.maxFiles ?? 10} files` : 'Single file',
              field.maxSize ? `max ${field.maxSize}MB each` : null,
              acceptHint].filter(Boolean).join(' · ')}
          </span>
        </div>
      );
    }
    case 'signature':
      return (
        <div className={s.signaturePad}>
          <PenLine size={18} className={s.signatureIcon} /><span>Sign here</span>
        </div>
      );
    case 'rating': {
      const rating = Number(v) || 0;
      return (
        <div className={s.stars}>
          {[1,2,3,4,5].map((n) => (
            <Star
              key={n}
              size={24}
              className={s.starIcon}
              style={{ color: n <= rating ? '#f59e0b' : undefined, cursor: 'pointer' }}
              onClick={() => onChange(n)}
            />
          ))}
        </div>
      );
    }
    case 'slider': {
      const min  = Number(field.minValue ?? 0);
      const max  = Number(field.maxValue ?? 100);
      const step = Number(field.step    ?? 1);
      const cur  = v === '' || v == null ? min : Number(v);
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b', minWidth: 24, textAlign: 'right' }}>{min}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={cur}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#64748b', minWidth: 24 }}>{max}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', minWidth: 32, textAlign: 'right' }}>
            {cur}
          </span>
        </div>
      );
    }
    case 'h2':
      return <h2 className={s.h2} style={headingStyleToCss(field)}>{field.label || 'Section Title'}</h2>;
    case 'h3':
      return <h3 className={s.h3} style={headingStyleToCss(field)}>{field.label || 'Sub-heading'}</h3>;
    case 'paragraph':
      return <RichParagraph field={field} />;
    case 'divider':
      return <hr className={s.divider} />;
    default:
      return <input type="text" className={s.input} placeholder={field.placeholder || ''} value={v} onChange={(e) => onChange(e.target.value)} />;
  }
}
