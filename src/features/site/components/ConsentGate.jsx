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
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { getSiteStudyContext } from '@/features/site/authStore';
import { addToast } from '@/app/notificationSlice';

// Pull renderable text out of the template content JSON (best-effort across
// shapes: { html }, { text }, { blocks:[{text}] }, or a raw string).
function renderContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.html) return content.html;
  if (content.text) return content.text;
  if (Array.isArray(content.blocks)) {
    return content.blocks.map((b) => b?.text ?? b?.content ?? '').filter(Boolean).join('\n\n');
  }
  return '';
}

export default function ConsentGate({ children }) {
  const dispatch = useDispatch();
  const ctx = getSiteStudyContext();
  const studyKey = ctx?.studyId ? `${ctx.studyId}:${ctx.environment}` : null;

  const [phase, setPhase] = useState('loading'); // loading | clear | pending | error
  const [consent, setConsent] = useState(null);
  const [agreeing, setAgreeing] = useState(false);

  const check = useCallback(async () => {
    if (!studyKey) { setPhase('clear'); return; }
    setPhase('loading');
    try {
      const res = await siteWorkspaceClient.pendingConsent();
      const c = res?.consent ?? null;
      if (c) { setConsent(c); setPhase('pending'); }
      else   { setConsent(null); setPhase('clear'); }
    } catch {
      // Fail OPEN — never lock a user out of the workspace on a gate error.
      setPhase('clear');
    }
  }, [studyKey]);

  useEffect(() => { check(); }, [check]);

  const handleAgree = async () => {
    if (!consent) return;
    setAgreeing(true);
    try {
      await siteWorkspaceClient.acceptConsent(consent.templateId);
      setPhase('clear');
      dispatch(addToast({ type: 'success', message: 'Consent recorded. Thank you.' }));
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
    return (
      <div style={overlay} role="dialog" aria-modal="true" aria-label="Consent required">
        <div style={card}>
          <div style={head}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>
              <ShieldCheck size={18} style={{ color: '#2563eb' }} />
              {consent.templateName || 'Consent'}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              v{consent.version}{consent.language ? ` · ${consent.language}` : ''}
            </span>
          </div>

          <div style={body}>
            <p style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', margin: '0 0 14px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              You must read and agree to the consent below before accessing the study workspace.
            </p>
            <div
              style={{ fontSize: 13.5, lineHeight: 1.6, color: '#0f172a', whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ __html: renderContent(consent.content) || '<em>No consent text provided.</em>' }}
            />
          </div>

          <div style={foot}>
            <button style={agreeBtn} onClick={handleAgree} disabled={agreeing}>
              {agreeing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={15} />}
              {agreeing ? 'Recording…' : 'I Agree'}
            </button>
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
const body    = { padding: 20, overflow: 'auto' };
const foot    = { display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #e2e8f0' };
const agreeBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 9, fontWeight: 700, fontSize: 14, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer' };
