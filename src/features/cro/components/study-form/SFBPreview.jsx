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
  ChevronLeft, ChevronRight, ChevronDown, CheckCircle2,
  UploadCloud, PenLine, Star, Layers,
  Search, FileText, Type as TypeIcon, CornerDownRight,
} from 'lucide-react';
import { selectBlocks, selectFormMeta } from '@/features/cro/store/studyFormSlice';
import { formResponsesClient } from '@/features/cro/api/formResponsesClient';
import { addToast } from '@/app/notificationSlice';
import { validateField, evaluateField } from './runtime/runtimeEngine';
import RuntimeFieldRenderer from './runtime/RuntimeFieldRenderer';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
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
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values,    setValues]    = useState({});       // { fieldId: { label, value } }

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

  if (submitted) {
    return (
      <div className={s.successRoot}>
        <div className={s.successCard}>
          <div className={s.successIconWrap}>
            <CheckCircle2 size={48} strokeWidth={1.5} className={s.successIcon} />
          </div>
          <h2 className={s.successTitle}>Form Submitted Successfully</h2>
          <p className={s.successSub}>
            Your responses have been recorded. You can view them in the
            <strong> Submission</strong> panel.
          </p>
          <button className={s.successBtn} onClick={() => onExitPreview?.()}>
            ← Back to Builder
          </button>
        </div>
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

  /**
   * Submit Form — preview submission.
   *
   * Walks every field across every block/page, evaluates conditional logic
   * (so hidden/disabled fields are skipped), then validates the value. If
   * anything fails, jump to the first offending page, surface a toast, and
   * do NOT persist. Preview-only persistence is localStorage; the real
   * backend submit happens from the site/data-capture flow.
   */
  const handleSubmit = async () => {
    if (submitting) return;

    // Build the flat value map runtimeEngine expects: { fieldId: value }.
    const valueMap = Object.fromEntries(
      Object.entries(values).map(([id, v]) => [id, v?.value]),
    );

    // Find the first field with an error (across all pages, in document order).
    let firstError = null;
    outer: for (let bi = 0; bi < blocks.length; bi += 1) {
      const block = blocks[bi];
      for (let pi = 0; pi < block.pages.length; pi += 1) {
        const page = block.pages[pi];
        for (const f of page.fields ?? []) {
          const evalRes = evaluateField(f, valueMap);
          if (evalRes.hidden || evalRes.disabled) continue;
          const err = validateField({ ...f, required: evalRes.required }, valueMap[f.id]);
          if (err) {
            firstError = { blockIdx: bi, pageIdx: pi, fieldId: f.id, message: err };
            break outer;
          }
        }
      }
    }

    if (firstError) {
      setBlockIdx(firstError.blockIdx);
      setPageIdx(firstError.pageIdx);
      dispatch(addToast({
        type: 'error',
        message: `Cannot submit — please fix: ${firstError.message}`,
        duration: 5000,
      }));
      // Scroll the offending field into view after the page state settles.
      setTimeout(() => {
        const el = document.querySelector(`[data-field-id="${firstError.fieldId}"]`);
        if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }

    setSubmitting(true);
    try {
      await formResponsesClient.create(meta.formId ?? null, meta.formTitle, values);
      dispatch(addToast({ type: 'success', message: 'Form submitted successfully.' }));
      setSubmitted(true);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to submit form. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
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
                const isLayout = ['h2', 'paragraph', 'divider'].includes(field.type);
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
                  <div key={field.id} data-field-id={field.id} style={{ minWidth: 0 }}>
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

            {isLastPage ? (
              <button
                className={s.btnSubmit}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Form'} <CheckCircle2 size={14} />
              </button>
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
function FieldInput({ field, value, onChange }) {
  const v = value ?? '';

  switch (field.type) {
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
    case 'date':     return <PlatformDatePicker value={v ?? ''} onChange={onChange} />;
    case 'datetime': return <input type="datetime-local" className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'time':     return <input type="time"           className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'select': {
      if (field.multiple) {
        const selected = Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);
        return (
          <select
            className={s.select}
            multiple
            size={Math.min(6, Math.max(3, (field.options ?? []).length))}
            value={selected}
            onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      return (
        <select className={s.select} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder || 'Select an option…'}</option>
          {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case 'radiogroup':
      return (
        <div className={s.choiceGroup}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} className={`${s.choiceItem} ${v === o.value ? s.choiceItemSelected : ''}`}>
              <input type="radio" checked={v === o.value} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    case 'checkboxgroup': {
      const checked = Array.isArray(v) ? v : [];
      return (
        <div className={s.choiceGroup}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} className={`${s.choiceItem} ${checked.includes(o.value) ? s.choiceItemSelected : ''}`}>
              <input
                type="checkbox"
                checked={checked.includes(o.value)}
                onChange={() => {
                  const next = checked.includes(o.value)
                    ? checked.filter((x) => x !== o.value)
                    : [...checked, o.value];
                  onChange(next);
                }}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'toggle':
      return (
        <div className={s.toggleWrap} onClick={() => onChange(!v)}>
          <div className={s.toggleTrack} style={{ background: v ? '#2563eb' : undefined }}>
            <div className={s.toggleThumb} style={{ transform: v ? 'translateX(18px)' : 'translateX(0)' }} />
          </div>
          <span className={s.toggleLabel}>{v ? 'On' : 'Off'}</span>
        </div>
      );
    case 'file':
      return (
        <div className={s.fileZone}>
          <UploadCloud size={20} className={s.fileIcon} />
          <span className={s.fileText}>Click or drag to upload</span>
        </div>
      );
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
      return <h2 className={s.h2}>{field.label || 'Section Title'}</h2>;
    case 'paragraph':
      return <p className={s.paragraph}>{field.content || field.label || 'Paragraph text.'}</p>;
    case 'divider':
      return <hr className={s.divider} />;
    default:
      return <input type="text" className={s.input} placeholder={field.placeholder || ''} value={v} onChange={(e) => onChange(e.target.value)} />;
  }
}
