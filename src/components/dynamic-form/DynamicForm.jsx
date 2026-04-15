/**
 * DynamicForm
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a fully working form from a JSON schema.
 * Supports TWO schema shapes:
 *
 *  A) Study Form Builder schema (blocks → pages → fields):
 *     { formTitle, blocks: [{ id, title, pages: [{ id, title, fields: [...] }] }] }
 *
 *  B) Flat schema:
 *     { formTitle, fields: [{ id, type, label, required, options, ... }] }
 *
 * Usage:
 *   <DynamicForm schema={formJson} onSubmit={handleSubmit} />
 *   <DynamicForm schema={formJson} onSubmit={handleSubmit} readOnly />
 *   <DynamicForm schema={formJson} onSubmit={handleSubmit} defaultValues={{ name: 'John' }} />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useCallback } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import FieldRenderer from './FieldRenderer';
import s from './DynamicForm.module.css';

/* ─────────────────────────────────────────────────────────────────────────────
 * Schema normalizer
 * Converts BOTH schema shapes into a unified internal format:
 * pages = [{ id, title, description, fields: [...] }]
 * ───────────────────────────────────────────────────────────────────────────── */
function normaliseSchema(schema) {
  if (!schema) return { title: '', pages: [] };

  const title = schema.formTitle || schema.title || 'Form';

  /* ── Flat schema: { fields: [...] } ── */
  if (Array.isArray(schema.fields)) {
    return {
      title,
      pages: [{ id: 'page_1', title: '', description: '', fields: schema.fields }],
    };
  }

  /* ── Study form builder schema: { blocks: [...] } ── */
  if (Array.isArray(schema.blocks)) {
    const pages = [];
    schema.blocks.forEach((block) => {
      (block.pages ?? []).forEach((pg) => {
        pages.push({
          id:          `${block.id}__${pg.id}`,
          blockTitle:  block.title,
          title:       pg.title,
          description: pg.description || '',
          fields:      pg.fields ?? [],
        });
      });
    });
    return { title, pages };
  }

  return { title, pages: [] };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Validation
 * ───────────────────────────────────────────────────────────────────────────── */
function validateField(field, value) {
  const { required, type, validation = {}, label } = field;
  const name = label || field.id;

  /* layout fields never validate */
  if (['h2', 'paragraph', 'divider'].includes(type)) return null;

  /* required check */
  if (required) {
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty) return `${name} is required.`;
  }

  if (!value && value !== 0) return null;           // no further checks if empty

  /* type-specific */
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Please enter a valid email address.';
  }
  if (type === 'phone' && !/^[+\d\s\-().]{7,20}$/.test(value)) {
    return 'Please enter a valid phone number.';
  }
  if (type === 'number' && isNaN(Number(value))) {
    return 'Please enter a valid number.';
  }

  /* pattern */
  if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
    return 'Value does not match the required format.';
  }

  /* min / max length */
  if (validation.minLength && String(value).length < Number(validation.minLength)) {
    return `Minimum ${validation.minLength} characters required.`;
  }
  if (validation.maxLength && String(value).length > Number(validation.maxLength)) {
    return `Maximum ${validation.maxLength} characters allowed.`;
  }

  /* numeric range */
  if (validation.min !== undefined && Number(value) < Number(validation.min)) {
    return `Value must be at least ${validation.min}.`;
  }
  if (validation.max !== undefined && Number(value) > Number(validation.max)) {
    return `Value must be at most ${validation.max}.`;
  }

  return null;
}

