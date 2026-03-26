/**
 * sponsorsClient — localStorage CRUD for Sponsors.
 */

const KEY = 'edc_sponsors';

function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid() { return `sp-${++_counter}`; }

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

// ── Export filename helper ────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function buildExportFilename() {
  const d   = new Date();
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `Sponsor_Details_${dd}_${mmm}_${yyyy} ${hh}${mm}.csv`;
}

export function exportSponsorsCSV(data) {
  const headers = [
    'Full Name','Email Address','Contact Number','Organization Name',
    'Website','Registration Number','Address Line 1','Address Line 2',
    'City','District','State','Zipcode','Country','Status','Created Date',
  ];
  const esc = (v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
  const rows = data.map((s) => [
    esc(s.fullName), esc(s.email), esc(s.contactNumber), esc(s.organizationName),
    esc(s.website), esc(s.registrationNumber), esc(s.addressLine1), esc(s.addressLine2),
    esc(s.city), esc(s.district), esc(s.state), esc(s.zipcode), esc(s.countryName),
    esc(s.status), esc(s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-US') : ''),
  ]);
  const csv  = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = buildExportFilename();
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}

export const sponsorsClient = {
  list() {
    return Promise.resolve(getAll());
  },

  create(data) {
    const all    = getAll();
    const record = { id: uid(), ...data, createdBy: 'Admin', createdAt: now(), updatedAt: now() };
    persist([...all, record]);
    return Promise.resolve(record);
  },

  update(id, data) {
    const all = getAll();
    let updated;
    const next = all.map((r) => {
      if (r.id !== id) return r;
      updated = { ...r, ...data, email: r.email, updatedAt: now() }; // email immutable
      return updated;
    });
    persist(next);
    return Promise.resolve(updated);
  },

  delete(id) {
    persist(getAll().filter((r) => r.id !== id));
    return Promise.resolve();
  },

  getById(id) {
    return Promise.resolve(getAll().find((r) => r.id === id) ?? null);
  },

  emailExists(email, excludeId = null) {
    const match = getAll().find(
      (r) => r.email?.toLowerCase() === email?.toLowerCase() && r.id !== excludeId,
    );
    return Promise.resolve(!!match);
  },

  regNumExists(regNum, excludeId = null) {
    const match = getAll().find(
      (r) => r.registrationNumber?.toLowerCase() === regNum?.toLowerCase() && r.id !== excludeId,
    );
    return Promise.resolve(!!match);
  },

  checkDependencies(id) {
    for (const k of ['edc_studies', 'edc_contracts']) {
      try {
        const raw = localStorage.getItem(k);
        if (raw && JSON.parse(raw).some((r) => r.sponsorId === id)) {
          return Promise.resolve(true);
        }
      } catch { /* ignore */ }
    }
    return Promise.resolve(false);
  },
};
