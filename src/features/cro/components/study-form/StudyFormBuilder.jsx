/**
 * StudyFormBuilder — self-contained form builder for Study Design (Step 4).
 * Layout: [Left: Structure/Fields] [Center: Canvas] [Right: Properties]
 * Top toolbar switches between Builder / Submission / Triggers / Collaboration views.
 */
import { useState, useEffect }      from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Settings2, Zap, Users, ArrowLeft, ArrowRight, Save, LayoutTemplate, Eye } from 'lucide-react';
import {
  initForm, setActivePanel,
  selectActivePanel, selectBlocks, selectIsDirty, selectFormMeta, markSaved,
} from '@/features/cro/store/studyFormSlice';
import { setStep4 }                 from '@/features/cro/store/studyWizardSlice';
import { addToast }                 from '@/app/notificationSlice';
import apiClient                    from '@/api/axiosClient';
import SFBLeft                      from './SFBLeft';
import SFBCanvas                    from './SFBCanvas';
import SFBRight                     from './SFBRight';
import SFBTopPanels                 from './SFBTopPanels';
import SFBPreview                   from './SFBPreview';
import s from './StudyFormBuilder.module.css';

export default function StudyFormBuilder({ formId, formTitle, onPrevious, onNext }) {
  const dispatch     = useDispatch();
  const activePanel  = useSelector(selectActivePanel);
  const [previewing, setPreviewing] = useState(false);
  const blocks       = useSelector(selectBlocks);
  const isDirty      = useSelector(selectIsDirty);
  const meta         = useSelector(selectFormMeta);

  // ── Load form data from backend ───────────────────────────────────────────
  useEffect(() => {
    if (!formId) {
      dispatch(initForm({ formId: null, formTitle: formTitle ?? '', data: null }));
      return;
    }
    apiClient.get(`/studies/forms/${formId}`)
      .then((form) => {
        dispatch(initForm({
          formId,
          formTitle: form?.title ?? formTitle ?? '',
          data: form?.studyFormData ?? null,
        }));
      })
      .catch(() => {
        // form not yet saved — start fresh
        dispatch(initForm({ formId: null, formTitle: formTitle ?? '', data: null }));
      });
  }, [formId]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const save = async (silent = false) => {
    try {
      const payload = {
        title: meta.formTitle || formTitle || 'Study Data Collection Form',
        studyFormData: { blocks },
        status: 'draft',
      };

      if (formId) {
        await apiClient.put(`/studies/forms/${formId}`, payload);
      } else {
        const newForm = await apiClient.post('/studies/forms', payload);
        dispatch(setStep4({ formId: newForm.id, formTitle: newForm.title }));
      }

      dispatch(markSaved());
      if (!silent) {
        dispatch(addToast({ type: 'success', message: 'Study design saved successfully.', duration: 3000 }));
      }
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to save. Please try again.', duration: 4000 }));
    }
  };

  const handleSave = () => save(false);

  const handleNext = async () => {
    await save(true);
    onNext?.();
  };

  const TOOLBAR_TABS = [
    { id: 'builder',       label: 'Builder',        Icon: LayoutTemplate },
    { id: 'submission',    label: 'Submission',      Icon: Settings2 },
    { id: 'triggers',      label: 'Triggers',        Icon: Zap },
    { id: 'collaboration', label: 'Collaboration',   Icon: Users },
  ];

  return (
    <div className={s.root}>
      {/* ── Top toolbar ──────────────────────────────────────────────────── */}
      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          {TOOLBAR_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`${s.toolBtn} ${activePanel === id ? s.toolBtnActive : ''}`}
              onClick={() => dispatch(setActivePanel(id))}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        <div className={s.toolbarRight}>
          {isDirty && !previewing && <span className={s.dirtyDot} title="Unsaved changes" />}
          <button
            className={`${s.btnPreview} ${previewing ? s.btnPreviewActive : ''}`}
            onClick={() => setPreviewing((v) => !v)}
            title={previewing ? 'Back to Builder' : 'Preview form'}
          >
            <Eye size={13} />
            {previewing ? 'Exit Preview' : 'Preview'}
          </button>
          {!previewing && (
            <button className={s.btnSave} onClick={handleSave}>
              <Save size={13} /> Save Design
            </button>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className={s.body}>
        {previewing ? (
          <SFBPreview onExitPreview={() => setPreviewing(false)} />
        ) : (
          <>
            <SFBLeft />
            <SFBCanvas />
            <SFBRight />

            {/* Slide-in overlay panels */}
            {activePanel !== 'builder' && (
              <SFBTopPanels activePanel={activePanel} />
            )}
          </>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className={s.footer}>
        <button className={s.btnPrev} onClick={onPrevious}>
          <ArrowLeft size={14} /> Previous
        </button>
        <div className={s.footerRight}>
          <span className={s.blockCount}>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          <button className={s.btnNext} onClick={handleNext}>
            Next <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