function validatePage(page, formData) {
  const errors = {};
  page.fields.forEach((field) => {
    const err = validateField(field, formData[field.id]);
    if (err) errors[field.id] = err;
  });
  return errors;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Conditional visibility
 * Evaluates field.condition = { enabled, logic:'AND'|'OR', rules:[{fieldId,operator,value}] }
 * ───────────────────────────────────────────────────────────────────────────── */
function isVisible(field, formData) {
  const cond = field.condition;
  if (!cond?.enabled || !cond.rules?.length) return true;

  const results = cond.rules.map((rule) => {
    const current = formData[rule.fieldId];
    switch (rule.operator) {
      case 'equals':        return String(current) === String(rule.value);
      case 'not_equals':    return String(current) !== String(rule.value);
      case 'contains':      return String(current ?? '').includes(rule.value);
      case 'not_contains':  return !String(current ?? '').includes(rule.value);
      case 'is_empty':      return !current || current === '';
      case 'is_not_empty':  return !!current && current !== '';
      default:              return true;
    }
  });

  return cond.logic === 'OR'
    ? results.some(Boolean)
    : results.every(Boolean);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * DynamicForm — main component
 * ───────────────────────────────────────────────────────────────────────────── */
export default function DynamicForm({
  schema,
  onSubmit,
  defaultValues = {},
  readOnly      = false,
  submitLabel   = 'Submit Form',
  className     = '',
}) {
  const { title, pages } = useMemo(() => normaliseSchema(schema), [schema]);

  const [formData,   setFormData]   = useState(defaultValues);
  const [errors,     setErrors]     = useState({});
  const [pageIdx,    setPageIdx]    = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const currentPage = pages[pageIdx] ?? { fields: [] };
  const isFirst     = pageIdx === 0;
  const isLast      = pageIdx === pages.length - 1;
  const totalPages  = pages.length;

  /* progress percentage */
  const progress = totalPages > 0 ? Math.round(((pageIdx + 1) / totalPages) * 100) : 100;

  /* visible fields on current page (apply conditional logic) */
  const visibleFields = currentPage.fields.filter(
    (f) => !f.hidden && isVisible(f, formData),
  );

  /* ── value updater ──────────────────────────────────────────────────────── */
  const handleChange = useCallback((fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev)  => ({ ...prev, [fieldId]: undefined }));
  }, []);

  /* ── go to next page ────────────────────────────────────────────────────── */
  const handleNext = useCallback(() => {
    const pageErrors = validatePage(
      { ...currentPage, fields: visibleFields },
      formData,
    );
    if (Object.keys(pageErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...pageErrors }));
      /* scroll to first error */
      const firstErrId = Object.keys(pageErrors)[0];
      document.getElementById(firstErrId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setPageIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, visibleFields, formData]);

  /* ── go to previous page ────────────────────────────────────────────────── */
  const handlePrev = useCallback(() => {
    setPageIdx((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ── final submit ───────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    /* validate current (last) page */
    const pageErrors = validatePage(
      { ...currentPage, fields: visibleFields },
      formData,
    );
    if (Object.keys(pageErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...pageErrors }));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit?.(formData);
      setSubmitted(true);
    } catch {
      /* errors surfaced by the parent via toast */
    } finally {
      setSubmitting(false);
    }
  }, [currentPage, visibleFields, formData, onSubmit]);

  /* ── success screen ─────────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className={s.successRoot}>
        <div className={s.successCard}>
          <div className={s.successIconWrap}>
            <CheckCircle2 size={48} strokeWidth={1.5} className={s.successIcon} />
          </div>
          <h2 className={s.successTitle}>Form Submitted Successfully</h2>
          <p className={s.successSub}>
            Your responses have been recorded.
          </p>
          <button className={s.successBtn} onClick={() => { setSubmitted(false); setPageIdx(0); setFormData(defaultValues); }}>
            Fill again
          </button>
        </div>
      </div>
    );
  }

  /* ── empty schema guard ─────────────────────────────────────────────────── */
  if (pages.length === 0) {
    return (
      <div className={s.emptyRoot}>
        <p className={s.emptyText}>This form has no fields configured.</p>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Main render
   * ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className={`${s.root} ${className}`}>
      <form
        className={s.formShell}
        onSubmit={handleSubmit}
        noValidate
      >

        {/* ── Form title ──────────────────────────────────────────────── */}
        {title && <h1 className={s.formTitle}>{title}</h1>}

        {/* ── Progress bar ────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <>
            <div className={s.progressWrap}>
              <div className={s.progressBar} style={{ width: `${progress}%` }} />
            </div>
            <p className={s.progressLabel}>{progress}% complete</p>
          </>
        )}

        {/* ── Page tab strip (when > 1 page) ──────────────────────────── */}
        {totalPages > 1 && (
          <div className={s.pageTabs}>
            {pages.map((pg, i) => (
              <button
                key={pg.id}
                type="button"
                className={`
                  ${s.pageTab}
                  ${i === pageIdx   ? s.pageTabActive : ''}
                  ${i  < pageIdx    ? s.pageTabDone   : ''}
                `}
                onClick={() => i < pageIdx && setPageIdx(i)}
                disabled={i > pageIdx}
              >
                {i < pageIdx && <span className={s.pageTabCheck}>✓</span>}
                {pg.blockTitle ? `${pg.blockTitle} — ${pg.title}` : pg.title || `Page ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* ── Page heading ────────────────────────────────────────────── */}
        {(currentPage.title || currentPage.description) && (
          <div className={s.pageHeading}>
            {currentPage.title && (
              <div className={s.pageTitleRow}>
                <h2 className={s.pageTitle}>{currentPage.title}</h2>
                {totalPages > 1 && (
                  <span className={s.pageCounter}>
                    {pageIdx + 1} / {totalPages}
                  </span>
                )}
              </div>
            )}
            {currentPage.description && (
              <p className={s.pageDesc}>{currentPage.description}</p>
            )}
          </div>
        )}

        {/* ── Fields ──────────────────────────────────────────────────── */}
        <div className={s.fields}>
          {visibleFields.length === 0 ? (
            <div className={s.noFields}>
              <p>No fields on this page.</p>
            </div>
          ) : (
            visibleFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={formData[field.id]}
                error={errors[field.id]}
                readOnly={readOnly || field.readOnly}
                onChange={(val) => handleChange(field.id, val)}
              />
            ))
          )}
        </div>

        {/* ── Navigation footer ───────────────────────────────────────── */}
        <div className={s.navFooter}>
          {/* Previous */}
          <button
            type="button"
            className={s.btnPrev}
            onClick={handlePrev}
            disabled={isFirst}
          >
            <ChevronLeft size={15} /> Previous
          </button>

          {/* Page dots */}
          {totalPages > 1 && (
            <div className={s.dots}>
              {pages.map((_, i) => (
                <span
                  key={i}
                  className={`${s.dot} ${i === pageIdx ? s.dotActive : ''} ${i < pageIdx ? s.dotDone : ''}`}
                />
              ))}
            </div>
          )}

          {/* Next / Submit */}
          {isLast ? (
            readOnly ? null : (
              <button
                type="submit"
                className={s.btnSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <><Loader2 size={14} className={s.spinner} /> Submitting…</>
                  : <><CheckCircle2 size={14} /> {submitLabel}</>
                }
              </button>
            )
          ) : (
            <button
              type="button"
              className={s.btnNext}
              onClick={handleNext}
            >
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>

      </form>
    </div>
  );
}
