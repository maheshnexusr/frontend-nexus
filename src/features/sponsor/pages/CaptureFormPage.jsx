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
import { useDispatch } from 'react-redux';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import StudyFormRunner from '@/components/study-form-runner/StudyFormRunner';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import { useReadOnlyView } from '@/features/workspace/hooks/useReadOnlyView';
import { addToast } from '@/app/notificationSlice';
import s from './CaptureFormPage.module.css';

export default function CaptureFormPage() {
  const { studyId } = useParams();
  const [searchParams] = useSearchParams();
  const formId    = searchParams.get('formId');
  const subjectId = searchParams.get('subjectId');

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const ro       = useReadOnlyView();

  const [blocks,    setBlocks]    = useState([]);
  const [formTitle, setFormTitle] = useState('Study Form');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [defaults,  setDefaults]  = useState({});

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
          setBlocks(Array.isArray(structure.blocks) ? structure.blocks : []);
        }

        if (subjectId) {
          const dataRes = await sponsorAxiosClient.get(
            `/api/v1/sponsor/workspace/subjects/${subjectId}/forms/${formId}/data`,
          );
          const row = dataRes?.data ?? null;
          if (!cancelled) setDefaults(row?.form_data ?? row?.formData ?? {});
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

  /* ── submit handler ── */
  const handleSubmit = useCallback(async (formData) => {
    if (ro.isReadOnly) {
      dispatch(addToast({ type: 'info', message: ro.readOnlyMessage }));
      throw new Error('read-only');
    }
    if (!subjectId) {
      dispatch(addToast({
        type: 'error',
        message: 'A subject is required to save form data.',
      }));
      throw new Error('subject required');
    }
    await sponsorAxiosClient.post(
      `/api/v1/sponsor/workspace/subjects/${subjectId}/forms/${formId}/data`,
      { form_data: formData, status: 'Submitted' },
    );
    dispatch(addToast({ type: 'success', message: 'Form saved.' }));
  }, [formId, subjectId, ro.isReadOnly, ro.readOnlyMessage, dispatch]);

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

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.backBtn} onClick={() => navigate(-1)} style={{ marginBottom: 0 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{formTitle || 'Data Capture'}</span>
      </div>

      <StudyFormRunner
        blocks={blocks}
        formTitle={formTitle}
        defaultValues={defaults}
        onSubmit={handleSubmit}
        submitLabel={ro.isReadOnly ? 'Read-only view' : 'Submit eCRF'}
        readOnly={ro.isReadOnly}
      />
    </div>
  );
}
