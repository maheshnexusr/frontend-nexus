/**
 * sponsorViewSlice — Redux state for "CRO user is currently inside a sponsor
 * workspace they entered via /workspace/sponsors/:id/enter".
 *
 * This is a SEPARATE scope from the CRO session and from a direct sponsor
 * login; it must never overwrite either. Backed by sponsorViewTokenStore
 * (localStorage), so a page refresh keeps the user inside the view.
 *
 * NOTE: This used to be a "read-only" viewer. The CRO is now given the same
 * write access as a sponsor login when they enter via /enter, so the
 * `isReadOnly` flag is permanently `false` and write-control gating no
 * longer applies. The slice still tracks "is the CRO currently inside a
 * sponsor workspace" via `isViewing` so the top-bar logout can choose
 * between "exit view" and "full sign-out".
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { workspaceSponsorClient } from '@/features/workspace/api/workspaceSponsorClient';
import { sponsorViewTokenStore  } from '@/features/workspace/sponsorViewTokenStore';

/* ── Initial state (rehydrated from localStorage) ────────────────────────── */
function readInitial() {
  const meta   = sponsorViewTokenStore.getMeta();
  const active = sponsorViewTokenStore.isActive() && !!meta;
  return {
    // CRO viewers have full write access now — kept as `false` permanently.
    isReadOnly: false,
    // True while the CRO is inside a sponsor workspace via /enter; used by
    // the header to choose between "exit view" and "full sign-out".
    isViewing:  active,
    sponsor:    active ? (meta.sponsor ?? null) : null,
    user:       active ? (meta.user    ?? null) : null,
    studies:    active ? (meta.studies ?? [])   : [],
    status:     active ? 'succeeded' : 'idle',
    error:      null,
  };
}

/* ── Thunks ──────────────────────────────────────────────────────────────── */
export const enterSponsorWorkspaceAsync = createAsyncThunk(
  'sponsorView/enter',
  async (sponsorId, { rejectWithValue }) => {
    try {
      const result = await workspaceSponsorClient.enter(sponsorId);
      if (!result.accessToken) {
        return rejectWithValue('Server did not return a sponsor view token.');
      }
      sponsorViewTokenStore.setSession(result);
      return result;
    } catch (err) {
      return rejectWithValue(err?.message ?? 'Failed to enter sponsor workspace.');
    }
  },
);

/* ── Slice ───────────────────────────────────────────────────────────────── */
const sponsorViewSlice = createSlice({
  name: 'sponsorView',
  initialState: readInitial(),
  reducers: {
    /** Exit the sponsor view. CRO session is untouched. */
    exitSponsorView(state) {
      sponsorViewTokenStore.clear();
      state.isReadOnly = false;
      state.isViewing  = false;
      state.sponsor    = null;
      state.user       = null;
      state.studies    = [];
      state.status     = 'idle';
      state.error      = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(enterSponsorWorkspaceAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(enterSponsorWorkspaceAsync.fulfilled, (state, { payload }) => {
        state.isReadOnly = false;            // CRO viewers have full access
        state.isViewing  = true;
        state.sponsor    = payload.sponsor;
        state.user       = payload.user;
        state.studies    = payload.studies;
        state.status     = 'succeeded';
        state.error      = null;
      })
      .addCase(enterSponsorWorkspaceAsync.rejected, (state, { payload }) => {
        state.status = 'failed';
        state.error  = payload;
      });
  },
});

export const { exitSponsorView } = sponsorViewSlice.actions;

/* ── Selectors ───────────────────────────────────────────────────────────── */
export const selectSponsorView          = (s) => s.sponsorView;
/** True when the CRO is currently inside a sponsor workspace (entered via /enter). */
export const selectIsViewingSponsor     = (s) => !!s.sponsorView.isViewing;
/** Legacy alias — kept so existing call sites still compile, always `false` now. */
export const selectIsSponsorReadOnly    = (s) => s.sponsorView.isReadOnly;
export const selectSponsorViewSponsor   = (s) => s.sponsorView.sponsor;
export const selectSponsorViewUser      = (s) => s.sponsorView.user;
export const selectSponsorViewStudies   = (s) => s.sponsorView.studies;
export const selectSponsorViewStatus    = (s) => s.sponsorView.status;
export const selectSponsorViewError     = (s) => s.sponsorView.error;

export default sponsorViewSlice.reducer;
