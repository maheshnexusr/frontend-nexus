import { createSlice } from '@reduxjs/toolkit';

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'success'|'error'|'warning'|'info'} ToastType
 */

/**
 * @typedef {Object} Toast
 * @property {string} id          - Unique ID (Date.now() + counter)
 * @property {ToastType} type
 * @property {string} message
 * @property {number} duration    - Auto-dismiss delay in ms (default 4000)
 */

/**
 * @typedef {Object} NotificationState
 * @property {Toast[]} toasts
 */

/** @type {NotificationState} */
const initialState = {
  toasts: [],
};

// Monotonically increasing counter so rapid calls within the same ms are unique
let _toastCounter = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Add a toast notification. ID is auto-generated.
     * @param {NotificationState} state
     * @param {{ payload: { type: ToastType, message: string, duration?: number } }} action
     */
    addToast(state, action) {
      const { type = 'info', message, duration = 4000 } = action.payload;
      state.toasts.push({
        id: `${Date.now()}-${++_toastCounter}`,
        type,
        message,
        duration,
      });
    },

    /**
     * Remove a single toast by ID.
     * @param {NotificationState} state
     * @param {{ payload: string }} action - toast id
     */
    removeToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },

    /** Remove all active toasts. */
    clearAllToasts(state) {
      state.toasts = [];
    },
  },
});

export const { addToast, removeToast, clearAllToasts } = notificationSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectToasts = (state) => state.notifications.toasts;

export default notificationSlice.reducer;
