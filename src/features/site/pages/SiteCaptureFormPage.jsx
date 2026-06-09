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
import { useDispatch, useSelector } from 'react-redux';
import { Loader2, AlertCircle, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';
import StudyFormRunner from '@/components/study-form-runner/StudyFormRunner';
import Modal from '@/components/feedback/Modal';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { useSiteRolePermissions } from '@/features/site/hooks/useSiteRolePermissions';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { addToast } from '@/app/notificationSlice';
import SubjectContextStrip from '@/features/sponsor/components/capture/SubjectContextStrip';
import PrescriptionUpload from '@/components/capture/PrescriptionUpload';
import s from '@/features/sponsor/pages/CaptureFormPage.module.css';
import picker from './SiteCaptureFormPage.module.css';

export default function SiteCaptureFormPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const subjectId = params.get('subjectId') ?? '';
  const formId    = params.get('formId') ?? '';
  const currentUser = useSelector(selectCurrentUser);
  const myName = currentUser?.fullName ?? currentUser?.full_name ?? currentUser?.email ?? 'You';

  // Per-study permission tree (null = unrestricted). A role without
  // data_capture.edit gets the form view-only.
  const perms      = useSiteRolePermissions();
  // NOTE: data-entry actions (Save / Mark Completed / Submit) are gated by
  // SUBJECT OWNERSHIP, not the data_capture.edit/complete/submit role flags —
  // see `canEnterData` below. Only the responsible owner fills the form, which
  // also restores edit access to the right user after a sponsor/CRO reopen.
  // A verifier (data_verification.edit) sees the "Verify Page" action even on a
  // read-only/submitted form — SDV happens on completed data.
  const canVerify  = !perms || perms?.data_verification?.verify === true || perms?.data_verification?.edit === true;

  // Reopen a submitted form needs its own permission (data_capture.reopen) — the
  // controlled unlock path so submitted data isn't directly editable.
  const canReopen  = !perms || perms?.data_capture?.reopen === true;

  const [blocks,      setBlocks]      = useState([]);
  const [eligCriteria, setEligCriteria] = useState([]);
  const [formStatus,  setFormStatus]  = useState('In Progress');
  const [formTitle,   setFormTitle]   = useState('Form');
  // Study name (not the form name) — shown in the top bar next to Back.
  const [studyName,   setStudyName]   = useState('');
  const [defaults,    setDefaults]    = useState({});
  // { [pageId]: { completedAt, status } } — pages already Marked Completed.
  const [completedPages, setCompletedPages] = useState({});
  // Persisted verification state: { fields: { [fieldId]: {status, verifiedByName, verifiedAt} },
  //                                 pages:  { [pageId]:  {status, verifiedByName, verifiedAt} } }
  const [verification, setVerification] = useState({ fields: {}, pages: {} });
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [noFormsHere, setNoFormsHere] = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  // Reopen-reason dialog (replaces the native window.prompt).
  const [reopenOpen,   setReopenOpen]   = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening,    setReopening]    = useState(false);
  // Whether the signed-in site user is the subject's RESPONSIBLE owner. Set from
  // the backend `is_owner` flag on load. Only the owner may fill/submit the form
  // (and regain edit access after a sponsor/CRO reopen) — everyone else is
  // read-only, independent of the role's edit permission. Defaults true so the
  // owner is never briefly locked out before the flag loads (the backend also
  // enforces this on every save).
  const [isOwner, setIsOwner] = useState(true);
  // Owner-scoped data entry. Drives every editable affordance below.
  const canEnterData = isOwner;
  // Step-3 study module toggles (from the form GET). When off, the form hides
  // the verification workflow (Verify / Mark Completed / "Under Verification"
  // chip) and the query chips. Default true until the form loads.
  const [verificationEnabled, setVerificationEnabled] = useState(true);
  const [queryEnabled,        setQueryEnabled]        = useState(true);

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
        setStudyName(form.studyTitle ?? form.study_title ?? '');
        setBlocks(Array.isArray(struct.blocks) ? struct.blocks : []);
        setEligCriteria(struct.eligibilityCriteria ?? struct.eligibility_criteria ?? []);
        setVerificationEnabled(form.verificationEnabled ?? form.verification_enabled ?? true);
        setQueryEnabled(form.queryEnabled ?? form.query_enabled ?? true);

        if (subjectId) {
          const dataRes = await siteWorkspaceClient.getSubjectFormData(subjectId, formId);
          if (cancelled) return;
          const row = dataRes?.data ?? null;
          setDefaults(row?.form_data ?? row?.formData ?? {});
          setFormStatus(row?.status ?? 'In Progress');
          if (row) setIsOwner(row.is_owner !== false);

          // Which pages are already Marked Completed → the runner shows a
          // "Page Completed" badge instead of the button. Non-fatal on error.
          try {
            const ps = await siteWorkspaceClient.getPageStatuses(subjectId, formId);
            if (!cancelled) {
              const cmap = {};
              const vfields = {};
              const vpages  = {};
              for (const r of (ps?.pages ?? [])) {
                // PAGE row (field_name empty) → completion + page-level verify status.
                if (!r.field_name) {
                  if (r.completed_at) cmap[r.page_id] = { completedAt: r.completed_at, status: r.status };
                  vpages[r.page_id] = { status: r.status, recordStatus: r.record_status, verifiedByName: r.verified_by_name, verifiedAt: r.verified_at };
                } else {
                  // FIELD row → per-field verify status (drives the green tag).
                  vfields[r.field_name] = { status: r.status, verifiedByName: r.verified_by_name, verifiedAt: r.verified_at };
                }
              }
              setCompletedPages(cmap);
              setVerification({ fields: vfields, pages: vpages });
            }
          } catch { /* ignore — button just defaults to "Mark Page Completed" */ }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Failed to load form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [formId, subjectId]);

  // A Submitted form is read-only here, and the site owner has no Reopen button
  // of their own — only a sponsor/CRO can reopen it (from a different session).
  // Without a live push, the owner's read-only view would stay stale until a
  // hard reload. Re-pull just the form status whenever this tab regains focus,
  // so a sponsor-reopened form flips back to editable for the responsible user
  // automatically. Only touches `formStatus` — never the in-progress values.
  useEffect(() => {
    if (!formId || !subjectId) return undefined;
    const refresh = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const dataRes = await siteWorkspaceClient.getSubjectFormData(subjectId, formId);
        const row = dataRes?.data ?? null;
        if (row?.status) setFormStatus(row.status);
        if (row) setIsOwner(row.is_owner !== false);
      } catch { /* best-effort status refresh */ }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [formId, subjectId]);

  const handleSubmit = useCallback(async (formData) => {
    if (!canEnterData) {
      dispatch(addToast({ type: 'info', message: "Only the subject's owner can submit this form." }));
      throw new Error('not-owner');
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
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message || e?.message || 'Failed to save form.' }));
      throw e;
    }
  }, [subjectId, formId, canEnterData, dispatch]);

  // Mark the current page Completed → it becomes a Verification Manager
  // work-item. (handleSave runs first inside the runner so values are current.)
  const handleCompletePage = useCallback(async (pageId, pageTitle) => {
    if (!canEnterData || !subjectId) return;
    try {
      await siteWorkspaceClient.markPageCompleted(subjectId, formId, pageId, pageTitle);
      dispatch(addToast({ type: 'success', message: 'Page marked completed — sent for verification.' }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message || e?.message || 'Failed to mark page completed.' }));
      throw e;
    }
  }, [subjectId, formId, canEnterData, dispatch]);

  // Verify the current page (SDV). `fields` = the page's data fields flagged
  // verified; the backend persists field rows and derives the page status.
  const handleVerifyPage = useCallback(async (pageId, pageTitle, fields) => {
    if (!canVerify || !subjectId) return;
    try {
      const res = await siteWorkspaceClient.verifyPage({
        subject_id: subjectId,
        form_id:    formId,
        page_id:    pageId,
        page_title: pageTitle,
        fields,
      });
      const skipped = res?.skipped ?? [];
      const skippedEmpty = res?.skippedEmpty ?? res?.skipped_empty ?? [];
      const missingRequired = res?.missingRequired ?? res?.missing_required ?? [];
      if (missingRequired.length) {
        dispatch(addToast({
          type: 'warning',
          message: `Page not fully verified — ${missingRequired.length} required field(s) still empty: ${missingRequired.join(', ')}.`,
        }));
      } else if (skipped.length || skippedEmpty.length) {
        const parts = [];
        if (skipped.length) parts.push(`${skipped.length} with an open query`);
        if (skippedEmpty.length) parts.push(`${skippedEmpty.length} empty`);
        dispatch(addToast({
          type: 'info',
          message: `Page verified. Skipped ${parts.join(' and ')} field(s) (not verifiable).`,
        }));
      } else {
        dispatch(addToast({ type: 'success', message: 'Page verified.' }));
      }
      // Hand the result back so the runner can paint the verified fields green
      // immediately — using the verifier name the BACKEND resolved (the actual
      // stored verifier), NOT the clicking user's own name, so it matches what
      // every other viewer sees on reload.
      return { skipped, skippedEmpty, missingRequired, pageStatus: res?.pageStatus, verifiedByName: res?.verifiedByName ?? res?.verified_by_name ?? null };
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to verify page.' }));
      throw e;
    }
  }, [subjectId, formId, canVerify, myName, dispatch]);

  // Controlled unlock — reopen a submitted form so the owner can correct it.
  // Opens a reason dialog (popup) instead of the native window.prompt.
  const handleReopen = useCallback(() => {
    if (!canReopen || !subjectId) return;
    setReopenReason('');
    setReopenOpen(true);
  }, [canReopen, subjectId]);

  const submitReopen = useCallback(async () => {
    const reason = reopenReason.trim();
    if (!reason) return;
    setReopening(true);
    try {
      await siteWorkspaceClient.reopenForm(subjectId, formId, reason);
      setFormStatus('In Progress');
      setReopenOpen(false);
      dispatch(addToast({ type: 'success', message: 'Form reopened — it is editable again.' }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message || e?.message || 'Failed to reopen form.' }));
    } finally {
      setReopening(false);
    }
  }, [subjectId, formId, reopenReason, dispatch]);

  // Save progress without finalising. Backend keeps the form "In Progress" and
  // moves the subject Enrolled → Pending (data capture has begun). Stays on
  // the form so the user can keep editing.
  const handleSave = useCallback(async (formData) => {
    if (!canEnterData) {
      dispatch(addToast({ type: 'info', message: "Only the subject's owner can edit this form." }));
      throw new Error('not-owner');
    }
    if (!subjectId) {
      dispatch(addToast({ type: 'error', message: 'Cannot save: no subject selected.' }));
      throw new Error('missing-subject');
    }
    try {
      await siteWorkspaceClient.saveSubjectFormData(subjectId, formId, {
        form_data: formData,
        status: 'In Progress',
      });
      dispatch(addToast({ type: 'success', message: 'Progress saved — subject is in Pending.' }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to save form.' }));
      throw e;
    }
  }, [subjectId, formId, canEnterData, dispatch]);

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
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{studyName || 'Data Capture'}</span>
        </div>
        <div className={s.successWrap}>
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
      </div>
    );
  }

  // ── Form fill ──────────────────────────────────────────────────────────
  // A Submitted/Completed form is read-only (data entry locked) until reopened.
  const isSubmitted = ['Submitted', 'Completed'].includes(formStatus);

  // Header at the top of the runner's content column (above the search): subject
  // identity strip on the left, Prescriptions + read-only/view-only status on
  // the right. Replaces the old separate top bar so the form fills the height.
  const topContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <SubjectContextStrip studyId="site" subjectId={subjectId} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Prescriptions — only the subject's owner (treating doctor/PI) can
            upload; everyone else sees the read-only list in the dialog. */}
        <PrescriptionUpload subjectId={subjectId} canUpload={canEnterData} />
        {isSubmitted && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 999, fontSize: 11.5, fontWeight: 700,
              background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
            }}>
              🔒 Submitted — read-only
            </span>
            {canReopen && (
              <button
                type="button"
                onClick={handleReopen}
                style={{
                  padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', cursor: 'pointer',
                }}
              >
                Reopen
              </button>
            )}
          </span>
        )}
        {!isSubmitted && !isOwner && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
            background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
          }}>
            👁 View-only — only the subject&apos;s owner can edit
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className={s.page}>
      <StudyFormRunner
        blocks={blocks}
        formTitle={formTitle}
        defaultValues={defaults}
        onSubmit={handleSubmit}
        onSave={canEnterData ? handleSave : undefined}
        onCompletePage={canEnterData && verificationEnabled ? handleCompletePage : undefined}
        onVerifyPage={canVerify && verificationEnabled ? handleVerifyPage : undefined}
        eligibilityCriteria={eligCriteria}
        completedPages={completedPages}
        verification={verification}
        verificationEnabled={verificationEnabled}
        queryEnabled={queryEnabled}
        canSubmit={canEnterData}
        submitLabel={canEnterData ? 'Submit eCRF' : 'Read-only view'}
        readOnly={!canEnterData || isSubmitted}
        onBack={() => navigate(-1)}
        topContent={topContent}
      />

      <Modal
        open={reopenOpen}
        onClose={() => { if (!reopening) setReopenOpen(false); }}
        title="Reopen submitted form"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setReopenOpen(false)}
              disabled={reopening}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReopen}
              disabled={reopening || !reopenReason.trim()}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none',
                background: reopenReason.trim() ? '#b45309' : '#fcd9a8', color: '#fff',
                cursor: reopenReason.trim() && !reopening ? 'pointer' : 'not-allowed',
              }}
            >
              {reopening ? 'Reopening…' : 'Reopen form'}
            </button>
          </>
        }
      >
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          Reopening makes this submitted form editable again for the subject&apos;s owner.
          Please give a reason — it is recorded in the audit trail.
        </p>
        <textarea
          autoFocus
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReopen();
          }}
          placeholder="Reason for reopening this submitted form…"
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px',
            borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit',
            color: '#0f172a', outline: 'none',
          }}
        />
      </Modal>
    </div>
  );
}
