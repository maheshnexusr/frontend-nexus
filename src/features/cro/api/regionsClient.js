/**
 * regionsClient — localStorage CRUD for Regions.
 * Seeds with standard geographical regions on first load.
 */

const KEY = 'edc_regions';

const SEED_REGIONS = [
  {
    regionName:  'North America',
    description: 'United States, Canada, Mexico',
  },
  {
    regionName:  'Latin America',
    description: 'Central and South American countries including Brazil, Argentina, Colombia, Chile, and others',
  },
  {
    regionName:  'Europe',
    description: 'European Union member states and other European countries including United Kingdom, Switzerland, Norway',
  },
  {
    regionName:  'Asia-Pacific',
    description: 'East Asia, Southeast Asia, Australia, New Zealand including China, Japan, South Korea, Singapore, Australia',
  },
  {
    regionName:  'Middle East & Africa',
    description: 'Middle Eastern and African countries including Saudi Arabia, UAE, South Africa, Nigeria, Kenya',
  },
  {
    regionName:  'South Asia',
    description: 'India, Pakistan, Bangladesh, Sri Lanka, Nepal, Bhutan, and Maldives',
  },
  {
    regionName:  'Global',
    description: 'Worldwide coverage — used for studies operating across all regions',
  },
];

function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid() { return `rg-${++_counter}`; }

function getAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  const seeded = SEED_REGIONS.map((r, i) => ({
    id:          `rg-seed-${i + 1}`,
    regionName:  r.regionName,
    description: r.description,
    status:      'Active',
    createdBy:   'System',
    createdAt:   now(),
    updatedAt:   now(),
  }));
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const regionsClient = {
  list() {
    return Promise.resolve(getAll());
  },

  create(data) {
    const all    = getAll();
    const record = {
      id:          uid(),
      regionName:  data.regionName.trim(),
      description: (data.description ?? '').trim(),
      status:      data.status ?? 'Active',
      createdBy:   'Admin',
      createdAt:   now(),
      updatedAt:   now(),
    };
    persist([...all, record]);
    return Promise.resolve(record);
  },

  update(id, data) {
    const all = getAll();
    let updated;
    const next = all.map((r) => {
      if (r.id !== id) return r;
      updated = {
        ...r,
        regionName:  data.regionName.trim(),
        description: (data.description ?? '').trim(),
        status:      data.status,
        updatedAt:   now(),
      };
      return updated;
    });
    persist(next);
    return Promise.resolve(updated);
  },

  delete(id) {
    persist(getAll().filter((r) => r.id !== id));
    return Promise.resolve();
  },

  nameExists(name, excludeId = null) {
    const match = getAll().find(
      (r) => r.regionName.toLowerCase() === name.trim().toLowerCase() && r.id !== excludeId,
    );
    return Promise.resolve(!!match);
  },

  /** Dependency check — inspects studies, countries, sites, sponsors for references. */
  checkDependencies(id) {
    const storageKeys = ['edc_studies', 'edc_countries', 'edc_sites', 'edc_sponsors'];
    for (const k of storageKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const records = JSON.parse(raw);
          if (records.some((r) => r.regionId === id || r.region === id)) {
            return Promise.resolve(true);
          }
        }
      } catch { /* ignore */ }
    }
    return Promise.resolve(false);
  },
};
