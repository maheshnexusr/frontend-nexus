/**
 * CaptureFormPage
 * Fetches a study's eCRF form schema from the sponsor workspace API and
 * renders it with StudyFormRunner, which mirrors the CRO designer's preview
 * (blocks → pages → fields stepper) so participants see the same layout the
 * CRO admin designed.
 *
 * Route: /sponsor/:studyId/capture/form?formId=...&subjectId=...
 *   - studyId comes from the route path.
 *   - formId and subjectId come from the query string (passed by CapturePage).
 *   - study_id + environment are auto-injected by sponsorAxiosClient.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2, Info } from 'lucide-react';
import StudyFormRunner from '@/components/study-form-runner/StudyFormRunner';
import Modal from '@/components/feedback/Modal';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import { useReadOnlyView } from '@/features/workspace/hooks/useReadOnlyView';
import { useSiteRolePermissions } from '@/features/site/hooks/useSiteRolePermissions';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { addToast } from '@/app/notificationSlice';
import SubjectContextStrip from '@/features/sponsor/components/capture/SubjectContextStrip';
import PrescriptionUpload from '@/components/capture/PrescriptionUpload';
import s from './CaptureFormPage.module.css';

export default function CaptureFormPage() {
  const { studyId } = useParams();
  const [searchParams] = useSearchParams();
  const formId    = searchParams.get('formId');
  const subjectId = searchParams.get('subjectId');

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const ro       = useReadOnlyView();
  // Per-study permission tree (null = unrestricted). A role without
  // data_capture.edit gets the form view-only — it can see the data but not
  // change fields or move the form's status.
  const perms      = useSiteRolePermissions(studyId);
  const dc         = perms?.data_capture;
  // Per-action gate. `submit` is a distinct data_capture action; a role with no
  // such key inherits `edit` (so pre-split roles still submit), while an explicit
  // false withholds submit even from an edit-capable role.
  const dcAllows   = (action) => !perms
    ? true
    : (typeof dc?.[action] === 'boolean' ? dc[action] === true : dc?.edit === true);
  const canEdit    = !perms || dc?.edit === true;
  const canSubmit  = dcAllows('submit');
  // Prescription uploads ride the same gate as opening/filling the form
  // (data_capture.subject_data_capture), with edit as the pre-split fallback.
  const canUploadRx = !perms || dc?.subject_data_capture === true || dc?.edit === true;
  const canVerify  = !perms || perms?.data_verification?.verify === true || perms?.data_verification?.edit === true;
  // Reopen a submitted form needs its own permission (data_capture.reopen).
  const canReopen  = !perms || perms?.data_capture?.reopen === true;

  const [blocks,    setBlocks]    = useState([]);
  const [eligCriteria, setEligCriteria] = useState([]);
  const [formStatus, setFormStatus] = useState('In Progress');
  const [formTitle, setFormTitle] = useState('Study Form');
  // Study name (not the form name) — shown in the top bar next to Back.
  const [studyName, setStudyName] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [defaults,  setDefaults]  = useState({});
  const [submitted, setSubmitted] = useState(false);
  // Subject initials — shown in the post-submit confirmation message.
  const [subjectInitials, setSubjectInitials] = useState('');
  // Step-3 study module toggles (from the form GET) — hide the verification
  // workflow / query chips when the study doesn't enable those managers.
  const [verificationEnabled, setVerificationEnabled] = useState(true);
  const [queryEnabled,        setQueryEnabled]        = useState(true);
  // Reopen-reason dialog (replaces the native window.prompt).
  const [reopenOpen,   setReopenOpen]   = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening,    setReopening]    = useState(false);
  // { [pageId]: { completedAt, status } } — pages already Marked Completed.
  const [completedPages, setCompletedPages] = useState({});
  // Persisted verification: { fields: { [fieldId]: {...} }, pages: { [pageId]: {...} } }
  const [verification, setVerification] = useState({ fields: {}, pages: {} });
  const currentUser = useSelector(selectCurrentUser);
  const myName = currentUser?.fullName ?? currentUser?.full_name ?? currentUser?.email ?? 'You';

  /* ── fetch form schema (and existing data if a subject is provided) ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const formRes = await sponsorAxiosClient.get(
          `/api/v1/sponsor/workspace/forms/${formId}`,
        );
        const form = formRes?.form ?? formRes;
        const structure = form.structure ?? form.studyFormData ?? {};
        if (!cancelled) {
          setFormTitle(form.title || 'Study Form');
          setStudyName(form.studyTitle || form.study_title || '');
          setBlocks(Array.isArray(structure.blocks) ? structure.blocks : []);
          setEligCriteria(structure.eligibilityCriteria ?? structure.eligibility_criteria ?? []);
          setVerificationEnabled(form.verificationEnabled ?? form.verification_enabled ?? true);
          setQueryEnabled(form.queryEnabled ?? form.query_enabled ?? true);
        }

        if (subjectId) {
          const dataRes = await sponsorAxiosClient.get(
            `/api/v1/sponsor/workspace/subjects/${subjectId}/forms/${formId}/data`,
          );
          const row = dataRes?.data ?? null;
          if (!cancelled) { setDefaults(row?.form_data ?? row?.formData ?? {}); setFormStatus(row?.status ?? 'In Progress'); }

          // Which pages are already Marked Completed → the runner shows a
          // "Page Completed" badge instead of the button. Non-fatal on error.
          try {
            const ps = await sponsorAxiosClient.get(
              `/api/v1/sponsor/workspace/subjects/${subjectId}/forms/${formId}/page-status`,
            );
            if (!cancelled) {
              const cmap = {};
              const vfields = {};
              const vpages  = {};
              for (const r of (ps?.pages ?? [])) {
                if (!r.field_name) {
                  if (r.completed_at) cmap[r.page_id] = { completedAt: r.completed_at, status: r.status };
                  vpages[r.page_id] = { status: r.status, recordStatus: r.record_status, verifiedByName: r.verified_by_name, verifiedAt: r.verified_at };
                } else {
                  vfields[r.field_name] = { status: r.status, verifiedByName: r.verified_by_name, verifiedAt: r.verified_at };
                }
              }
              setCompletedPages(cmap);
              setVerification({ fields: vfields, pages: vpages });
            }
          } catch { /* ignore */ }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load form.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!formId) {
      setError('No form selected. Return to the capture list and try again.');
      setLoading(false);
      return undefined;
    }

    if (studyId && formId) load();
    return () => { cancelled = true; };
  }, [studyId, formId, subjectId]);

  // Subject initials for the submit-confirmation message. Non-fatal on error.
  useEffect(() => {
    if (!subjectId) return undefined;
    let cancelled = false;
    sponsorAxiosClient.get(`/api/v1/sponsor/workspace/subjects/${subjectId}`)
      .then((res) => {
        if (cancelled) return;
        const sub = res?.subject ?? res?.item ?? res ?? {};
        setSubjectInitials(sub.subject_initials ?? sub.subjectInitials ?? '');
      })
      .catch(() => { /* message falls back to the subject code */ });
    return () => { cancelled = true; };
  }, [subjectId]);

  /* ── submit handler ── */
  const handleSubmit = useCallback(async (formData) => {
    if (ro.isReadOnly) {
      dispatch(addToast({ type: 'info', message: ro.readOnlyMessage }));
      throw new Error('read-only');
    }
    if (!canSubmit) {
      dispatch(addToast({ type: 'info', message: 'Your role cannot submit this form.' }));
      throw new Error('no-submit');
    }
    if (!subjectId) {
      dispatch(addToast({
        type: 'error',
        message: 'A subject is required to save form data.',
      }));
      throw new Error('subject required');
    }
    try {
      await sponsorAxiosClient.post(
        `/api/v1/sponsor/workspace/subjects/${subjectId}/forms/${formId}/data`,
        { form_data: formData, status: 'Submitted' },
      );
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message || e?.message || 'Failed to submit form.' }));
      throw e;
    }
    dispatch(addToast({ type: 'success', message: 'Form saved.' }));
    setSubmitted(true);
  }, [formId, subjectId, ro.isReadOnly, ro.readOnlyMessage, canSubmit, dispatch]);

  // Verify the current page (SDV) — sponsor/CRO verifier. Sends the page's data
  // fields flagged verified; the backend derives the page status.
  const handleVerifyPage = useCallback(async (pageId, pageTitle, fields) => {
    if (!canVerify || !subjectId) return;
    try {
      const res = await sponsorAxiosClient.post(
        `/api/v1/sponsor/workspace/data-verifications/verify-page`,
        { subject_id: subjectId, form_id: formId, page_id: pageId, page_title: pageTitle, fields },
      );
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
      return { skipped, skippedEmpty, missingRequired, pageStatus: res?.pageStatus, verifiedByName: res?.verifiedByName ?? res?.verified_by_name ?? null };
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to verify page.' }));
      throw e;
    }
  }, [formId, subjectId, canVerify, myName, dispatch]);


  // Controlled unlock — reopen a submitted form so it can be corrected.
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
      await sponsorAxiosClient.post(`/api/v1/sponsor/workspace/subjects/${subjectId}/forms/${formId}/reopen`, { reason });
      setFormStatus('In Progress');
      setReopenOpen(false);
      dispatch(addToast({ type: 'success', message: 'Form reopened — it is editable again.' }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message || e?.message || 'Failed to reopen form.' }));
    } finally {
      setReopening(false);
    }
  }, [subjectId, formId, reopenReason, dispatch]);

  const isSubmitted = ['Submitted', 'Completed'].includes(formStatus);
  const isReadOnly  = ro.isReadOnly || !canEdit || isSubmitted;

  if (loading) {
    return (
      <div className={s.center}>
        <Loader2 size={32} className={s.spinner} />
        <p>Loading form…</p>
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

  if (submitted) {
    return (
      <div className={s.page}>
        <div className={s.topBar}>
          <button
            className={s.backBtn}
            onClick={() => navigate(`/sponsor/${studyId}/capture`)}
            style={{ marginBottom: 0 }}
          >
            <ArrowLeft size={14} /> All subjects
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{studyName || 'Data Capture'}</span>
        </div>
        <div className={s.successWrap}>
          <div className={s.successCard}>
            <div className={s.successBadge}>
              <CheckCircle2 size={36} strokeWidth={2.25} />
            </div>
            <h2 className={s.successTitle}>Form submitted</h2>
            <p className={s.successSub}>
              The Case Report Form for subject{' '}
              <span className={s.successCode}>{subjectInitials || subjectId}</span> has been
              successfully submitted and saved.
            </p>
            <div className={s.successNote}>
              <Info size={15} className={s.successNoteIcon} />
              <span>To modify the submitted subject details, please contact the Data Administrator.</span>
            </div>
            <div className={s.successActions}>
              <button
                className={s.successPrimary}
                onClick={() => navigate(`/sponsor/${studyId}/capture`)}
              >
                <ArrowLeft size={15} /> Back to subjects
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Header that rides at the top of the runner's content column (above the
  // search) instead of a separate top bar: subject identity strip on the left,
  // Prescriptions + read-only/reopen controls on the right.
  const topContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <SubjectContextStrip studyId={studyId} subjectId={subjectId} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <PrescriptionUpload subjectId={subjectId} canUpload={canUploadRx} />
        {isSubmitted && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 999, fontSize: 11.5, fontWeight: 700,
              background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
            }}>
              🔒 Submitted (Read-only)
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
        onVerifyPage={canVerify && verificationEnabled ? handleVerifyPage : undefined}
        eligibilityCriteria={eligCriteria}
        completedPages={completedPages}
        verification={verification}
        verificationEnabled={verificationEnabled}
        queryEnabled={queryEnabled}
        canSubmit={canSubmit}
        submitLabel={isReadOnly ? 'Read-only view' : 'Submit eCRF'}
        readOnly={isReadOnly}
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
          Reopening makes this submitted form editable again. Please give a reason — it is
          recorded in the audit trail.
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
