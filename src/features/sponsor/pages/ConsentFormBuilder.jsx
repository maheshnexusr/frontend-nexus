/**
 * ConsentFormBuilder — drag-and-drop DESIGNER for one consent form's body.
 *
 * Mounted at consent/config/:templateId/design (sponsor + site). The consent's
 * details (Title + Assigned Roles) are created/edited separately in
 * ConsentFormFormPage; this page only designs the body. It reuses the study
 * form-builder PRIMITIVES (SFBLeft palette, SFBCanvas, SFBRight, SFBPreview) +
 * the shared `studyForm` Redux slice, but is a SEPARATE orchestrator so it never
 * touches Study Design.
 *
 * Body is stored as a form_structure ({ blocks, submissionControls }) in
 * consent_templates.content. Save → Draft; Publish → Published (what the site
 * Submit-Consent flow + consent gate look for).
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, Save, Send, Maximize2, Minimize2, ArrowLeft, Settings2 } from 'lucide-react';
import {
  initForm, selectBlocks, selectIsDirty, markSaved, selectSubmissionCtrl,
} from '@/features/cro/store/studyFormSlice';
import { sponsorConsentFormsClient } from '@/features/sponsor/api/sponsorConsentFormsClient';
import { flattenConsentFields }      from '@/features/sponsor/components/consent/ConsentFormFill';
import { addToast }                  from '@/app/notificationSlice';
import { usePermissions }            from '@/features/auth/usePermissions';
import SFBLeft                       from '@/features/cro/components/study-form/SFBLeft';
import SFBCanvas                     from '@/features/cro/components/study-form/SFBCanvas';
import SFBRight                      from '@/features/cro/components/study-form/SFBRight';
import SFBPreview                    from '@/features/cro/components/study-form/SFBPreview';
import s from '@/features/cro/components/study-form/StudyFormBuilder.module.css';

export default function ConsentFormBuilder() {
  const { templateId } = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();
  const dispatch   = useDispatch();
  const blocks     = useSelector(selectBlocks);
  const submissionControls = useSelector(selectSubmissionCtrl);
  const isDirty    = useSelector(selectIsDirty);
  const { has }    = usePermissions();
  const canEdit    = has('consent_builder', 'edit');
  const canPublish = has('consent_builder', 'publish');

  // Stay within the current workspace (sponsor OR site) — derive from the URL.
  const consentBase = location.pathname.replace(/\/consent\/config.*$/, '/consent/config');

  const [previewing, setPreviewing] = useState(false);
  const [maximized,  setMaximized]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [status,     setStatus]     = useState(null);
  const [consentCode, setConsentCode] = useState('');
  const [title,      setTitle]      = useState('');

  // ── Load the consent form's body + header metadata ───────────────────────
  useEffect(() => {
    let alive = true;
    if (!templateId) { navigate(consentBase); return () => { alive = false; }; }
    setLoading(true);
    sponsorConsentFormsClient.get(templateId)
      .then((form) => {
        if (!alive) return;
        setConsentCode(form.consentCode ?? '');
        setTitle(form.title ?? '');
        setStatus(form.status ?? null);
        dispatch(initForm({ formId: form.templateId, formTitle: form.title || 'Consent Form', data: form.content ?? null }));
      })
      .catch(() => {
        if (!alive) return;
        dispatch(addToast({ type: 'error', message: 'Failed to load consent form.' }));
        navigate(consentBase);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, dispatch]);

  // An empty form (no fields/headings/paragraphs anywhere) can't be saved or
  // published — there'd be nothing for site personnel to read or sign.
  const isFormEmpty = () => flattenConsentFields(blocks).length === 0;

  const persist = async () => {
    await sponsorConsentFormsClient.update(templateId, { content: { blocks, submissionControls } });
    dispatch(markSaved());
    setStatus('Draft');
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (isFormEmpty()) {
      dispatch(addToast({ type: 'error', message: 'The consent form is empty — add at least one field before saving.', duration: 4000 }));
      return;
    }
    setSaving(true);
    try {
      await persist();
      dispatch(addToast({ type: 'success', message: 'Consent form saved.', duration: 3000 }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'Failed to save consent form.', duration: 4000 }));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    if (isFormEmpty()) {
      dispatch(addToast({ type: 'error', message: 'The consent form is empty — add at least one field before publishing.', duration: 4000 }));
      return;
    }
    setPublishing(true);
    try {
      await persist();
      await sponsorConsentFormsClient.publish(templateId);
      setStatus('Published');
      dispatch(addToast({ type: 'success', message: 'Consent form published — assigned site personnel can now sign it.', duration: 3500 }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'Failed to publish consent form.', duration: 4000 }));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading consent form…</div>;
  }

  return (
    <div className={`${s.root} ${maximized ? s.rootMaximized : ''}`}>
      {/* Header — Back, Title/Code/Status, Edit details */}
      {!maximized && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to={consentBase} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Consent Forms
          </Link>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <strong style={{ fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
              {title || 'Untitled consent'}
            </strong>
            {consentCode && <span style={{ fontSize: 12, color: '#94a3b8' }}>{consentCode}</span>}
          </div>
          {canEdit && (
            <Link
              to={`${consentBase}/${templateId}/edit`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2563eb', textDecoration: 'none' }}
              title="Edit title & assigned roles"
            >
              <Settings2 size={13} /> Edit details
            </Link>
          )}
        </div>
      )}

      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          <strong style={{ fontSize: 14 }}>Consent Builder</strong>
          {status && (
            <span
              style={{
                marginLeft: 10, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999,
                background: status === 'Published' ? '#dcfce7' : '#fef3c7',
                color:      status === 'Published' ? '#166534' : '#92400e',
              }}
            >
              {status}
            </span>
          )}
        </div>

        <div className={s.toolbarRight}>
          {isDirty && !previewing && <span className={s.dirtyDot} title="Unsaved changes" />}
          <button className={s.btnPreview} onClick={() => setMaximized((v) => !v)} title={maximized ? 'Exit full screen' : 'Enter full screen'}>
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {maximized ? 'Exit Full Screen' : 'Full Screen'}
          </button>
          <button
            className={`${s.btnPreview} ${previewing ? s.btnPreviewActive : ''}`}
            onClick={() => setPreviewing((v) => !v)}
            title={previewing ? 'Back to Builder' : 'Preview form'}
          >
            <Eye size={13} /> {previewing ? 'Exit Preview' : 'Preview'}
          </button>
          {!previewing && canEdit && (
            <button className={s.btnPreview} onClick={handleSave} disabled={saving}>
              <Save size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {!previewing && canPublish && (
            <button className={s.btnSave} onClick={handlePublish} disabled={publishing}>
              <Send size={13} /> {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      <div className={s.body}>
        {previewing ? (
          <SFBPreview onExitPreview={() => setPreviewing(false)} />
        ) : (
          <>
            <SFBLeft />
            <SFBCanvas />
            <SFBRight />
          </>
        )}
      </div>
    </div>
  );
}
