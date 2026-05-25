/**
 * SiteCaptureFormPage — /site/capture/form?subjectId=...&formId=...
 *
 * Renders an eCRF for a subject. Each study has a single form, so when
 * formId is missing we auto-resolve it from the study's forms list and
 * redirect to ourselves with it set — no picker. Submit upserts via
 * siteWorkspaceClient.saveSubjectFormData.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Loader2, AlertCircle, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';
import StudyFormRunner from '@/components/study-form-runner/StudyFormRunner';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { useSiteRolePermissions } from '@/features/site/hooks/useSiteRolePermissions';
import { addToast } from '@/app/notificationSlice';
import SubjectContextStrip from '@/features/sponsor/components/capture/SubjectContextStrip';
import s from '@/features/sponsor/pages/CaptureFormPage.module.css';
import picker from './SiteCaptureFormPage.module.css';

export default function SiteCaptureFormPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const subjectId = params.get('subjectId') ?? '';
  const formId    = params.get('formId') ?? '';

  // Per-study permission tree (null = unrestricted). A role without
  // data_capture.edit gets the form view-only.
  const perms      = useSiteRolePermissions();
  const canEdit    = !perms || perms?.data_capture?.edit === true;

  const [blocks,      setBlocks]      = useState([]);
  const [formTitle,   setFormTitle]   = useState('Form');
  const [defaults,    setDefaults]    = useState({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [noFormsHere, setNoFormsHere] = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  // ── Auto-resolve formId: each study has a single form. ─────────────────
  useEffect(() => {
    if (formId) return;
    let cancelled = false;
    setLoading(true);
    siteWorkspaceClient.listForms()
      .then((res) => {
        if (cancelled) return;
        const items = res?.items ?? res ?? [];
        if (items.length > 0) {
          const next = new URLSearchParams(params);
          next.set('formId', items[0].formId);
          navigate(`/site/capture/form?${next.toString()}`, { replace: true });
        } else {
          setNoFormsHere(true);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load forms.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [formId, params, navigate]);

  // ── Load schema + saved answers once formId is set ─────────────────────
  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const formRes = await siteWorkspaceClient.getForm(formId);
        if (cancelled) return;
        const form = formRes?.form ?? formRes ?? {};
        const struct = form.structure ?? {};
        setFormTitle(form.title ?? struct.formTitle ?? 'Form');
        setBlocks(Array.isArray(struct.blocks) ? struct.blocks : []);

        if (subjectId) {
          const dataRes = await siteWorkspaceClient.getSubjectFormData(subjectId, formId);
          if (cancelled) return;
          const row = dataRes?.data ?? null;
          setDefaults(row?.form_data ?? row?.formData ?? {});
        }
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Failed to load form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [formId, subjectId]);

  const handleSubmit = useCallback(async (formData) => {
    if (!canEdit) {
      dispatch(addToast({ type: 'info', message: 'Your role has view-only access to this form.' }));
      throw new Error('view-only');
    }
    if (!subjectId) {
      dispatch(addToast({ type: 'error', message: 'Cannot save: no subject selected.' }));
      throw new Error('missing-subject');
    }
    try {
      await siteWorkspaceClient.saveSubjectFormData(subjectId, formId, {
        form_data: formData,
        status: 'Submitted',
      });
      dispatch(addToast({ type: 'success', message: 'Form submitted.' }));
      setSubmitted(true);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to save form.' }));
      throw e;
    }
  }, [subjectId, formId, canEdit, dispatch]);

  // ── States ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={s.center}>
        <Loader2 size={32} className={s.spinner} />
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.center}>
        <AlertCircle size={32} className={s.errorIcon} />
        <p className={s.errorText}>{error}</p>
        <button className={s.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  if (noFormsHere) {
    return (
      <div className={picker.page}>
        <button className={picker.back} onClick={() => navigate('/site/capture')}>
          <ArrowLeft size={14} /> Back to subjects
        </button>
        <div className={picker.empty}>
          <FileText size={36} strokeWidth={1.25} className={picker.emptyIcon} />
          <p className={picker.emptyTitle}>No form has been published for this study yet.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={s.page}>
        <div className={s.topBar}>
          <button className={s.backBtn} onClick={() => navigate('/site/capture')} style={{ marginBottom: 0 }}>
            <ArrowLeft size={14} /> All subjects
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{formTitle || 'Data Capture'}</span>
        </div>
        <div className={s.successCard}>
          <CheckCircle2 size={44} className={s.successIcon} />
          <h2 className={s.successTitle}>Form submitted</h2>
          <p className={s.successSub}>
            <strong>{formTitle || 'eCRF'}</strong> has been saved for subject{' '}
            <code className={s.successCode}>{subjectId}</code>. The Query Manager and Data
            Manager can now review it.
          </p>
          <div className={s.successActions}>
            <button
              className={s.successPrimary}
              onClick={() => navigate('/site/capture')}
            >
              Back to subjects
            </button>
            <button
              className={s.successSecondary}
              onClick={() => setSubmitted(false)}
            >
              Edit this form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form fill ──────────────────────────────────────────────────────────
  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.backBtn} onClick={() => navigate(-1)} style={{ marginBottom: 0 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{formTitle || 'Data Capture'}</span>
      </div>

      {/* Identity strip — Protocol Number / Site Code / Screening Number /
          Subject Initials / Audit Log. Site session has its studyId pinned in
          the JWT, so the prop just needs to be truthy to trigger the fetch. */}
      <SubjectContextStrip studyId="site" subjectId={subjectId} />

      <StudyFormRunner
        blocks={blocks}
        formTitle={formTitle}
        defaultValues={defaults}
        onSubmit={handleSubmit}
        submitLabel={canEdit ? 'Submit eCRF' : 'Read-only view'}
        readOnly={!canEdit}
      />
    </div>
  );
}
