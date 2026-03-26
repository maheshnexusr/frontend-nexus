/**
 * StudyWizardStep4 — Study Design
 *
 * Embeds the StudyFormBuilder (Blocks → Pages → Fields) directly in the wizard tab.
 * onPrevious → go back to Step 3 (Study Configuration)
 * onNext     → go to Step 5
 */
import { useSelector } from 'react-redux';
import { selectStep1, selectStep4 } from '@/features/cro/store/studyWizardSlice';
import StudyFormBuilder from '@/features/cro/components/study-form/StudyFormBuilder';

export default function StudyWizardStep4({ onPrevious, onNext }) {
  const step1 = useSelector(selectStep1);
  const step4 = useSelector(selectStep4);

  const defaultTitle = step1.studyTitle
    ? `${step1.studyTitle} — Data Collection Form`
    : 'Study Data Collection Form';

  return (
    <StudyFormBuilder
      formId={step4.formId ?? null}
      formTitle={step4.formTitle || defaultTitle}
      onPrevious={onPrevious}
      onNext={onNext}
    />
  );
}
