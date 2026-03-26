/**
 * FormBuilderPage — /cro/forms/new  or  /cro/forms/:formId
 *
 * - New form  : renders BuilderLayout with empty state (default from Redux)
 * - Edit form : loads form from storage, dispatches importJSON to Redux,
 *               then renders BuilderLayout
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { importJSON, updateFormSettings } from '@/features/form-builder/store/formSlice';
import { base44 } from '@/features/form-builder/api/formsClient';
import BuilderLayout from '@/features/form-builder/components/builder/BuilderLayout';
import styles from './FormBuilderPage.module.css';

export default function FormBuilderPage() {
  const { formId }  = useParams();          // undefined on /new route
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const [ready, setReady] = useState(!formId); // new form is ready immediately

  useEffect(() => {
    if (!formId) return;

    // Load existing form from storage and push into Redux
    base44.entities.Form.filter({ id: formId }).then((results) => {
      const form = results[0];
      if (!form) {
        // Form not found — go back to list
        navigate('/cro/forms', { replace: true });
        return;
      }
      dispatch(importJSON({ elements: form.elements ?? [], formSettings: form.formSettings ?? {} }));
      setReady(true);
    });
  }, [formId]);

  if (!ready) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading form…</p>
      </div>
    );
  }

  return <BuilderLayout formId={formId} />;
}
