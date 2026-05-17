/**
 * StudyFormRunner — shared participant view of the eCRF form, used by both
 * the sponsor and site data-capture pages.
 *
 * Mirrors the visual layout of the CRO designer's SFBPreview (left rail
 * stepper for blocks/pages + main content panel + nav footer) but is fully
 * prop-driven (no Redux), and uses a plain FieldInput (no CRO-side
 * collaboration toolbar / queries / verification — those live in their own
 * features).
 *
 * Props:
 *   blocks         — array from form_structure.blocks
 *   formTitle      — heading shown in the sidebar
 *   defaultValues  — { [fieldId]: value } loaded from the backend
 *   onSubmit(vals) — async callback with { [fieldId]: value }
 *   submitLabel    — text for the final submit button
 *   readOnly       — disables inputs and submit
 */

import { useEffect, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2,
  UploadCloud, PenLine, Star, Layers,
} from 'lucide-react';
import s from '@/features/cro/components/study-form/SFBPreview.module.css';

const LABEL_STYLE = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#0f172a',
  marginBottom: 6,
};
const REQUIRED_STYLE = { color: '#dc2626' };
// Local overrides for SFBPreview.module.css — tighten the side gutters and
// let the form fill the available width instead of capping at 880px.
const MAIN_COL_STYLE      = { padding: '20px 16px 28px' };
const CONTENT_SHELL_STYLE = { maxWidth: 'none' };

