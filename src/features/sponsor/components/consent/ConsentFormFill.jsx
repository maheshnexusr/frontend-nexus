/**
 * ConsentFormFill — lightweight renderer for a consent form_structure built with
 * the drag-and-drop Consent Builder. Renders the layout text (headings,
 * paragraphs) read-only and captures values for the data + signature fields.
 *
 * This is intentionally NOT the full StudyFormRunner (which is tied to subject
 * data-capture, queries and verification). Consent only needs: read the form,
 * fill a few fields, sign, submit.
 *
 * Props:
 *   blocks    — form_structure.blocks
 *   values    — { [fieldId]: value }
 *   onChange  — (fieldId, value) => void
 *   disabled  — read-only
 */
import { useState, useEffect, useRef } from 'react';
import { Paperclip, X, FileText, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import SignaturePad from '@/components/form/SignaturePad';
import { uploadFormFile } from '@/api/formFileClient';
import { resolveFileUrl } from '@/api/fileUrl';
import { useProtectedFileUrl, isProtectedUrl } from '@/api/protectedFile';
import { headingStyleToCss } from '@/features/cro/components/study-form/headingStyle';
import sp from '@/features/cro/components/study-form/SFBPreview.module.css';
import s from './ConsentFormFill.module.css';

const LAYOUT_TYPES = new Set(['h2', 'h3', 'paragraph', 'divider']);

// Convert a base64 data URL (e.g. a drawn signature) to a File for upload.
function dataUrlToFile(dataUrl, filename) {
  const [meta, b64] = String(dataUrl).split(',');
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/png';
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

// File / image upload — uploads to disk via the shared form-files endpoint and
// stores only a small { url, name, type, size } ref as the field value (same
// shape the main form runner uses), so the consent submission carries a link.
function FileField({ field, value, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  // Object URL of the file the user JUST picked — instant, reliable preview
  // without round-tripping the authenticated route. Used only this session.
  const [localUrl, setLocalUrl] = useState(null);
  const isImage = field.type === 'image';
  const accept  = field.accept || (isImage ? 'image/*' : '');
  // Show an inline image preview whenever the uploaded file IS an image, even
  // for a generic "file" field (e.g. a Cancelled Cheque PNG) — by field type or
  // by the uploaded file's name/url extension.
  const showImage = isImage || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(value?.name || value?.url || '');

  // For a previously-saved value (review / re-open) the file is private, so it
  // must be streamed through the authenticated route. Hook runs every render.
  const prot = useProtectedFileUrl(localUrl ? null : value?.url);
  const isProt = isProtectedUrl(value?.url);
  // Prefer the just-picked local file; else the protected stream; else plain.
  const href = localUrl || (isProt ? prot.src : resolveFileUrl(value?.url));

  // Revoke the local object URL when it changes / on unmount.
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setErr(''); setBusy(true);
    setLocalUrl(URL.createObjectURL(file)); // show it immediately
    try {
      const ref = await uploadFormFile(file, 'consent_forms');
      onChange(ref);
    } catch (ex) {
      setErr(ex?.response?.data?.message || ex?.message || 'Upload failed.');
      setLocalUrl(null);
    } finally { setBusy(false); }
  };

  if (value?.url || localUrl) {
    const ready = Boolean(localUrl) || !isProt || (!prot.loading && href);
    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: showImage ? 10 : '8px 10px' }}>
        {/* Inline preview for images — the reviewer sees the actual file. */}
        {showImage && ready && (
          <a href={href} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 8 }}>
            <img
              src={href}
              alt={value?.name || 'image'}
              style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, display: 'block', border: '1px solid #e2e8f0' }}
            />
          </a>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showImage
            ? (!ready && <span style={{ width: 36, height: 36, borderRadius: 6, background: '#f1f5f9', flexShrink: 0 }} />)
            : <FileText size={18} style={{ color: '#64748b', flexShrink: 0 }} />}
          {ready ? (
            <a href={href} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' }}>
              {value?.name || 'Uploaded file'}
            </a>
          ) : (
            <span style={{ flex: 1, fontSize: 13, color: '#94a3b8' }}>{prot.error ? 'Failed to load file' : 'Loading…'}</span>
          )}
          {!disabled && (
            <button type="button" onClick={() => onChange(null)} title="Remove"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'inline-flex' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#334155',
        border: '1px dashed #cbd5e1', borderRadius: 8, padding: '9px 14px', cursor: disabled || busy ? 'not-allowed' : 'pointer' }}>
        <Paperclip size={15} />
        {busy ? 'Uploading…' : (isImage ? 'Choose image' : 'Choose file')}
        <input type="file" accept={accept} disabled={disabled || busy} onChange={handleFile} style={{ display: 'none' }} />
      </label>
      {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

// Read-only signature preview (review / disabled). Accepts a {url} ref (new,
// uploaded as a file), a /uploads path, or a legacy base64 data URL.
function SignatureImage({ value }) {
  const url = value && typeof value === 'object' ? value.url : value;
  const prot = useProtectedFileUrl(isProtectedUrl(url) ? url : null);
  if (!url) return <span style={{ fontSize: 12.5, color: '#94a3b8' }}>Not signed</span>;
  let src;
  if (isProtectedUrl(url)) { if (prot.loading) return <span style={{ fontSize: 12.5, color: '#94a3b8' }}>Loading…</span>; src = prot.src; }
  else if (/^data:/.test(url)) src = url;
  else src = resolveFileUrl(url);
  if (!src) return <span style={{ fontSize: 12.5, color: '#dc2626' }}>Unavailable</span>;
  return <img src={src} alt="Signature" style={{ maxWidth: 220, maxHeight: 90, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }} />;
}

// Signature capture that UPLOADS the drawing as a PNG file (like other consent
// attachments) shortly after signing, storing a { url, name, type, size } ref.
// Read-only mode shows the captured image. Legacy data-URL values still render.
function SignatureField({ value, onChange, disabled }) {
  const isRef = value && typeof value === 'object' && value.url;
  const [localDataUrl, setLocalDataUrl] = useState(typeof value === 'string' ? value : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const timer = useRef(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (disabled) return <SignatureImage value={value} />;

  const handlePadChange = (dataUrl) => {
    setLocalDataUrl(dataUrl);
    if (timer.current) clearTimeout(timer.current);
    if (!dataUrl) { setErr(''); onChange(null); return; }
    // Debounce so we upload once the user pauses, not on every stroke.
    timer.current = setTimeout(async () => {
      setErr(''); setBusy(true);
      try {
        const file = dataUrlToFile(dataUrl, `signature-${Date.now()}.png`);
        const ref = await uploadFormFile(file, 'consent_forms');
        onChange(ref);
      } catch (ex) {
        setErr(ex?.response?.data?.message || ex?.message || 'Signature upload failed.');
      } finally { setBusy(false); }
    }, 700);
  };

  return (
    <div>
      {/* When a ref already exists (re-opened a saved draft) the pad starts blank;
          drawing again replaces it. */}
      <SignaturePad value={localDataUrl} onChange={handlePadChange} disabled={busy} />
      {busy && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Saving signature…</div>}
      {!busy && isRef && !err && <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>Signature saved.</div>}
      {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

/** All fields across blocks/pages, in order. */
export function flattenConsentFields(blocks) {
  const out = [];
  for (const blk of blocks ?? []) {
    for (const pg of blk.pages ?? []) {
      for (const f of pg.fields ?? []) out.push(f);
    }
  }
  return out;
}

/** Required + data-bearing field ids that are still empty. */
export function missingRequired(blocks, values) {
  return flattenConsentFields(blocks)
    .filter((f) => !LAYOUT_TYPES.has(f.type) && f.required)
    .filter((f) => {
      const v = values[f.id];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === '';
    })
    .map((f) => f.id);
}

// The message shown when a required field is left empty. Mirrors the data-capture
// runtime: prefer the field's configured Hard/Required message, else a default,
// with the {Field Name} token filled from the field label.
function requiredMessage(field) {
  const hm = field.hardMessage ?? field.hard_message;
  const rm = field.requiredMessage ?? field.required_message;
  const msg = (hm && hm.trim()) || (rm && rm.trim()) || '{Field Name} is required.';
  return msg.replace(/\{Field Name\}/g, field.label || 'This field');
}

function inputType(t) {
  if (t === 'datetime') return 'datetime-local';
  if (t === 'number') return 'number';
  if (t === 'email') return 'email';
  if (t === 'phone') return 'tel';
  if (t === 'date' || t === 'time') return t;
  return 'text';
}

// Renders ONE field using the SAME styling as the consent builder preview
// (SFBPreview.module.css `sp` + headingStyleToCss), so the user / reviewer see
// exactly the form that was designed — but with WORKING inputs (the builder
// preview's file/signature are non-functional placeholders).
// Display-only Paragraph — renders the designer's rich-text HTML verbatim (the
// Consent Builder reuses the Study Form Designer's Quill editor, storing HTML on
// field.content), or legacy plain text with line breaks preserved. Mirrors the
// builder's RichParagraph (SFBPreview) exactly so Builder / Preview / Published
// Consent / Participant View all render identically.
const PARA_HTML_RE = /<[a-z][\s\S]*>/i;
function ConsentRichParagraph({ field }) {
  const raw  = field.content ?? field.label ?? '';
  const text = typeof raw === 'string' ? raw : '';
  if (!text.trim()) return <p className={sp.paragraph}>Paragraph text.</p>;
  if (PARA_HTML_RE.test(text)) {
    return <div className={sp.richParagraph} dangerouslySetInnerHTML={{ __html: text }} />;
  }
  return <div className={`${sp.richParagraph} ${sp.richParagraphPlain}`}>{text}</div>;
}

function FieldRow({ field, value, onChange, disabled, invalid }) {
  const { type, label, helpText, placeholder, options = [], required } = field;

  // Layout/content fields — rendered exactly like the builder.
  if (type === 'h2') return <h2 className={sp.h2} style={headingStyleToCss(field)}>{label || 'Section Title'}</h2>;
  if (type === 'h3') return <h3 className={sp.h3} style={headingStyleToCss(field)}>{label || 'Sub-heading'}</h3>;
  if (type === 'paragraph') return <ConsentRichParagraph field={field} />;
  if (type === 'divider') return <hr className={sp.divider} />;

  const v = value ?? '';
  let control = null;
  switch (type) {
    case 'text':
    case 'number':
    case 'email':
    case 'phone':
      control = <input type={inputType(type)} className={sp.input} placeholder={placeholder || ''}
                  value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'date':
    case 'datetime':
    case 'time':
      control = <input type={inputType(type)} className={sp.input}
                  value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'textarea':
      control = <textarea className={sp.textarea} rows={field.rows ?? 3} placeholder={placeholder || ''}
                  value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      control = (
        <select className={sp.select} value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder || 'Select an option…'}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'radiogroup':
      control = (
        <div className={sp.choiceGroup}>
          {options.map((o) => (
            <label key={o.value} className={`${sp.choiceItem} ${v === o.value ? sp.choiceItemSelected : ''}`}>
              <input type="radio" checked={v === o.value} disabled={disabled} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
      break;
    case 'checkboxgroup': {
      const checked = Array.isArray(value) ? value : [];
      control = (
        <div className={sp.choiceGroup}>
          {options.map((o) => (
            <label key={o.value} className={`${sp.choiceItem} ${checked.includes(o.value) ? sp.choiceItemSelected : ''}`}>
              <input type="checkbox" checked={checked.includes(o.value)} disabled={disabled}
                onChange={() => onChange(checked.includes(o.value) ? checked.filter((x) => x !== o.value) : [...checked, o.value])} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
      break;
    }
    case 'toggle':
      control = (
        <div className={sp.toggleWrap} onClick={() => !disabled && onChange(!value)}>
          <div className={sp.toggleTrack} style={{ background: value ? '#2563eb' : undefined }}>
            <div className={sp.toggleThumb} style={{ transform: value ? 'translateX(18px)' : 'translateX(0)' }} />
          </div>
          <span className={sp.toggleLabel}>{value ? 'On' : 'Off'}</span>
        </div>
      );
      break;
    case 'signature':
      control = <SignatureField value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'file':
    case 'image':
      control = <FileField field={field} value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'rating': {
      const max = Number(field.max) || 5;
      const cur = Number(value) || 0;
      control = (
        <div className={sp.stars}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <Star key={n} size={24} className={sp.starIcon}
              style={{ color: n <= cur ? '#f59e0b' : undefined, cursor: disabled ? 'default' : 'pointer' }}
              onClick={() => !disabled && onChange(n)} />
          ))}
        </div>
      );
      break;
    }
    case 'slider': {
      const min = Number(field.minValue ?? field.min ?? 0);
      const max = Number(field.maxValue ?? field.max ?? 100);
      const step = Number(field.step ?? 1);
      const cur = v === '' || v == null ? min : Number(v);
      control = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b', minWidth: 24, textAlign: 'right' }}>{min}</span>
          <input type="range" min={min} max={max} step={step} value={cur} disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#64748b', minWidth: 24 }}>{max}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', minWidth: 32, textAlign: 'right' }}>{cur}</span>
        </div>
      );
      break;
    }
    default:
      control = <input type="text" className={sp.input} placeholder={placeholder || ''}
                  value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div
      className={s.fieldRow}
      data-field-id={field.id}
      style={invalid ? { boxShadow: '0 0 0 2px #fecaca', borderRadius: 8, padding: 8, scrollMarginTop: 80 } : { scrollMarginTop: 80 }}
    >
      <span className={s.label}>{label || 'Field'}{required && <span className={s.req}>*</span>}</span>
      {control}
      {invalid
        ? <span style={{ fontSize: 12, color: '#dc2626', marginTop: 4, display: 'block' }}>{requiredMessage(field)}</span>
        : helpText && <span className={s.help}>{helpText}</span>}
    </div>
  );
}

const widthToColumn = (w) => ({ left: '1 / 2', right: '2 / 3', half: 'auto' }[w]) || '1 / -1';

/** Flatten blocks → an ordered list of pages, each tagged with its parent block. */
function buildPages(blocks) {
  const pages = [];
  (blocks ?? []).forEach((block) => {
    (block.pages ?? []).forEach((page) => pages.push({ block, page }));
  });
  return pages;
}

/** One field cell — layout fields span full width, data fields honour fieldWidth. */
function FieldCell({ field, value, onChange, disabled, invalid }) {
  const isLayout = LAYOUT_TYPES.has(field.type);
  return (
    <div
      data-field-id={field.id}
      className={isLayout ? sp.fieldWrapLayout : undefined}
      style={isLayout ? undefined : { minWidth: 0, gridColumn: widthToColumn(field.fieldWidth) }}
    >
      <FieldRow field={field} value={value} onChange={onChange} disabled={disabled} invalid={invalid} />
    </div>
  );
}

// Scroll to (and centre) the first invalid field by id, after the highlight has
// rendered. Mirrors the data-capture runner's jump-to-missing-field behaviour.
export function scrollToConsentField(fieldId) {
  if (!fieldId || typeof document === 'undefined') return;
  requestAnimationFrame(() => {
    const node = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (node?.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/**
 * Paged renderer — shows ONE page at a time with a Previous/Next footer, styled
 * to match the Consent Builder preview's main column (the dense 2-col field grid)
 * but WITHOUT the outline sidebar. `footerSlot` is shown on the last page in
 * place of "Next" (the gate puts its "Submit Service Agreement" button there).
 */
function PagedConsentForm({ blocks, values, onChange, disabled, footerSlot, invalidSet }) {
  const pages = buildPages(blocks);
  const [idx, setIdx] = useState(0);
  if (pages.length === 0) return <div className={sp.noFields}>No consent content.</div>;

  const safe = Math.min(idx, pages.length - 1);
  const { block, page } = pages[safe];
  const fields = page.fields ?? [];
  const isFirst = safe === 0;
  const isLast = safe === pages.length - 1;

  return (
    <div className={sp.contentShell}>
      <div className={sp.pageHeading}>
        <div>
          <h2 className={sp.pageTitle}>{page.title || block.title || 'Consent'}</h2>
          {page.description && <p className={sp.pageDesc}>{page.description}</p>}
        </div>
        {pages.length > 1 && (
          <span className={sp.pageCounter}>Page {safe + 1} / {pages.length}</span>
        )}
      </div>

      <div className={sp.fields}>
        {fields.length === 0
          ? <div className={sp.noFields}>This page has no content.</div>
          : fields.map((f) => (
              <FieldCell key={f.id} field={f} value={values[f.id]} disabled={disabled}
                invalid={invalidSet?.has(f.id)} onChange={(v) => onChange(f.id, v)} />
            ))}
      </div>

      <div className={sp.navFooter}>
        <button type="button" className={sp.btnPrev} onClick={() => setIdx(safe - 1)} disabled={isFirst}>
          <ChevronLeft size={15} /> Previous
        </button>

        {pages.length > 1 && (
          <div className={sp.dots}>
            {pages.map((_, i) => (
              <span key={i} onClick={() => setIdx(i)}
                className={`${sp.dot} ${i === safe ? sp.dotActive : ''} ${i < safe ? sp.dotDone : ''}`} />
            ))}
          </div>
        )}

        {isLast
          ? (footerSlot ?? <span />)
          : <button type="button" className={sp.btnNext} onClick={() => setIdx(safe + 1)}>Next <ChevronRight size={15} /></button>}
      </div>
    </div>
  );
}

export default function ConsentFormFill({ blocks, values, onChange, disabled, paged = false, footerSlot = null, invalidIds = [] }) {
  // `invalidIds` highlights required fields a Submit/Agree flagged as empty.
  const invalidSet = invalidIds instanceof Set ? invalidIds : new Set(invalidIds);
  // Paged mode mirrors the builder preview (one page at a time, no sidebar) —
  // used by the site consent gate. Stacked mode (default) is used by the sponsor
  // review modal / submission page where the whole form is read at once.
  if (paged) {
    return (
      <PagedConsentForm
        blocks={blocks} values={values} onChange={onChange}
        disabled={disabled} footerSlot={footerSlot} invalidSet={invalidSet}
      />
    );
  }

  // Block & page titles are intentionally NOT rendered — the consent reads as a
  // single continuous form (only the field content/headings the author added).
  return (
    <div className={s.form}>
      {(blocks ?? []).map((block) => (
        <section key={block.id} className={s.block}>
          {(block.pages ?? []).map((page) => (
            <div key={page.id} className={s.page}>
              <div className={s.grid}>
                {(page.fields ?? []).map((f) => (
                  <div key={f.id} style={{ minWidth: 0, gridColumn: widthToColumn(f.fieldWidth) }}>
                    <FieldRow field={f} value={values[f.id]} disabled={disabled}
                      invalid={invalidSet.has(f.id)} onChange={(v) => onChange(f.id, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
