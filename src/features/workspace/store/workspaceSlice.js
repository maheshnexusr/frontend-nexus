import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '@/api/axiosClient';
import {
  sponsorStudiesService,
  sponsorStudyContextStore,
} from '@/services/sponsorAuthService';

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'cro'|'sponsor'} WorkspaceType
 * @typedef {'UAT'|'LIVE'} Environment
 * @typedef {'EDC'|'Survey'|'ePRO'|null} StudyScope
 */

/**
 * @typedef {Object} StudyConfig
 * Step 3 module toggles. Both the new key names (consentManager, queryManager,
 * dataManager, verificationManager, navigationBar) and the legacy aliases
 * (consentEnabled, queryEnabled, dataManagerEnabled, navBarEnabled) are
 * supported via resolveStudyConfig in studyConfigGating.js.
 *
 * @property {boolean} [consentManager]
 * @property {boolean} [queryManager]
 * @property {boolean} [dataManager]
 * @property {boolean} [verificationManager]
 * @property {boolean} [navigationBar]
 */

/**
 * @typedef {Object} WorkspaceState
 * @property {WorkspaceType} currentWorkspace
 * @property {string|null} activeSponsorId
 * @property {string|null} activeSponsorName
 * @property {string|null} activeStudyId
 * @property {string|null} activeStudyTitle
 * @property {Environment} activeEnvironment
 * @property {StudyScope} studyScope
 * @property {StudyConfig|null} studyConfig
 * @property {boolean} sidebarCollapsed
 * @property {'idle'|'loading'|'succeeded'|'failed'} studyStatus
 * @property {string|null} studyError
 */

