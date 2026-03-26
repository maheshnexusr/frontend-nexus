/**
 * teamMembersClient — localStorage CRUD for CRO Team Members.
 * Storage key: 'edc_team_members'
 */

const KEY = 'edc_team_members';

function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid() { return `tm-${++_counter}`; }

function getAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  localStorage.setItem(KEY, JSON.stringify([]));
  return [];
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const teamMembersClient = {
  list() {
    return Promise.resolve(getAll());
  },

  create(data) {
    const all    = getAll();
    const record = { id: uid(), ...data, createdAt: now(), updatedAt: now() };
    persist([...all, record]);
    return Promise.resolve(record);
  },

  update(id, data) {
    const all = getAll();
    let updated;
    const next = all.map((r) => {
      if (r.id !== id) return r;
      updated = { ...r, ...data, updatedAt: now() };
      return updated;
    });
    persist(next);
    return Promise.resolve(updated ?? null);
  },

  delete(id) {
    persist(getAll().filter((r) => r.id !== id));
    return Promise.resolve();
  },

  getById(id) {
    return Promise.resolve(getAll().find((r) => r.id === id) ?? null);
  },

  /** Returns true if the email is already taken (optionally exclude one record by id). */
  emailExists(email, excludeId = null) {
    const norm = (email ?? '').toLowerCase().trim();
    const exists = getAll().some(
      (r) => r.email?.toLowerCase().trim() === norm && r.id !== excludeId,
    );
    return Promise.resolve(exists);
  },
};

// ── CSV Export ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildFilename() {
  const d    = new Date();
  const dd   = String(d.getDate()).padStart(2, '0');
  const mmm  = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh   = String(d.getHours()).padStart(2, '0');
  const mm   = String(d.getMinutes()).padStart(2, '0');
  return `Team_Members_${dd}_${mmm}_${yyyy}_${hh}${mm}.csv`;
}

export function exportTeamMembersCSV(data) {
  const headers = ['Full Name', 'Email Address', 'Assigned Role', 'Contact Number', 'Assigned Studies', 'Created Date'];
  const esc     = (v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
  const rows    = data.map((m) => {
    const studies = Array.isArray(m.assignedStudies)
      ? m.assignedStudies.map((s) => s.studyId).join('; ')
      : '';
    return [
      esc(m.fullName),
      esc(m.email),
      esc(m.roleName),
      esc(m.contactNumber),
      esc(studies),
      esc(m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-US') : ''),
    ].join(',');
  });
  const csv      = [headers.join(','), ...rows].join('\n');
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = buildFilename();
  a.click();
  URL.revokeObjectURL(url);
}
