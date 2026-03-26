/**
 * studyFormSlice — Blocks → Pages → Fields structure for Study Design (Step 4).
 */
import { createSlice } from '@reduxjs/toolkit';

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export const makeField = (type = 'text') => ({
  id: uid('fld'),
  type,
  label: '',
  placeholder: '',
  helpText: '',
  required: false,
  defaultValue: '',
  options: ['select','multiselect','radiogroup','checkboxgroup'].includes(type)
    ? [{ label: 'Option 1', value: 'opt_1' }, { label: 'Option 2', value: 'opt_2' }]
    : undefined,
  validation: { minLength: '', maxLength: '', min: '', max: '', pattern: '' },
  condition: { enabled: false, logic: 'AND', rules: [] },
  comments: [],
});

export const makePage = (idx = 1) => ({
  id: uid('pg'),
  title: `Page ${idx}`,
  description: '',
  fields: [],
  condition: { enabled: false, logic: 'AND', rules: [] },
});

export const makeBlock = (idx = 1) => ({
  id: uid('blk'),
  title: `Block ${idx}`,
  description: '',
  collapsed: false,
  pages: [makePage(1)],
  condition: { enabled: false, logic: 'AND', rules: [] },
});

const initialState = {
  formId:          null,
  formTitle:       '',
  blocks:          [],
  selectedBlockId: null,
  selectedPageId:  null,
  selectedFieldId: null,
  activePanel:     'builder', // 'builder' | 'conditions' | 'submission' | 'triggers' | 'collaboration'
  submissionControls: {
    saveProgress:        true,
    submitOnce:          true,
    submitWindowEnabled: false,
    submitWindowStart:   '',
    submitWindowEnd:     '',
    confirmationMessage: 'Thank you for your submission.',
    redirectUrl:         '',
  },
  triggers:  [],
  comments:  [],
  isDirty:   false,
};

