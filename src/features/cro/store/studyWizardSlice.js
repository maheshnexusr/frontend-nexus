/**
 * studyWizardSlice — holds draft state for the 6-step study creation wizard.
 * Each step component reads from and writes to the relevant step key.
 * The final Review step (step 6) submits everything via studiesClient.create().
 */

import { createSlice } from '@reduxjs/toolkit';

const STEP1_INIT = {
  studyDbId:        null, // DB id returned by POST /step-1; used by steps 2-6
  studyId:          '',   // protocol_number (human-readable)
  studyTitle:       '',
  studyPhaseId:     '',
  studyPhaseName:   '',
  scope:            '',   // single-select: 'EDC' | 'Survey' | 'ePRO'
  therapeuticArea:  '',
  studyDescription: '',
  sponsorId:        '',
  sponsorName:      '',   // organizationName for display
  sponsorPermissions: null, // nested matrix — per-study sponsor workspace grant
  sponsorDashboardWidgetKeys: null, // per-study sponsor dashboard whitelist (Step 1)
  activationMethod: 'PASSWORD', // how invited site personnel activate (PASSWORD | OTP)
};

const STEP2_INIT = {
  startDate:             '',
  expectedEndDate:       '',
  maxSites:              '',
  maxEnrollments:        '',
  regionId:              '',
  regionName:            '',
  randomizationMethod:   '',
  countryId:             '',
  countryName:           '',
  randomizationApproach: '',
  randomizationEnabled:  false,
  contractCurrency:      'INR',
  contractValue:         '',
  milestones:            [],   // [{ id, name, startDate, endDate }]
};
const STEP3_INIT = {
  consentManager:      false,
  consentApproval:     false,   // requires consentManager ON
  queryManager:        false,
  dataManager:         false,   // EDC only
  verificationManager: false,
  navigationBar:       false,
};
const STEP4_INIT = {
  formId:    null,
  formTitle: '',
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
    setStep6(state, { payload }) { state.step6 = { ...state.step6, ...payload }; },
    /** Reset entire wizard when user cancels or study is created. */
    resetWizard()               { return initialState; },
  },
});

export const { setStep1, setStep2, setStep3, setStep4, setStep6, resetWizard } =
  studyWizardSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectStep1 = (state) => state.studyWizard.step1;
export const selectStep2 = (state) => state.studyWizard.step2;
export const selectStep3 = (state) => state.studyWizard.step3;
export const selectStep4 = (state) => state.studyWizard.step4;
export const selectStep6 = (state) => state.studyWizard.step6;

export default studyWizardSlice.reducer;
