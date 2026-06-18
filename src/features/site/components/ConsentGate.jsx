/**
 * ConsentGate — login consent gate for site personnel.
 *
 * On entering a study workspace, fetches the study's PUBLISHED consent template
 * the user still needs to accept (once per version). If one is pending, it
 * blocks the workspace with a full-screen overlay until the user agrees.
 * Agreement is recorded server-side (and written to the activity log).
 *
 * Renders its children unchanged when there's nothing to accept.
 */
import { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { ShieldCheck, Loader2, AlertCircle, Clock } from 'lucide-react';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { getSiteStudyContext } from '@/features/site/authStore';
import { addToast } from '@/app/notificationSlice';
import ConsentFormFill, { flattenConsentFields, missingRequired, scrollToConsentField } from '@/features/sponsor/components/consent/ConsentFormFill';
import { normalizeConsentContent } from '@/utils/consentContent';

// One field of the drag-and-drop consent form, rendered READ-ONLY (the gate is
// read + "I Agree", not data entry). Headings/paragraphs/dividers carry the
// consent text; input fields are shown as informational labels + options.
function ConsentField({ field }) {
  if (!field) return null;
  switch (field.type) {
    case 'h2':
      return <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '14px 0 6px' }}>{field.label || ''}</h2>;
    case 'h3':
      return <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '12px 0 4px' }}>{field.label || ''}</h3>;
    case 'paragraph': {
      // Render the rich-text HTML (Quill output) verbatim; legacy plain text
      // (no tags) keeps its line breaks. Matches ConsentFormFill / SFBPreview.
      const raw = field.content || field.label || '';
      if (raw.trim() && /<[a-z][\s\S]*>/i.test(raw)) {
        return <div style={{ margin: '6px 0' }} dangerouslySetInnerHTML={{ __html: raw }} />;
      }
      return <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{raw}</p>;
    }
    case 'divider':
      return <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />;
    case 'signature':
      return (
        <div style={{ margin: '8px 0' }}>
          {field.label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{field.label}</div>}
          <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: '12px', color: '#94a3b8', fontSize: 12.5 }}>Signature</div>
        </div>
      );
    default: {
      // Generic input field: show the label, help text and any options so the
      // consent reads completely even for choice / text fields.
      const opts = Array.isArray(field.options) ? field.options : [];
      return (
        <div style={{ margin: '8px 0' }}>
          {field.label && <div style={{ fontWeight: 600 }}>{field.label}</div>}
          {field.helpText && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{field.helpText}</div>}
          {opts.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: '#334155' }}>
              {opts.map((o, i) => <li key={i}>{o?.label ?? o?.value ?? String(o)}</li>)}
            </ul>
          )}
        </div>
      );
    }
  }
}

// Renders the consent body. Supports the drag-and-drop form structure
// ({ blocks:[{ pages:[{ fields }] }] }) authored by the consent builder, and
// falls back to legacy shapes (raw string / { html } / { text }).
function ConsentBody({ content }) {
  if (!content) return <em>No consent text provided.</em>;
  if (typeof content === 'string') return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
  if (content.html) return <div dangerouslySetInnerHTML={{ __html: content.html }} />;

  if (Array.isArray(content.blocks) && content.blocks.length > 0) {
    const multiBlock = content.blocks.length > 1;
    return (
      <>
        {content.blocks.map((blk, bi) => (
          <div key={blk?.id ?? bi}>
            {multiBlock && blk?.title && (
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '16px 0 8px' }}>{blk.title}</h2>
            )}
            {(blk?.pages ?? []).map((pg, pi) => (
              <div key={pg?.id ?? pi}>
                {pg?.title && (
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#334155', margin: '10px 0 4px' }}>{pg.title}</h3>
                )}
                {(pg?.fields ?? []).map((f, fi) => <ConsentField key={f?.id ?? fi} field={f} />)}
              </div>
            ))}
          </div>
        ))}
      </>
    );
  }

  if (content.text) return <div style={{ whiteSpace: 'pre-wrap' }}>{content.text}</div>;
  return <em>No consent text provided.</em>;
}

