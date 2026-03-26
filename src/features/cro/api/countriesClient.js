/**
 * countriesClient — localStorage CRUD for Countries.
 * Seeds with all UN member states + commonly used territories on first load.
 */

const KEY = 'edc_countries';

// ── Seed data — all UN member states + key territories ────────────────────
const SEED_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo (Brazzaville)','Congo (Kinshasa)','Costa Rica','Croatia','Cuba',
  'Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia',
  'Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau',
  'Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran',
  'Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan',
  'Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar',
  'Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania',
  'Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro',
  'Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia',
  'Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea',
  'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
  'Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Solomon Islands','Somalia','South Africa',
  'South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden',
  'Switzerland','Syria','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo',
  'Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam',
  'Yemen','Zambia','Zimbabwe',
  // Commonly used territories
  'Hong Kong','Macau','Taiwan','Puerto Rico','Guam','Bermuda',
  'Cayman Islands','British Virgin Islands','Gibraltar','Kosovo',
];

function now() { return new Date().toISOString(); }

let _counter = Date.now();
function uid() { return `cn-${++_counter}`; }

function getAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  const seeded = SEED_COUNTRIES.map((name, i) => ({
    id:          `cn-seed-${i + 1}`,
    countryName: name,
    description: '',
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

export const countriesClient = {
  list() {
    return Promise.resolve(getAll());
  },

  create(data) {
    const all    = getAll();
    const record = {
      id:          uid(),
      countryName: data.countryName.trim(),
      description: data.description ?? '',
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
      updated = { ...r, countryName: data.countryName.trim(), description: data.description ?? '', status: data.status, updatedAt: now() };
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
      (r) => r.countryName.toLowerCase() === name.trim().toLowerCase() && r.id !== excludeId,
    );
    return Promise.resolve(!!match);
  },

  /**
   * Dependency check — inspects edc_sponsors, edc_studies, edc_locations
   * for any record referencing this country by id.
   */
  checkDependencies(id) {
    const keys = ['edc_sponsors', 'edc_studies', 'edc_locations', 'edc_study_regions'];
    const fields = ['countryId', 'country', 'countryId', 'countryId'];
    for (let i = 0; i < keys.length; i++) {
      try {
        const raw = localStorage.getItem(keys[i]);
        if (raw) {
          const records = JSON.parse(raw);
          if (records.some((r) => r[fields[i]] === id || r.country === id)) {
            return Promise.resolve(true);
          }
        }
      } catch { /* ignore */ }
    }
    return Promise.resolve(false);
  },

  /** Bulk import — accepts array of { countryName, status?, description? } */
  bulkImport(rows) {
    const all    = getAll();
    const existing = new Set(all.map((r) => r.countryName.toLowerCase()));
    let imported = 0;
    let skipped  = 0;
    const next   = [...all];

    for (const row of rows) {
      const name = (row.countryName || row['Country Name'] || '').trim();
      if (!name || existing.has(name.toLowerCase())) { skipped++; continue; }
      next.push({
        id:          uid(),
        countryName: name,
        description: (row.description || row['Description'] || '').trim(),
        status:      (row.status || row['Status'] || 'Active').trim(),
        createdBy:   'Import',
        createdAt:   now(),
        updatedAt:   now(),
      });
      existing.add(name.toLowerCase());
      imported++;
    }

    persist(next);
    return Promise.resolve({ imported, skipped });
  },
};
