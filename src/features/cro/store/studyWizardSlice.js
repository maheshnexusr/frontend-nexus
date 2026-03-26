/**
 * studyWizardSlice — holds draft state for the 6-step study creation wizard.
 * Each step component reads from and writes to the relevant step key.
 * The final Review step (step 6) submits everything via studiesClient.create().
 */

import { createSlice } from '@reduxjs/toolkit';

const STEP1_INIT = {
  studyId:          '',
  studyTitle:       '',
  studyPhaseId:     '',
  studyPhaseName:   '',
  scope:            [],   // e.g. ['EDC', 'Survey']
  therapeuticArea:  '',
  studyDescription: '',
  sponsorId:        '',
  sponsorName:      '',   // organizationName for display
};

// Placeholder shapes — filled out as each step requirement arrives
const STEP2_INIT = {};
const STEP3_INIT = {
  consentManager: false,
  queryManager:   false,
  dataManager:    false,   // EDC only
  navigationBar:  false,
};
const STEP4_INIT = {
  formId:    null,
  formTitle: '',
};
const STEP5_INIT = {
  assignments: [],  // [{ id, memberId, memberName, memberEmail, croRole, studyRole, assignedDate }]
};
const STEP6_INIT = {
  environment:  '',          // 'UAT' | 'LIVE'
  status:       'Published', // 'Published' | 'Active' | 'Inactive' | 'Locked'
  description:  '',
};

const initialState = {
  step1: STEP1_INIT,
  step2: STEP2_INIT,
  step3: STEP3_INIT,
  step4: STEP4_INIT,
  step5: STEP5_INIT,
  step6: STEP6_INIT,
};

const studyWizardSlice = createSlice({
  name: 'studyWizard',
  initialState,
  reducers: {
    setStep1(state, { payload }) { state.step1 = { ...state.step1, ...payload }; },
    setStep2(state, { payload }) { state.step2 = { ...state.step2, ...payload }; },
    setStep3(state, { payload }) { state.step3 = { ...state.step3, ...payload }; },
    setStep4(state, { payload }) { state.step4 = { ...state.step4, ...payload }; },
    setStep5(state, { payload }) { state.step5 = { ...state.step5, ...payload }; },
    setStep6(state, { payload }) { state.step6 = { ...state.step6, ...payload }; },
    /** Reset entire wizard when user cancels or study is created. */
    resetWizard()               { return initialState; },
  },
});

export const { setStep1, setStep2, setStep3, setStep4, setStep5, setStep6, resetWizard } =
  studyWizardSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectStep1 = (state) => state.studyWizard.step1;
export const selectStep2 = (state) => state.studyWizard.step2;
export const selectStep3 = (state) => state.studyWizard.step3;
export const selectStep4 = (state) => state.studyWizard.step4;
export const selectStep5 = (state) => state.studyWizard.step5;
export const selectStep6 = (state) => state.studyWizard.step6;

export default studyWizardSlice.reducer;
