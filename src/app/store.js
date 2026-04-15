import { configureStore } from '@reduxjs/toolkit';
import authReducer          from '@/features/auth/authSlice';
import workspaceReducer     from '@/features/workspace/store/workspaceSlice';
import notificationReducer  from '@/app/notificationSlice';
import formReducer          from '@/features/form-builder/store/formSlice';
import studyWizardReducer   from '@/features/cro/store/studyWizardSlice';
import studyFormReducer     from '@/features/cro/store/studyFormSlice';

/**
 * RTK Query API middleware placeholders.
 *
 * When each API slice is created (e.g. sponsorApi = createApi({...})), append
 * its middleware here:
 *
 *   import { sponsorApi } from '@/features/sponsors/sponsorApi';
 *   // then add sponsorApi.middleware to the concat chain below
 *
 * Pending APIs:
 *   sponsorApi | studyApi | teamApi | mastersApi |
 *   sitesApi   | consentApi | queriesApi | verificationApi
 */
const rtkQueryMiddlewares = [
  // sponsorApi.middleware,
  // studyApi.middleware,
  // teamApi.middleware,
  // mastersApi.middleware,
  // sitesApi.middleware,
  // consentApi.middleware,
  // queriesApi.middleware,
  // verificationApi.middleware,
];

const store = configureStore({
  reducer: {
    auth:          authReducer,
    workspace:     workspaceReducer,
    notifications: notificationReducer,
    form:          formReducer,
    studyWizard:   studyWizardReducer,
    studyForm:     studyFormReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(...rtkQueryMiddlewares),

  devTools: import.meta.env.DEV,
});

export default store;
