/**
 * studiesClient — localStorage CRUD for Studies + Releases.
 * Keys:
 *   edc_studies          — study master records
 *   edc_study_releases   — version/publish records per study
 */

const KEY          = 'edc_studies';
const RELEASES_KEY = 'edc_study_releases';

function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid(prefix = 'study') { return `${prefix}-${++_counter}`; }

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

function getAllReleases() {
  try {
    const raw = localStorage.getItem(RELEASES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  localStorage.setItem(RELEASES_KEY, JSON.stringify([]));
  return [];
}

function persistReleases(data) {
  localStorage.setItem(RELEASES_KEY, JSON.stringify(data));
}

/** Auto-increment version based on existing releases for a study protocol ID. */
function nextVersion(studyProtocolId) {
  const existing = getAllReleases()
    .filter((r) => r.studyProtocolId === studyProtocolId)
    .map((r) => r.version)
    .filter(Boolean);

  if (existing.length === 0) return 'v1.0';

  const nums = existing
    .map((v) => v.replace(/^v/, '').split('.').map(Number))
    .filter((p) => p.length === 2 && !p.some(isNaN));

  if (nums.length === 0) return 'v1.0';

  nums.sort((a, b) => a[0] !== b[0] ? b[0] - a[0] : b[1] - a[1]);
  const [major, minor] = nums[0];
  return `v${major}.${minor + 1}`;
}

/** Build database name per environment. */
function buildDbName(studyId, env) {
  const safe = studyId.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return env === 'UAT' ? `UAT_${safe}` : safe;
}

/** Build access link. */
function buildAccessLink(studyId, env) {
  const base = 'https://app.edcplatform.io/study';
  return `${base}/${studyId.toLowerCase()}/${env.toLowerCase()}`;
}

export const studiesClient = {
  list() {
    return Promise.resolve(getAll());
  },

  getById(id) {
    return Promise.resolve(getAll().find((r) => r.id === id) ?? null);
  },

  create(data) {
    const all    = getAll();
    const record = {
      id:        uid(),
      ...data,
      status:    data.status ?? 'Draft',
      createdBy: 'Admin',
      createdAt: now(),
      updatedAt: now(),
    };
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
    return Promise.resolve(updated);
  },

  delete(id) {
    persist(getAll().filter((r) => r.id !== id));
    // also remove all releases for this study
    persistReleases(getAllReleases().filter((r) => r.studyId !== id));
    return Promise.resolve();
  },

  /** Returns true if a study with this studyId / protocol number already exists. */
  studyIdExists(studyId, excludeId = null) {
    const match = getAll().find(
      (r) => r.studyId?.toLowerCase() === studyId?.trim().toLowerCase() && r.id !== excludeId,
    );
    return Promise.resolve(!!match);
  },

  // ── Publish ──────────────────────────────────────────────────────────────
  /**
   * publish(wizardData, publishConfig) — Creates or updates the study record,
   * then creates a versioned release entry.
   *
   * @param {object} wizardData   — merged step1–step5 data
   * @param {object} publishConfig — { environment, status, description }
   * @returns {Promise<{ study, release }>}
   */
  publish(wizardData, publishConfig) {
    const { environment, status, description } = publishConfig;
    const studyProtocolId = wizardData.studyId; // from step 1

    // 1. Upsert the study master record
    const all    = getAll();
    const exists = all.find((r) => r.studyId === studyProtocolId);

    let study;
    if (exists) {
      study = { ...exists, ...wizardData, status, updatedAt: now() };
      persist(all.map((r) => r.id === exists.id ? study : r));
    } else {
      study = {
        id:            uid(),
        ...wizardData,
        status,
        createdBy:     'Admin',
        createdAt:     now(),
        updatedAt:     now(),
      };
      persist([...all, study]);
    }

    // 2. Create release record
    const version    = nextVersion(studyProtocolId);
    const dbName     = buildDbName(studyProtocolId, environment);
    const accessLink = buildAccessLink(studyProtocolId, environment);
    const tablePrefix = environment === 'UAT' ? 'usp_' : 'sp_';

    const release = {
      id:              uid('rel'),
      studyId:         study.id,
      studyProtocolId,
      version,
      environment,
      status,
      description:     description ?? '',
      databaseName:    dbName,
      tablePrefix,
      accessLink,
      invitationLink:  `${accessLink}/invite`,
      publishedBy:     'Admin',
      publishedAt:     now(),
    };

    persistReleases([...getAllReleases(), release]);

    return Promise.resolve({ study, release });
  },

  // ── Releases ─────────────────────────────────────────────────────────────
  getReleasesByProtocolId(studyProtocolId) {
    return Promise.resolve(
      getAllReleases()
        .filter((r) => r.studyProtocolId === studyProtocolId)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
    );
  },

  getReleasesByStudyId(studyId) {
    return Promise.resolve(
      getAllReleases()
        .filter((r) => r.studyId === studyId)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
    );
  },

  updateReleaseStatus(releaseId, status) {
    const all  = getAllReleases();
    const next = all.map((r) => r.id === releaseId ? { ...r, status } : r);
    persistReleases(next);
    return Promise.resolve(next.find((r) => r.id === releaseId));
  },
};
