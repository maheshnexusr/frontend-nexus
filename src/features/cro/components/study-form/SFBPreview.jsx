/**
 * SFBPreview — interactive participant-facing preview of the study form.
 * Collects real input, saves responses to localStorage on submit.
 */

import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  ChevronLeft, ChevronRight, CheckCircle2,
  UploadCloud, PenLine, Star, Layers,
} from 'lucide-react';
import { selectBlocks, selectFormMeta } from '@/features/cro/store/studyFormSlice';
import { formResponsesClient } from '@/features/cro/api/formResponsesClient';
import s from './SFBPreview.module.css';

export default function SFBPreview({ onExitPreview }) {
  const blocks = useSelector(selectBlocks);
  const meta   = useSelector(selectFormMeta);

  const [blockIdx,  setBlockIdx]  = useState(0);
  const [pageIdx,   setPageIdx]   = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [values,    setValues]    = useState({});   // { fieldId: value }

  const setValue = (fieldId, label, value) =>
    setValues((prev) => ({ ...prev, [fieldId]: { label, value } }));

  // ── empty state ──────────────────────────────────────────────────────────
  if (blocks.length === 0) {
    return (
      <div className={s.emptyRoot} style={{ flex: 1 }}>
        <Layers size={40} strokeWidth={1.25} className={s.emptyIcon} />
        <p className={s.emptyTitle}>Nothing to preview yet</p>
        <p className={s.emptySub}>Add blocks and fields in the Builder tab first.</p>
      </div>
    );
  }

  // ── success screen ───────────────────────────────────────────────────────
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

  // ── guard clamp ──────────────────────────────────────────────────────────
  const bi    = Math.min(blockIdx, blocks.length - 1);
  const block = blocks[bi];
  const pi    = Math.min(pageIdx, block.pages.length - 1);
  const page  = block.pages[pi];

  const isFirstPage = bi === 0 && pi === 0;
  const isLastPage  = bi === blocks.length - 1 && pi === block.pages.length - 1;

  // ── navigation ───────────────────────────────────────────────────────────
  const goNext = () => {
    if (pi < block.pages.length - 1) { setPageIdx(pi + 1); }
    else if (bi < blocks.length - 1) { setBlockIdx(bi + 1); setPageIdx(0); }
  };
  const goPrev = () => {
    if (pi > 0) { setPageIdx(pi - 1); }
    else if (bi > 0) { const pb = blocks[bi - 1]; setBlockIdx(bi - 1); setPageIdx(pb.pages.length - 1); }
  };
  const goBlock = (i) => { setBlockIdx(i); setPageIdx(0); };
  const goPage  = (i) => setPageIdx(i);

  // ── progress ─────────────────────────────────────────────────────────────
  const totalPages = blocks.reduce((acc, b) => acc + b.pages.length, 0);
  const donePages  = blocks.slice(0, bi).reduce((acc, b) => acc + b.pages.length, 0) + pi + 1;
  const pct        = Math.round((donePages / totalPages) * 100);

  // ── submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    await formResponsesClient.create(meta.formId ?? null, meta.formTitle, values);
    setSubmitted(true);
  };

  return (
    <div className={s.root}>
      <div className={s.formShell}>

        {/* Form title */}
        <div className={s.formTitle}>
          {meta.formTitle || 'Study Data Collection Form'}
        </div>

        {/* Progress */}
        <div className={s.progressWrap}>
          <div className={s.progressBar} style={{ width: `${pct}%` }} />
        </div>
        <div className={s.progressLabel}>{pct}% complete</div>

        {/* Block stepper */}
        <div className={s.blockStepper}>
          {blocks.map((blk, i) => {
            const done   = i < bi;
            const active = i === bi;
            const locked = i > bi;
            return (
              <div key={blk.id} className={s.stepItem}>
                {i > 0 && (
                  <div className={`${s.stepLine} ${done || active ? s.stepLineDone : ''}`} />
                )}
                <button
                  className={`${s.stepCircle} ${done ? s.stepCircleDone : ''} ${active ? s.stepCircleActive : ''} ${locked ? s.stepCircleLocked : ''}`}
                  onClick={() => !locked && goBlock(i)}
                  disabled={locked}
                  title={blk.title}
                >
                  {done ? <CheckCircle2 size={14} strokeWidth={2.5} /> : i + 1}
                </button>
                <span className={`${s.stepLabel} ${active ? s.stepLabelActive : ''} ${locked ? s.stepLabelLocked : ''}`}>
                  {blk.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Page tabs */}
        {block.pages.length > 1 && (
          <div className={s.pageTabs}>
            {block.pages.map((pg, i) => (
              <button
                key={pg.id}
                className={`${s.pageTab} ${i === pi ? s.pageTabActive : ''} ${i < pi ? s.pageTabDone : ''}`}
                onClick={() => i <= pi && goPage(i)}
                disabled={i > pi}
              >
                {i < pi && <span className={s.pageTabCheck}>✓</span>}
                {pg.title}
              </button>
            ))}
          </div>
        )}

        {/* Page heading */}
        <div className={s.pageHeading}>
          <h2 className={s.pageTitle}>{page.title}</h2>
          <span className={s.pageCounter}>Page {pi + 1} of {block.pages.length}</span>
        </div>
        {page.description && <p className={s.pageDesc}>{page.description}</p>}

        {/* Fields */}
        <div className={s.fields}>
          {page.fields.length === 0 ? (
            <div className={s.noFields}>
              <p>This page has no fields yet.</p>
            </div>
          ) : (
            page.fields.map((field) => (
              <FieldPreview
                key={field.id}
                field={field}
                value={values[field.id]?.value}
                onChange={(v) => setValue(field.id, field.label, v)}
              />
            ))
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
                  onClick={() => i <= pi && goPage(i)}
                />
              ))}
            </div>
          )}

          {isLastPage ? (
            <button className={s.btnSubmit} onClick={handleSubmit}>
              Submit Form <CheckCircle2 size={14} />
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
  );
}

/* ── Field wrapper ───────────────────────────────────────────────────────── */
function FieldPreview({ field, value, onChange }) {
  const isLayout = ['h2', 'paragraph', 'divider'].includes(field.type);
  return (
    <div className={`${s.fieldWrap} ${isLayout ? s.fieldWrapLayout : ''}`}>
      {!isLayout && field.label && (
        <label className={s.fieldLabel}>
          {field.label}
          {field.required && <span className={s.req}> *</span>}
        </label>
      )}
      {!isLayout && field.helpText && (
        <p className={s.fieldHelp}>{field.helpText}</p>
      )}
      <FieldInput field={field} value={value} onChange={onChange} />
    </div>
  );
}

/* ── Interactive field renderer ──────────────────────────────────────────── */
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
    case 'select':
      return (
        <select className={s.select} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder || 'Select an option…'}</option>
          {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
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
