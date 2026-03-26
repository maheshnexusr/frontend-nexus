/**
 * studyPhasesClient — localStorage CRUD for Study Phases.
 * Seeds with standard clinical trial phases on first load.
 */

const KEY = 'edc_study_phases';

const SEED_PHASES = [
  'Phase I', 'Phase II', 'Phase III', 'Phase IV',
  'Phase I/II', 'Phase II/III',
  'Pilot Study', 'Feasibility Study', 'Observational Study', 'Expanded Access',
];

function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid() { return `sp-${++_counter}`; }

function getAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  // First load — seed default phases
  const seeded = SEED_PHASES.map((name, i) => ({
    id:        `sp-seed-${i + 1}`,
    phaseName: name,
    status:    'Active',
    createdBy: 'System',
    createdAt: now(),
    updatedAt: now(),
  }));
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const studyPhasesClient = {
  list() {
    return Promise.resolve(getAll());
  },

  create(data) {
    const all    = getAll();
    const record = { id: uid(), ...data, phaseName: data.phaseName.trim(), createdBy: 'Admin', createdAt: now(), updatedAt: now() };
    persist([...all, record]);
    return Promise.resolve(record);
  },

  update(id, data) {
    const all = getAll();
    let updated;
    const next = all.map((r) => {
      if (r.id !== id) return r;
      updated = { ...r, ...data, phaseName: data.phaseName.trim(), updatedAt: now() };
      return updated;
    });
    persist(next);
    return Promise.resolve(updated);
  },

  delete(id) {
    persist(getAll().filter((r) => r.id !== id));
    return Promise.resolve();
  },

  /** Returns true if any other phase already uses this name. */
  nameExists(name, excludeId = null) {
    const match = getAll().find(
      (r) => r.phaseName.toLowerCase() === name.trim().toLowerCase() && r.id !== excludeId,
    );
    return Promise.resolve(!!match);
  },

  /**
   * Dependency check — returns true if any study in localStorage references
   * this phase (by id). In production this would be a backend call.
   */
  checkDependencies(id) {
    try {
      const raw = localStorage.getItem('edc_studies');
      if (raw) {
        const studies = JSON.parse(raw);
        const linked  = studies.some((s) => s.studyPhaseId === id || s.phase === id);
        return Promise.resolve(linked);
      }
    } catch { /* ignore */ }
    return Promise.resolve(false);
  },
};