const studyFormSlice = createSlice({
  name: 'studyForm',
  initialState,
  reducers: {

    // ── Init ────────────────────────────────────────────────────────────────
    initForm(state, { payload }) {
      const { formId, formTitle, data } = payload;
      state.formId    = formId;
      state.formTitle = formTitle ?? '';
      if (data) {
        state.blocks             = data.blocks             ?? [];
        state.submissionControls = { ...state.submissionControls, ...(data.submissionControls ?? {}) };
        state.triggers           = data.triggers           ?? [];
        state.comments           = data.comments           ?? [];
      } else {
        state.blocks = [makeBlock(1)];
      }
      state.selectedBlockId = state.blocks[0]?.id ?? null;
      state.selectedPageId  = state.blocks[0]?.pages[0]?.id ?? null;
      state.selectedFieldId = null;
      state.isDirty = false;
    },

    resetStudyForm() { return initialState; },

    setActivePanel(state, { payload }) { state.activePanel = payload; },

    // ── Block operations ────────────────────────────────────────────────────
    addBlock(state) {
      const blk = makeBlock(state.blocks.length + 1);
      state.blocks.push(blk);
      state.selectedBlockId = blk.id;
      state.selectedPageId  = blk.pages[0].id;
      state.selectedFieldId = null;
      state.isDirty = true;
    },

    removeBlock(state, { payload: blockId }) {
      state.blocks = state.blocks.filter((b) => b.id !== blockId);
      if (state.selectedBlockId === blockId) {
        state.selectedBlockId = state.blocks[0]?.id ?? null;
        state.selectedPageId  = state.blocks[0]?.pages[0]?.id ?? null;
        state.selectedFieldId = null;
      }
      state.isDirty = true;
    },

    updateBlock(state, { payload: { blockId, updates } }) {
      const blk = state.blocks.find((b) => b.id === blockId);
      if (blk) Object.assign(blk, updates);
      state.isDirty = true;
    },

    toggleBlockCollapse(state, { payload: blockId }) {
      const blk = state.blocks.find((b) => b.id === blockId);
      if (blk) blk.collapsed = !blk.collapsed;
    },

    reorderBlocks(state, { payload: { fromIdx, toIdx } }) {
      if (fromIdx === toIdx) return;
      const [removed] = state.blocks.splice(fromIdx, 1);
      state.blocks.splice(toIdx, 0, removed);
      state.isDirty = true;
    },

    selectBlock(state, { payload: blockId }) {
      const blk = state.blocks.find((b) => b.id === blockId);
      if (!blk) return;
      state.selectedBlockId = blockId;
      state.selectedPageId  = blk.pages[0]?.id ?? null;
      state.selectedFieldId = null;
    },

    // ── Page operations ─────────────────────────────────────────────────────
    addPage(state, { payload: blockId }) {
      const blk = state.blocks.find((b) => b.id === blockId);
      if (!blk) return;
      const pg = makePage(blk.pages.length + 1);
      blk.pages.push(pg);
      state.selectedBlockId = blockId;
      state.selectedPageId  = pg.id;
      state.selectedFieldId = null;
      state.isDirty = true;
    },

    removePage(state, { payload: { blockId, pageId } }) {
      const blk = state.blocks.find((b) => b.id === blockId);
      if (!blk || blk.pages.length <= 1) return;
      blk.pages = blk.pages.filter((p) => p.id !== pageId);
      if (state.selectedPageId === pageId) {
        state.selectedPageId  = blk.pages[0]?.id ?? null;
        state.selectedFieldId = null;
      }
      state.isDirty = true;
    },

    updatePage(state, { payload: { blockId, pageId, updates } }) {
      const pg = state.blocks.find((b) => b.id === blockId)?.pages.find((p) => p.id === pageId);
      if (pg) Object.assign(pg, updates);
      state.isDirty = true;
    },

    selectPage(state, { payload: { blockId, pageId } }) {
      state.selectedBlockId = blockId;
      state.selectedPageId  = pageId;
      state.selectedFieldId = null;
    },

    reorderPages(state, { payload: { blockId, fromIdx, toIdx } }) {
      const blk = state.blocks.find((b) => b.id === blockId);
      if (!blk || fromIdx === toIdx) return;
      const [removed] = blk.pages.splice(fromIdx, 1);
      blk.pages.splice(toIdx, 0, removed);
      state.isDirty = true;
    },

    // ── Field operations ────────────────────────────────────────────────────
    addField(state, { payload: { blockId, pageId, fieldType, atIndex } }) {
      const pg = state.blocks.find((b) => b.id === blockId)?.pages.find((p) => p.id === pageId);
      if (!pg) return;
      const fld = makeField(fieldType);
      if (atIndex !== undefined && atIndex >= 0) {
        pg.fields.splice(atIndex, 0, fld);
      } else {
        pg.fields.push(fld);
      }
      state.selectedFieldId = fld.id;
      state.isDirty = true;
    },

    removeField(state, { payload: { blockId, pageId, fieldId } }) {
      const pg = state.blocks.find((b) => b.id === blockId)?.pages.find((p) => p.id === pageId);
      if (!pg) return;
      pg.fields = pg.fields.filter((f) => f.id !== fieldId);
      if (state.selectedFieldId === fieldId) state.selectedFieldId = null;
      state.isDirty = true;
    },

    updateField(state, { payload: { blockId, pageId, fieldId, updates } }) {
      const pg = state.blocks.find((b) => b.id === blockId)?.pages.find((p) => p.id === pageId);
      const fld = pg?.fields.find((f) => f.id === fieldId);
      if (fld) Object.assign(fld, updates);
      state.isDirty = true;
    },

    duplicateField(state, { payload: { blockId, pageId, fieldId } }) {
      const pg = state.blocks.find((b) => b.id === blockId)?.pages.find((p) => p.id === pageId);
      if (!pg) return;
      const idx = pg.fields.findIndex((f) => f.id === fieldId);
      if (idx === -1) return;
      const clone = { ...JSON.parse(JSON.stringify(pg.fields[idx])), id: uid('fld') };
      pg.fields.splice(idx + 1, 0, clone);
      state.selectedFieldId = clone.id;
      state.isDirty = true;
    },

    reorderFields(state, { payload: { blockId, pageId, fromIdx, toIdx } }) {
      const pg = state.blocks.find((b) => b.id === blockId)?.pages.find((p) => p.id === pageId);
      if (!pg || fromIdx === toIdx) return;
      const [removed] = pg.fields.splice(fromIdx, 1);
      pg.fields.splice(toIdx, 0, removed);
      state.isDirty = true;
    },

    selectField(state, { payload: fieldId }) {
      state.selectedFieldId = fieldId;
    },

    deselectField(state) {
      state.selectedFieldId = null;
    },

    // ── Submission controls ─────────────────────────────────────────────────
    updateSubmissionControls(state, { payload }) {
      state.submissionControls = { ...state.submissionControls, ...payload };
      state.isDirty = true;
    },

    // ── Triggers ────────────────────────────────────────────────────────────
    addTrigger(state, { payload }) {
      state.triggers.push({
        id: uid('trg'),
        name: '',
        type: 'email',         // 'email' | 'notification'
        event: 'field_answer', // 'field_answer' | 'form_complete' | 'threshold'
        conditions: { logic: 'AND', rules: [] },
        emailTemplateId: '',
        recipients: [],
        message: '',
        ...payload,
      });
      state.isDirty = true;
    },

    updateTrigger(state, { payload: { id, updates } }) {
      const t = state.triggers.find((t) => t.id === id);
      if (t) Object.assign(t, updates);
      state.isDirty = true;
    },

    removeTrigger(state, { payload: id }) {
      state.triggers = state.triggers.filter((t) => t.id !== id);
      state.isDirty = true;
    },

    // ── Comments ────────────────────────────────────────────────────────────
    addComment(state, { payload: { fieldId, pageId, blockId, text, author } }) {
      state.comments.push({
        id: uid('cmt'),
        fieldId, pageId, blockId,
        text,
        author: author ?? 'CRO User',
        timestamp: new Date().toISOString(),
        resolved: false,
      });
      state.isDirty = true;
    },

    resolveComment(state, { payload: id }) {
      const c = state.comments.find((c) => c.id === id);
      if (c) c.resolved = true;
      state.isDirty = true;
    },

    markSaved(state) { state.isDirty = false; },
  },
});

