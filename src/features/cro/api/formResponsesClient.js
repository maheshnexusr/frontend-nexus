/**
 * formResponsesClient — localStorage CRUD for form preview submissions.
 * Key: edc_form_responses
 */

const KEY = 'edc_form_responses';

function getAll() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function persist(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
let _c = Date.now();
function uid() { return `resp-${++_c}`; }

export const formResponsesClient = {
  list(formId) {
    const all = getAll();
    return Promise.resolve(formId ? all.filter((r) => r.formId === formId) : all);
  },

  create(formId, formTitle, responses) {
    const record = {
      id:          uid(),
      formId:      formId ?? 'preview',
      formTitle:   formTitle ?? 'Study Data Collection Form',
      submittedAt: new Date().toISOString(),
      responses,   // { fieldId: { label, value } }
    };
    persist([...getAll(), record]);
    return Promise.resolve(record);
  },

  delete(id) {
    persist(getAll().filter((r) => r.id !== id));
    return Promise.resolve();
  },

  clearAll(formId) {
    persist(formId ? getAll().filter((r) => r.formId !== formId) : []);
    return Promise.resolve();
  },
};
