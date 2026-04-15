/**
 * CaptureFormPage
 * Fetches a study's eCRF form schema from the backend and renders it
 * using DynamicForm. Supports subject data capture with save-as-draft
 * and final submit flows.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DynamicForm from '@/components/dynamic-form/DynamicForm';
import apiClient from '@/api/axiosClient';
import s from './CaptureFormPage.module.css';

export default function CaptureFormPage() {
  const { studyId, formId, subjectId } = useParams();
  const navigate = useNavigate();

  const [schema,   setSchema]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [defaults, setDefaults] = useState({});

  /* ── fetch form schema (and existing data if editing) ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        /* fetch saved form schema from backend */
        const form = await apiClient.get(`/studies/forms/${formId}`);
        /* the DynamicForm expects { formTitle, blocks:[...] } */
        const schema = {
          formTitle: form.title,
          ...(form.studyFormData ?? {}),
        };
        if (!cancelled) setSchema(schema);

        /* if subjectId present, load saved answers */
        if (subjectId) {
          const dataRes = await apiClient.get(
            `/studies/${studyId}/forms/${formId}/subjects/${subjectId}/data`,
          );
          if (!cancelled) setDefaults(dataRes?.formData ?? {});
        }
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'Failed to load form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (studyId && formId) load();
  }, [studyId, formId, subjectId]);

  /* ── submit handler ── */
  const handleSubmit = useCallback(async (formData) => {
    const payload = {
      studyId,
      formId,
      subjectId: subjectId ?? null,
      formData,
      submittedAt: new Date().toISOString(),
    };

    await apiClient.post(
      `/studies/${studyId}/forms/${formId}/subjects${subjectId ? `/${subjectId}` : ''}/data`,
      payload,
    );
  }, [studyId, formId, subjectId]);

  /* ── loading ── */
  if (loading) {
    return (
      <div className={s.center}>
        <Loader2 size={32} className={s.spinner} />
        <p>Loading form…</p>
      </div>
    );
  }

  /* ── error ── */
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

  /* ── form ── */
  return (
    <div className={s.page}>
      <button className={s.backBtn} onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      <DynamicForm
        schema={schema}
        onSubmit={handleSubmit}
        defaultValues={defaults}
        submitLabel="Submit eCRF"
      />
    </div>
  );
}
