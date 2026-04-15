import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '@/api/axiosClient';

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
 * @property {boolean} consentEnabled
 * @property {boolean} queryEnabled
 * @property {boolean} dataManagerEnabled
 * @property {boolean} navBarEnabled
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
  sidebarCollapsed:  false,
  studyStatus:       'idle',
  studyError:        null,
};

// ─────────────────────────────────────────────────────────────────────────────
// DEV mock studies (removed in production builds)
// ─────────────────────────────────────────────────────────────────────────────

const DEV_MOCK_STUDIES = import.meta.env.DEV
  ? {
      'st-101': {
        id:    'st-101',
        title: 'TRIAL-X Phase II',
        scope: 'EDC',
        config: {
          consentEnabled:     true,
          queryEnabled:       true,
          dataManagerEnabled: false,
          navBarEnabled:      true,
        },
      },
      'st-102': {
        id:    'st-102',
        title: 'CardioSafe Study',
        scope: 'EDC',
        config: {
          consentEnabled:     false,
          queryEnabled:       true,
          dataManagerEnabled: true,
          navBarEnabled:      true,
        },
      },
    }
  : null;

// ─────────────────────────────────────────────────────────────────────────────
// Async thunks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch study details by ID from the backend.
 * In DEV mode, resolves from mock data without hitting the API.
 *
 * Backend expected response shape:
 * {
 *   id:     string,
 *   title:  string,
 *   scope?: 'EDC'|'Survey'|'ePRO',
 *   config: { consentEnabled, queryEnabled, dataManagerEnabled, navBarEnabled }
 * }
 */
export const fetchStudyAsync = createAsyncThunk(
  'workspace/fetchStudy',
  async (studyId, { rejectWithValue }) => {
    // DEV: return mock study without hitting the backend
    if (import.meta.env.DEV && DEV_MOCK_STUDIES) {
      const mock = DEV_MOCK_STUDIES[studyId];
      if (mock) return mock;
      return rejectWithValue(`No mock study found for id "${studyId}"`);
    }

    try {
      const { data } = await apiClient.get(`/studies/${studyId}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
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
      const { id, title, scope = null, config = null } = action.payload;
      state.activeStudyId    = id;
      state.activeStudyTitle = title;
      state.studyScope       = scope;
      state.studyConfig      = config;
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
});
export const selectEnvironment      = (state) => state.workspace.activeEnvironment;
export const selectSidebarCollapsed = (state) => state.workspace.sidebarCollapsed;
export const selectStudyStatus      = (state) => state.workspace.studyStatus;
export const selectStudyError       = (state) => state.workspace.studyError;

export default workspaceSlice.reducer;
