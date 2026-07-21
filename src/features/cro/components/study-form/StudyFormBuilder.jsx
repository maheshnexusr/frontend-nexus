/**
 * StudyFormBuilder — self-contained form builder for Study Design (Step 4).
 * Layout: [Left: Structure/Fields] [Center: Canvas] [Right: Properties]
 * Top toolbar switches between Builder / Submission / Triggers / Collaboration views.
 */
import { useState, useEffect }      from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Settings2, Zap, Users, ArrowLeft, ArrowRight, Save, LayoutTemplate, Eye, Maximize2, Minimize2, ShieldCheck } from 'lucide-react';
import {
  initForm, setActivePanel,
  selectActivePanel, selectBlocks, selectIsDirty, markSaved,
  selectTriggers, selectSubmissionCtrl, selectEligibilityCriteria, fieldKeyOf,
} from '@/features/cro/store/studyFormSlice';
import { selectStep1 }              from '@/features/cro/store/studyWizardSlice';
import { studiesClient }            from '@/features/cro/api/studiesClient';
import { detectCircular }           from './formulaEngine';
import { addToast }                 from '@/app/notificationSlice';
import { usePermissions }           from '@/features/auth/usePermissions';
import SFBLeft                      from './SFBLeft';
import SFBCanvas                    from './SFBCanvas';
import SFBRight                     from './SFBRight';
import SFBTopPanels                 from './SFBTopPanels';
import SFBPreview                   from './SFBPreview';
import EligibilityCriteriaModal     from './EligibilityCriteriaModal';
import s from './StudyFormBuilder.module.css';

export default function StudyFormBuilder({ formId, formTitle, onPrevious, onNext }) {
  const dispatch     = useDispatch();
  const activePanel  = useSelector(selectActivePanel);
  const [previewing, setPreviewing] = useState(false);
  const [maximized,  setMaximized]  = useState(false);
  const [eligOpen,   setEligOpen]   = useState(false);
  const blocks       = useSelector(selectBlocks);
  const isDirty      = useSelector(selectIsDirty);
  const triggers     = useSelector(selectTriggers);
  const submissionControls = useSelector(selectSubmissionCtrl);
  const eligibilityCriteria = useSelector(selectEligibilityCriteria);
  const step1        = useSelector(selectStep1);

  // ── Load form data from the study record ─────────────────────────────────
  useEffect(() => {
    if (!step1.studyDbId) {
      dispatch(initForm({ formId: null, formTitle: formTitle ?? '', data: null }));
      return;
    }
    studiesClient.getById(step1.studyDbId)
      .then((study) => {
        dispatch(initForm({
          formId: study.formId ?? null,
          formTitle: formTitle ?? '',
          data: study.formDefinition ?? null,
          randomizationEnabled: study.randomizationEnabled ?? false,
        }));
      })
      .catch(() => {
        dispatch(initForm({ formId: null, formTitle: formTitle ?? '', data: null }));
      });
  }, [step1.studyDbId]);

  // Reject a save when two+ formula fields reference each other in a cycle
  // (A = B + 1, B = A + 1). Returns the cycle's field keys, or null when clean.
  const findFormulaCycle = () => {
    const formulaFields = [];
    for (const blk of blocks || []) {
      for (const pg of blk.pages || []) {
        for (const f of pg.fields || []) {
          if (f?.type === 'formula') {
            const key = fieldKeyOf(f);
            if (key) formulaFields.push({ fieldKey: key, expression: f.expression || '' });
          }
        }
      }
    }
    return detectCircular(formulaFields);
  };

  // ── Save (hits PUT /api/v1/studies/{id}/step-4) ──────────────────────────
  const persistStep4 = async () => {
    if (!step1.studyDbId) {
      throw new Error('Study record not found. Please complete Step 1 first.');
    }
    const cycle = findFormulaCycle();
    if (cycle) {
      throw new Error(`Circular reference detected between formula fields: ${cycle.cycle.join(' → ')}`);
    }
    await studiesClient.step4(step1.studyDbId, {
      formStructure: { blocks, submissionControls, eligibilityCriteria },
      version: 1,
      triggers: triggers.map((t) => ({
        triggerCondition:  t.conditions ?? null,
        triggerAction:     t.type === 'email' ? 'Email' : 'Notification',
        triggerRecipients: t.recipients ?? [],
        emailTemplateId:   t.emailTemplateId || null,
        isActive:          t.isActive ?? true,
      })),
    });
    dispatch(markSaved());
  };

  const handleSave = async () => {
    try {
      await persistStep4();
      dispatch(addToast({ type: 'success', message: 'Study design saved successfully.', duration: 3000 }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err.message || 'Failed to save. Please try again.', duration: 4000 }));
    }
  };

  const handleNext = async () => {
    try {
      await persistStep4();
      onNext?.();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err.message || 'Failed to save Study Design. Please try again.', duration: 4000 }));
    }
  };

  // Each panel-switch tab is gated by the matching Studies permission. The
  // Builder + Submission tabs are always available — only the per-feature
  // panels (Triggers, Collaboration) and the in-panel Conditional Visibility
  // editor are author-controlled.
  const { has } = usePermissions();
  const TOOLBAR_TABS = [
    { id: 'builder',       label: 'Builder',        Icon: LayoutTemplate, allowed: true },
    { id: 'submission',    label: 'Submission',     Icon: Settings2,     allowed: true },
    { id: 'triggers',      label: 'Triggers',       Icon: Zap,           allowed: has('studies', 'triggers')      },
    { id: 'collaboration', label: 'Collaboration',  Icon: Users,         allowed: has('studies', 'collaboration') },
  ].filter((t) => t.allowed);

  return (
    <div className={`${s.root} ${maximized ? s.rootMaximized : ''}`}>
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
            className={s.btnPreview}
            onClick={() => setMaximized((v) => !v)}
            title={maximized ? 'Exit full screen' : 'Enter full screen'}
            aria-label={maximized ? 'Exit full screen' : 'Enter full screen'}
          >
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {maximized ? 'Exit Full Screen' : 'Full Screen'}
          </button>
          <button
            className={`${s.btnPreview} ${previewing ? s.btnPreviewActive : ''}`}
            onClick={() => setPreviewing((v) => !v)}
            title={previewing ? 'Back to Builder' : 'Preview form'}
          >
            <Eye size={13} />
            {previewing ? 'Exit Preview' : 'Preview'}
          </button>
          {!previewing && has('studies', 'conditional_visibility') && (
            <button
              className={s.btnPreview}
              onClick={() => setEligOpen(true)}
              title="Configure Inclusion / Exclusion criteria"
            >
              <ShieldCheck size={13} /> Eligibility
            </button>
          )}
          {!previewing && (
            <button className={s.btnSave} onClick={handleSave}>
              <Save size={13} /> Save Design
            </button>
          )}
        </div>
      </div>

      {eligOpen && <EligibilityCriteriaModal onClose={() => setEligOpen(false)} />}

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
