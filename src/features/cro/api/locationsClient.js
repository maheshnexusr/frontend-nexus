/**
 * locationsClient — localStorage CRUD for Locations.
 * Each record: { id, countryId, countryName, state, district, city, postalCode, status, createdBy, createdAt, updatedAt }
 */

const KEY = 'edc_locations';

function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid() { return `loc-${++_counter}`; }

function combKey(r) {
  return [
    (r.countryId  ?? '').toLowerCase(),
    (r.state      ?? '').toLowerCase().trim(),
    (r.district   ?? '').toLowerCase().trim(),
    (r.city       ?? '').toLowerCase().trim(),
    (r.postalCode ?? '').toLowerCase().trim(),
  ].join('|');
}

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

export const locationsClient = {
  list() {
    return Promise.resolve(getAll());
  },

  create(data) {
    const all    = getAll();
    const record = {
      id:          uid(),
      countryId:   data.countryId,
      countryName: data.countryName,
      state:       data.state.trim(),
      district:    (data.district ?? '').trim(),
      city:        data.city.trim(),
      postalCode:  data.postalCode.trim(),
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
        countryId:   data.countryId,
        countryName: data.countryName,
        state:       data.state.trim(),
        district:    (data.district ?? '').trim(),
        city:        data.city.trim(),
        postalCode:  data.postalCode.trim(),
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

  /** Returns true if same Country+State+District+City+PostalCode combo exists (excluding excludeId). */
  combinationExists(data, excludeId = null) {
    const key = combKey(data);
    const match = getAll().find(
      (r) => r.id !== excludeId && combKey(r) === key,
    );
    return Promise.resolve(!!match);
  },

  /** Dependency check — inspects sites, sponsors, studies, team members. */
  checkDependencies(id) {
    const storageKeys = ['edc_sites', 'edc_sponsors', 'edc_studies', 'edc_team_members'];
    for (const k of storageKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const records = JSON.parse(raw);
          if (records.some((r) => r.locationId === id || r.location === id)) {
            return Promise.resolve(true);
          }
        }
      } catch { /* ignore */ }
    }
    return Promise.resolve(false);
  },

  /**
   * Bulk import from parsed CSV rows.
   * Each row must have Country (matched by name to edc_countries), State, City, Postal Code.
   */
  bulkImport(rows, countryList) {
    const all      = getAll();
    const combSet  = new Set(all.map(combKey));
    // Build country name → { id, name } map
    const countryMap = Object.fromEntries(
      countryList.map((c) => [c.countryName.toLowerCase(), c]),
    );

    let imported = 0;
    let skipped  = 0;
    const next   = [...all];

    for (const row of rows) {
      const countryName = (row['Country'] ?? row.countryName ?? '').trim();
      const state       = (row['State']   ?? row.state       ?? '').trim();
      const district    = (row['District']?? row.district    ?? '').trim();
      const city        = (row['City']    ?? row.city        ?? '').trim();
      const postalCode  = (row['Postal Code'] ?? row.postalCode ?? '').trim();
      const status      = (row['Status']  ?? row.status ?? 'Active').trim();

      const country = countryMap[countryName.toLowerCase()];
      if (!country || !state || !city || !postalCode) { skipped++; continue; }

      const candidate = { countryId: country.id, state, district, city, postalCode };
      if (combSet.has(combKey(candidate))) { skipped++; continue; }

      const record = {
        id: uid(), countryId: country.id, countryName: country.countryName,
        state, district, city, postalCode, status,
        createdBy: 'Import', createdAt: now(), updatedAt: now(),
      };
      next.push(record);
      combSet.add(combKey(candidate));
      imported++;
    }

    persist(next);
    return Promise.resolve({ imported, skipped });
  },
};
