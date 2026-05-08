/**
 * sponsorViewSlice — Redux state for "CRO user viewing a sponsor workspace
 * as read-only". This is a SEPARATE scope from the CRO session and from a
 * direct sponsor login; it must never overwrite either.
 *
 * Backed by sponsorViewTokenStore (localStorage), so a page refresh keeps
 * the user inside the read-only view.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { workspaceSponsorClient } from '@/features/workspace/api/workspaceSponsorClient';
import { sponsorViewTokenStore  } from '@/features/workspace/sponsorViewTokenStore';

/* ── Initial state (rehydrated from localStorage) ────────────────────────── */
function readInitial() {
  const meta = sponsorViewTokenStore.getMeta();
  if (!sponsorViewTokenStore.isActive() || !meta) {
    return {
      isReadOnly: false,
      sponsor:    null,
      user:       null,
      studies:    [],
      status:     'idle',
      error:      null,
    };
  }
  return {
    isReadOnly: true,
    sponsor:    meta.sponsor ?? null,
    user:       meta.user    ?? null,
    studies:    meta.studies ?? [],
    status:     'succeeded',
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
    /** Drop the read-only viewer state. CRO session is untouched. */
    exitSponsorView(state) {
      sponsorViewTokenStore.clear();
      state.isReadOnly = false;
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
        state.isReadOnly = true;
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
export const selectIsSponsorReadOnly    = (s) => s.sponsorView.isReadOnly;
export const selectSponsorViewSponsor   = (s) => s.sponsorView.sponsor;
export const selectSponsorViewUser      = (s) => s.sponsorView.user;
export const selectSponsorViewStudies   = (s) => s.sponsorView.studies;
export const selectSponsorViewStatus    = (s) => s.sponsorView.status;
export const selectSponsorViewError     = (s) => s.sponsorView.error;

export default sponsorViewSlice.reducer;
