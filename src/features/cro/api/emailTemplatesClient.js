/**
 * emailTemplatesClient — localStorage CRUD for Email Templates.
 * All methods return Promises so the API shape matches a real REST client.
 * Replace the body of each method with apiClient calls when backend is ready.
 */

const KEY = 'cro_email_templates';
const uid = () => `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
};
const write = (list) => localStorage.setItem(KEY, JSON.stringify(list));

export const emailTemplatesClient = {
  /** List all templates, newest first */
  list: () =>
    Promise.resolve(
      [...read()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    ),

  /** Create a new template */
  create: (data) => {
    const list = read();
    const now  = new Date().toISOString();
    const item = { ...data, id: uid(), createdAt: now, updatedAt: now };
    write([...list, item]);
    return Promise.resolve(item);
  },

  /** Update an existing template by id */
  update: (id, data) => {
    const list = read();
    const idx  = list.findIndex((t) => t.id === id);
    if (idx === -1) return Promise.reject(new Error('Template not found'));
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    write(list);
    return Promise.resolve(list[idx]);
  },

  /** Delete a template by id */
  delete: (id) => {
    write(read().filter((t) => t.id !== id));
    return Promise.resolve();
  },

  /**
   * Check if a templateCode already exists.
   * Pass excludeId when editing so the current template's code is excluded.
   */
  codeExists: (code, excludeId = null) =>
    Promise.resolve(
      read().some(
        (t) =>
          t.templateCode.toUpperCase() === code.toUpperCase() &&
          t.id !== excludeId,
      ),
    ),
};