export default function StudyFormRunner({
  blocks = [],
  formTitle = 'Study Form',
  defaultValues = {},
  onSubmit,
  submitLabel = 'Submit Form',
  readOnly = false,
}) {
  const [blockIdx,  setBlockIdx]  = useState(0);
  const [pageIdx,   setPageIdx]   = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [values,    setValues]    = useState(defaultValues);
  const [busy,      setBusy]      = useState(false);

  useEffect(() => { setValues(defaultValues || {}); }, [defaultValues]);

  const setValue = (fieldId, value) =>
    setValues((prev) => ({ ...prev, [fieldId]: value }));

  if (!blocks.length) {
    return (
      <div className={s.emptyRoot} style={{ flex: 1 }}>
        <Layers size={40} strokeWidth={1.25} className={s.emptyIcon} />
        <p className={s.emptyTitle}>This study has no form yet</p>
        <p className={s.emptySub}>Ask the CRO admin to publish a form design first.</p>
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
          <p className={s.successSub}>Your responses have been recorded.</p>
        </div>
      </div>
    );
  }

  const bi    = Math.min(blockIdx, blocks.length - 1);
  const block = blocks[bi];
  const pi    = Math.min(pageIdx, block.pages.length - 1);
  const page  = block.pages[pi];

  const isFirstPage = bi === 0 && pi === 0;
  const isLastPage  = bi === blocks.length - 1 && pi === block.pages.length - 1;

  const goNext = () => {
    if (pi < block.pages.length - 1) setPageIdx(pi + 1);
    else if (bi < blocks.length - 1) { setBlockIdx(bi + 1); setPageIdx(0); }
  };
  const goPrev = () => {
    if (pi > 0) setPageIdx(pi - 1);
    else if (bi > 0) {
      const pb = blocks[bi - 1];
      setBlockIdx(bi - 1);
      setPageIdx(pb.pages.length - 1);
    }
  };
  const goBlock = (i) => { setBlockIdx(i); setPageIdx(0); };
  const goPage  = (i) => setPageIdx(i);

  const totalPages = blocks.reduce((acc, b) => acc + b.pages.length, 0);
  const donePages  = blocks.slice(0, bi).reduce((acc, b) => acc + b.pages.length, 0) + pi + 1;
  const pct        = Math.round((donePages / totalPages) * 100);

  const handleSubmit = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      await onSubmit?.(values);
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.root}>
      <aside className={s.sidebar}>
        <div className={s.sidebarHead}>
          <span className={s.sidebarTitle}>{formTitle}</span>
          <span className={s.sidebarSub}>{pct}% complete</span>
          <div className={s.progressWrap}>
            <div className={s.progressBar} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <nav className={s.stepList} aria-label="Form sections">
          {blocks.map((blk, i) => {
            const isPast    = i < bi;
            const isCurrent = i === bi;
            const isFuture  = i > bi;
            return (
              <div key={blk.id} className={s.stepBlock}>
                <button
                  type="button"
                  className={`${s.stepBlockHead} ${isCurrent ? s.stepBlockHeadActive : ''} ${isPast ? s.stepBlockHeadDone : ''}`}
                  onClick={() => !isFuture && goBlock(i)}
                  disabled={isFuture}
                  title={blk.title}
                >
                  <span className={`${s.stepBadge} ${isPast ? s.stepBadgeDone : ''} ${isCurrent ? s.stepBadgeActive : ''}`}>
                    {isPast ? <CheckCircle2 size={12} strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span className={s.stepBlockLabel}>{blk.title || `Block ${i + 1}`}</span>
                  <span className={s.stepBlockCount}>{blk.pages.length}</span>
                </button>

                {isCurrent && (
                  <ol className={s.pageList}>
                    {blk.pages.map((pg, j) => {
                      const pPast    = j < pi;
                      const pCurrent = j === pi;
                      return (
                        <li key={pg.id}>
                          <button
                            type="button"
                            className={`${s.pageItem} ${pCurrent ? s.pageItemActive : ''} ${pPast ? s.pageItemDone : ''}`}
                            onClick={() => j <= pi && goPage(j)}
                            disabled={j > pi}
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

      <div className={s.mainCol} style={MAIN_COL_STYLE}>
        <div className={s.contentShell} style={CONTENT_SHELL_STYLE}>
          <div className={s.pageHeading}>
            <div>
              <h2 className={s.pageTitle}>{page.title}</h2>
              {page.description && <p className={s.pageDesc}>{page.description}</p>}
            </div>
            <span className={s.pageCounter}>
              Page {pi + 1} / {block.pages.length} · Block {bi + 1} / {blocks.length}
            </span>
          </div>

          <div className={s.fields}>
            {page.fields.length === 0 ? (
              <div className={s.noFields}>
                <p>This page has no fields.</p>
              </div>
            ) : (
              page.fields.map((field) => {
                const isLayout = ['h2', 'paragraph', 'divider'].includes(field.type);
                return (
                  <div
                    key={field.id}
                    className={`${s.fieldWrap} ${isLayout ? s.fieldWrapLayout : ''}`}
                  >
                    {!isLayout && (
                      <label style={LABEL_STYLE}>
                        {field.label}
                        {field.required && <span style={REQUIRED_STYLE}> *</span>}
                      </label>
                    )}
                    <fieldset
                      disabled={readOnly}
                      style={{ border: 0, padding: 0, margin: 0 }}
                    >
                      <FieldInput
                        field={field}
                        value={values[field.id]}
                        onChange={(v) => setValue(field.id, v)}
                      />
                    </fieldset>
                  </div>
                );
              })
            )}
          </div>

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
                    onClick={() => i <= pi && goPage(i)}
                  />
                ))}
              </div>
            )}

            {isLastPage ? (
              <button
                className={s.btnSubmit}
                onClick={handleSubmit}
                disabled={readOnly || busy}
              >
                {busy ? 'Submitting…' : submitLabel} <CheckCircle2 size={14} />
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
        </div>
      </div>
    </div>
  );
}

/* ── Plain field renderer (no collab stack) ──────────────────────────────── */
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
    case 'date':
      return <input type="date" className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <input type="datetime-local" className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <input type="time" className={s.input} value={v} onChange={(e) => onChange(e.target.value)} />;
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
          {[1, 2, 3, 4, 5].map((n) => (
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
      return (
        <input
          type="text"
          className={s.input}
          placeholder={field.placeholder || ''}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