export const {
  initForm, resetStudyForm, setActivePanel,
  addBlock, removeBlock, updateBlock, toggleBlockCollapse, reorderBlocks, selectBlock,
  addPage, removePage, updatePage, selectPage, reorderPages,
  addField, removeField, updateField, duplicateField, reorderFields, selectField, deselectField,
  updateSubmissionControls,
  addTrigger, updateTrigger, removeTrigger,
  addComment, resolveComment,
  markSaved,
} = studyFormSlice.actions;

export default studyFormSlice.reducer;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectBlocks          = (s) => s.studyForm.blocks;
export const selectSelectedBlockId = (s) => s.studyForm.selectedBlockId;
export const selectSelectedPageId  = (s) => s.studyForm.selectedPageId;
export const selectSelectedFieldId = (s) => s.studyForm.selectedFieldId;
export const selectActivePanel     = (s) => s.studyForm.activePanel;
export const selectSubmissionCtrl  = (s) => s.studyForm.submissionControls;
export const selectTriggers        = (s) => s.studyForm.triggers;
export const selectComments        = (s) => s.studyForm.comments;
export const selectIsDirty         = (s) => s.studyForm.isDirty;
export const selectFormMeta        = (s) => ({ formId: s.studyForm.formId, formTitle: s.studyForm.formTitle });

export const selectActivePage = (s) => {
  const blk = s.studyForm.blocks.find((b) => b.id === s.studyForm.selectedBlockId);
  return blk?.pages.find((p) => p.id === s.studyForm.selectedPageId) ?? null;
};

export const selectActiveBlock = (s) =>
  s.studyForm.blocks.find((b) => b.id === s.studyForm.selectedBlockId) ?? null;

export const selectActiveField = (s) => {
  const pg = selectActivePage(s);
  return pg?.fields.find((f) => f.id === s.studyForm.selectedFieldId) ?? null;
};

// Flat list of all fields in all blocks/pages (for condition target selection)
export const selectAllFields = (s) =>
  s.studyForm.blocks.flatMap((b) => b.pages.flatMap((p) => p.fields));