export default function ConsentGate({ children }) {
  const dispatch = useDispatch();
  const ctx = getSiteStudyContext();
  const studyKey = ctx?.studyId ? `${ctx.studyId}:${ctx.environment}` : null;

  const [phase, setPhase] = useState('loading'); // loading | clear | pending | error
  const [consent, setConsent] = useState(null);
  const [agreeing, setAgreeing] = useState(false);
  const [values, setValues] = useState({}); // filled-in answers, keyed by field id
  const [invalidIds, setInvalidIds] = useState([]); // required fields flagged empty on Agree

  const check = useCallback(async () => {
    if (!studyKey) { setPhase('clear'); return; }
    setPhase('loading');
    try {
      const res = await siteWorkspaceClient.pendingConsent();
      const c = res?.consent ?? null;
      // Content is stored snake_case; camel it so field appearance/layout render.
      if (c) c.content = normalizeConsentContent(c.content);
      if (c) { setConsent(c); setValues({}); setPhase('pending'); }
      else   { setConsent(null); setPhase('clear'); }
    } catch {
      // Fail OPEN — never lock a user out of the workspace on a gate error.
      setPhase('clear');
    }
  }, [studyKey]);

  useEffect(() => { check(); }, [check]);

  const handleChange = (fieldId, v) => {
    setValues((prev) => ({ ...prev, [fieldId]: v }));
    // Clear the missing-field flag once the user starts filling it in.
    setInvalidIds((prev) => (prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : prev));
  };

  const handleAgree = async () => {
    if (!consent) return;
    const blocks = consent.content?.blocks;
    const isForm = Array.isArray(blocks) && blocks.length > 0;

    let extra = {};
    if (isForm) {
      // The user must complete every required field (incl. signature) before agreeing.
      const missing = missingRequired(blocks, values);
      if (missing.length) {
        setInvalidIds(missing);
        scrollToConsentField(missing[0]);
        dispatch(addToast({ type: 'error', message: 'Please complete all required fields before agreeing.' }));
        return;
      }
      setInvalidIds([]);
      const sigField = flattenConsentFields(blocks).find((f) => f.type === 'signature');
      // The signature is now uploaded as a file → its value is a { url } ref.
      // Send the url string (legacy data-URL values pass through unchanged).
      const sigVal = sigField ? values[sigField.id] : null;
      const signatureUrl = sigVal && typeof sigVal === 'object' ? sigVal.url : sigVal;
      extra = {
        responses: values,
        signatureDataUrl: signatureUrl ?? null,
        version: consent.version,
      };
    }

    setAgreeing(true);
    try {
      await siteWorkspaceClient.acceptConsent(consent.templateId, extra);
      dispatch(addToast({ type: 'success', message: 'Consent submitted. Thank you.' }));
      // Re-evaluate: if the study auto-approves it clears now; if it needs
      // reviewer approval the user moves to the "awaiting approval" screen.
      await check();
      setAgreeing(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'Failed to record consent.' }));
      setAgreeing(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div style={center}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 10 }}>Loading…</p>
      </div>
    );
  }

  if (phase === 'pending' && consent) {
    const awaiting = consent.state === 'pending_approval';
    const isForm = Array.isArray(consent.content?.blocks) && consent.content.blocks.length > 0;

    // The "I Agree" action — shown in the paged form's footer when rendering a
    // form, or in the card footer for legacy (string/html) consent content.
    const agreeButton = (
      <button style={agreeBtn} onClick={handleAgree} disabled={agreeing}>
        {agreeing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={15} />}
        {agreeing ? 'Submitting…' : 'Submit Service Agreement'}
      </button>
    );

    return (
      <div style={overlay} role="dialog" aria-modal="true" aria-label="Consent required">
        <div style={isForm && !awaiting ? { ...card, width: 'min(920px, 96vw)' } : card}>
          <div style={head}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>
              <ShieldCheck size={18} style={{ color: '#2563eb' }} />
              {consent.templateName || 'Consent'}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              v{consent.version}{consent.language ? ` · ${consent.language}` : ''}
            </span>
          </div>

          {(ctx?.studyTitle || ctx?.protocolNumber || ctx?.siteName) && (
            <div style={metaBar}>
              {ctx?.studyTitle && (
                <div style={metaItem}><span style={metaLabel}>Study</span><span style={metaVal}>{ctx.studyTitle}</span></div>
              )}
              {ctx?.protocolNumber && (
                <div style={metaItem}><span style={metaLabel}>Protocol No.</span><span style={metaVal}>{ctx.protocolNumber}</span></div>
              )}
              {ctx?.siteName && (
                <div style={metaItem}><span style={metaLabel}>Site</span><span style={metaVal}>{ctx.siteName}</span></div>
              )}
            </div>
          )}

          {awaiting ? (
            // Submitted — blocked until a Sponsor/CRO reviewer approves it.
            <div style={{ ...body, textAlign: 'center', padding: '36px 24px' }}>
              <Clock size={40} style={{ color: '#d97706', margin: '0 auto 14px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Awaiting approval</h3>
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
                Your consent has been submitted and is pending review by the Sponsor/CRO.
                You’ll be able to create subjects and continue working once it’s approved.
              </p>
            </div>
          ) : (
            <div style={body}>
              {consent.rejection && (
                <p style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', margin: '0 0 12px' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    <strong>Your previous consent was rejected.</strong>
                    {consent.rejection.reason ? ` Reason: ${consent.rejection.reason}.` : ''}
                    {consent.rejection.message ? ` ${consent.rejection.message}` : ''} Please review and resubmit.
                  </span>
                </p>
              )}
              <p style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', margin: '0 0 14px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                Please read the consent, complete all required fields, sign, and click “Submit Service Agreement” before accessing the study workspace.
              </p>
              {isForm ? (
                // Whole form shown at once (no Previous/Next pager) — the "I Agree"
                // action lives in the card footer below.
                <ConsentFormFill
                  blocks={consent.content.blocks}
                  values={values}
                  onChange={handleChange}
                  disabled={agreeing}
                  invalidIds={invalidIds}
                />
              ) : (
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#0f172a' }}>
                  <ConsentBody content={consent.content} />
                </div>
              )}
            </div>
          )}

          <div style={foot}>
            {awaiting ? (
              <button style={agreeBtn} onClick={check}>
                <Loader2 size={15} /> Check approval status
              </button>
            ) : (
              agreeButton
            )}
          </div>
        </div>
      </div>
    );
  }

  // phase === 'clear' (or error → fail open)
  return children;
}

const center  = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 };
const card    = { width: 'min(720px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.3)' };
const head    = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' };
const metaBar = { display: 'flex', flexWrap: 'wrap', gap: '8px 28px', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' };
const metaItem  = { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 };
const metaLabel = { fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: '#94a3b8' };
const metaVal   = { fontSize: 13, fontWeight: 600, color: '#0f172a' };
const body    = { padding: 20, overflow: 'auto' };
const foot    = { display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #e2e8f0' };
const agreeBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 9, fontWeight: 700, fontSize: 14, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer' };