/** @type {WorkspaceState} */
const initialState = {
  currentWorkspace:  'cro',
  activeSponsorId:   null,
  activeSponsorName: null,
  activeStudyId:     null,
  activeStudyTitle:  null,
  activeEnvironment: 'UAT',
  studyScope:        null,
  studyConfig:       null,
  sponsorLogo:       null,
  sidebarCollapsed:  false,
  studyStatus:       'idle',
  studyError:        null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Async thunks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rehydrate the active study by id (e.g. on direct nav or browser refresh).
 *
 * Scope routing:
 *   - Sponsor (sponsorAccessToken present) → GET /api/v1/sponsor/studies and
 *     pick the assignment that matches studyId (+ persisted environment if
 *     the user is assigned to the same study under multiple envs). Metadata
 *     we care about: scope + title. Config isn't in the list response, so we
 *     return it as null and SponsorLayout falls back to all-enabled.
 *   - CRO → GET /studies/:id (the legacy shape).
 *
 * Returned shape:
 *   { id, title, scope?: 'EDC'|'Survey'|'ePRO', config?: StudyConfig|null }
 */
export const fetchStudyAsync = createAsyncThunk(
  'workspace/fetchStudy',
  async (studyId, { rejectWithValue }) => {
    // A CRO user who entered a sponsor workspace via /enter holds a
    // sponsorViewToken (not sponsorAccessToken) — treat that as sponsor scope
    // too, otherwise this falls through to the CRO /studies/:id endpoint and
    // 403s for roles without ClinicalPrograms.Studies.view.
    const hasSponsorToken = !!localStorage.getItem('sponsorAccessToken')
      || !!localStorage.getItem('sponsorViewToken');

    if (hasSponsorToken) {
      try {
        const list = await sponsorStudiesService.list();
        const ctx  = sponsorStudyContextStore.get();
        const match =
          (ctx?.environment && list.find((s) => s.id === studyId && s.environment === ctx.environment))
          ?? list.find((s) => s.id === studyId);
        if (!match) {
          return rejectWithValue(`Study "${studyId}" is not assigned to your account.`);
        }
        return {
          id:          match.id,
          title:       match.title,
          scope:       match.scope,
          config:      match.config ?? null,
          logo:        match.organizationLogo ?? null,
          environment: match.environment ?? ctx?.environment ?? null,
        };
      } catch (err) {
        return rejectWithValue(err?.message ?? 'Failed to load sponsor study.');
      }
    }

    try {
      const res = await apiClient.get(`/api/v1/studies/${studyId}`);
      // axiosClient interceptors already unwrap the response body.
      return res?.data ?? res;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message ?? err?.message ?? 'Failed to load study.');
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    /**
     * Switch the top-level workspace context.
     * @param {WorkspaceState} state
     * @param {{ payload: WorkspaceType }} action
     */
    switchWorkspace(state, action) {
      state.currentWorkspace  = action.payload;
      state.activeSponsorId   = null;
      state.activeSponsorName = null;
      state.activeStudyId     = null;
      state.activeStudyTitle  = null;
      state.studyScope        = null;
      state.studyConfig       = null;
      state.studyStatus       = 'idle';
      state.studyError        = null;
    },

    /**
     * Select an active sponsor.
     * @param {WorkspaceState} state
     * @param {{ payload: { id: string, name: string } }} action
     */
    selectSponsor(state, action) {
      state.activeSponsorId   = action.payload.id;
      state.activeSponsorName = action.payload.name;
      state.activeStudyId     = null;
      state.activeStudyTitle  = null;
      state.studyScope        = null;
      state.studyConfig       = null;
      state.studyStatus       = 'idle';
      state.studyError        = null;
    },

    /**
     * Manually set an active study (used when study data is already available).
     * @param {WorkspaceState} state
     * @param {{ payload: { id: string, title: string, scope?: StudyScope, config?: StudyConfig } }} action
     */
    selectStudy(state, action) {
      const { id, title, scope = null, config = null, logo = null, environment = null } = action.payload;
      state.activeStudyId    = id;
      state.activeStudyTitle = title;
      state.studyScope       = scope;
      state.studyConfig      = config;
      state.sponsorLogo      = logo;
      if (environment === 'UAT' || environment === 'LIVE') {
        state.activeEnvironment = environment;
      }
      state.studyStatus      = 'succeeded';
      state.studyError       = null;
    },

    /**
     * Switch between UAT and LIVE environments.
     * @param {WorkspaceState} state
     * @param {{ payload: Environment }} action
     */
    switchEnvironment(state, action) {
      state.activeEnvironment = action.payload;
    },

    /** Toggle the sidebar collapsed state. */
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    /** Reset all sponsor- and study-level context (keeps workspace and environment). */
    clearWorkspaceContext(state) {
      state.activeSponsorId   = null;
      state.activeSponsorName = null;
      state.activeStudyId     = null;
      state.activeStudyTitle  = null;
      state.studyScope        = null;
      state.studyConfig       = null;
      state.studyStatus       = 'idle';
      state.studyError        = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchStudyAsync.pending, (state) => {
        state.studyStatus = 'loading';
        state.studyError  = null;
      })
      .addCase(fetchStudyAsync.fulfilled, (state, { payload }) => {
        state.activeStudyId    = payload.id;
        state.activeStudyTitle = payload.title;
        state.studyScope       = payload.scope  ?? null;
        state.studyConfig      = payload.config ?? null;
        // Sponsor organisation logo (for the sidebar brand). Sponsor list path
        // sends `logo`; the CRO study-detail path sends `organization_logo_path`.
        state.sponsorLogo      = payload.logo ?? payload.organization_logo_path ?? null;
        // The header env badge must reflect the environment the study was
        // opened in, not the initial-state default. Only the sponsor path
        // knows it; the CRO /studies/:id shape doesn't carry one — keep as-is.
        if (payload.environment === 'UAT' || payload.environment === 'LIVE') {
          state.activeEnvironment = payload.environment;
        }
        state.studyStatus      = 'succeeded';
        state.studyError       = null;
      })
      .addCase(fetchStudyAsync.rejected, (state, { payload }) => {
        state.studyStatus = 'failed';
        state.studyError  = payload;
      });
  },
});

export const {
  switchWorkspace,
  selectSponsor,
  selectStudy,
  switchEnvironment,
  toggleSidebar,
  clearWorkspaceContext,
} = workspaceSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectWorkspace        = (state) => state.workspace;
export const selectCurrentWorkspace = (state) => state.workspace.currentWorkspace;
export const selectActiveSponsor    = (state) => ({
  id:   state.workspace.activeSponsorId,
  name: state.workspace.activeSponsorName,
});
export const selectActiveStudy      = (state) => ({
  id:     state.workspace.activeStudyId,
  title:  state.workspace.activeStudyTitle,
  scope:  state.workspace.studyScope,
  config: state.workspace.studyConfig,
  logo:   state.workspace.sponsorLogo ?? null,
});
export const selectEnvironment      = (state) => state.workspace.activeEnvironment;
export const selectSidebarCollapsed = (state) => state.workspace.sidebarCollapsed;
export const selectStudyStatus      = (state) => state.workspace.studyStatus;
export const selectStudyError       = (state) => state.workspace.studyError;

export default workspaceSlice.reducer;
