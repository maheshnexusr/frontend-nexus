import { createSlice } from '@reduxjs/toolkit';

const MAX_HISTORY = 50;

function snapshot(elements) {
  return JSON.parse(JSON.stringify(elements));
}

function pushHistory(state) {
  const sliced = state.history.slice(0, state.historyIndex + 1);
  sliced.push(snapshot(state.elements));
  const trimmed = sliced.length > MAX_HISTORY ? sliced.slice(-MAX_HISTORY) : sliced;
  state.history = trimmed;
  state.historyIndex = trimmed.length - 1;
}

const initialState = {
  elements: [],
  selectedId: null,
  mode: 'editor',
  history: [[]],
  historyIndex: 0,
  formSettings: {
    title: 'Untitled Form',
    description: '',
    submitText: 'Submit',
    successMessage: 'Form submitted successfully!',
  },
};

const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    setMode(state, action) {
      state.mode = action.payload;
    },
    selectElement(state, action) {
      state.selectedId = action.payload;
    },
    deselectElement(state) {
      state.selectedId = null;
    },
    addElement(state, action) {
      const { element, atIndex } = action.payload;
      if (atIndex !== null && atIndex !== undefined && atIndex >= 0 && atIndex <= state.elements.length) {
        state.elements.splice(atIndex, 0, element);
      } else {
        state.elements.push(element);
      }
      state.selectedId = element.id;
      pushHistory(state);
    },
    removeElement(state, action) {
      const id = action.payload;
      state.elements = state.elements.filter((e) => e.id !== id);
      if (state.selectedId === id) state.selectedId = null;
      pushHistory(state);
    },
    updateElement(state, action) {
      const { id, updates } = action.payload;
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx !== -1) {
        state.elements[idx] = { ...state.elements[idx], ...updates };
      }
    },
    moveElement(state, action) {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;
      const [removed] = state.elements.splice(fromIndex, 1);
      state.elements.splice(toIndex, 0, removed);
      pushHistory(state);
    },
    duplicateElement(state, action) {
      const id = action.payload;
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx === -1) return;
      const orig = state.elements[idx];
      const clone = { ...JSON.parse(JSON.stringify(orig)), id: `${orig.type}_${Date.now()}` };
      state.elements.splice(idx + 1, 0, clone);
      state.selectedId = clone.id;
      pushHistory(state);
    },
    updateFormSettings(state, action) {
      state.formSettings = { ...state.formSettings, ...action.payload };
    },
    clearAll(state) {
      state.elements = [];
      state.selectedId = null;
      pushHistory(state);
    },
    importJSON(state, action) {
      const data = action.payload;
      state.elements = data.elements || [];
      state.formSettings = { ...state.formSettings, ...(data.formSettings || {}) };
      state.selectedId = null;
      pushHistory(state);
    },
    undo(state) {
      if (state.historyIndex <= 0) return;
      state.historyIndex -= 1;
      state.elements = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
      state.selectedId = null;
    },
    redo(state) {
      if (state.historyIndex >= state.history.length - 1) return;
      state.historyIndex += 1;
      state.elements = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
      state.selectedId = null;
    },
  },
});

export const {
  setMode, selectElement, deselectElement,
  addElement, removeElement, updateElement,
  moveElement, duplicateElement,
  updateFormSettings, clearAll, importJSON,
  undo, redo,
} = formSlice.actions;

export default formSlice.reducer;

// Selectors
export const selectElements = (s) => s.form.elements;
export const selectSelectedId = (s) => s.form.selectedId;
export const selectMode = (s) => s.form.mode;
export const selectFormSettings = (s) => s.form.formSettings;
export const selectCanUndo = (s) => s.form.historyIndex > 0;
export const selectCanRedo = (s) => s.form.historyIndex < s.form.history.length - 1;
export const selectExportJSON = (s) =>
  JSON.stringify({ formSettings: s.form.formSettings, elements: s.form.elements }, null, 2);
