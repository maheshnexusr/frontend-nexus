/**
 * sponsorLocationsClient — Sponsor study-scoped location master.
 *
 * Spec §13.7 — /api/v1/sponsor/workspace/masters/locations
 * Sponsor Bearer + (study_id, environment) auto-attached.
 *
 * Spec body: `{ country_id, state, city, district?, postal_code?, status? }`.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE = '/api/v1/sponsor/workspace/masters/locations';

function normalize(raw) {
  return {
    id:          raw.location_id  ?? raw.id,
    countryId:   raw.country_id   ?? raw.countryId   ?? '',
    countryName: raw.country_name ?? raw.countryName  ?? '',
    state:       raw.state        ?? '',
    district:    raw.district     ?? '',
    city:        raw.city         ?? '',
    postalCode:  raw.postal_code  ?? raw.postalCode   ?? '',
    status:      raw.status       ?? 'Active',
    createdAt:   raw.created_at   ?? raw.createdAt,
    updatedAt:   raw.updated_at   ?? raw.updatedAt,
  };
}

function extractList(res) {
  let arr =
       (Array.isArray(res)              ? res
      : Array.isArray(res?.items)       ? res.items
      : Array.isArray(res?.data)        ? res.data
      : Array.isArray(res?.locations)   ? res.locations
      : Array.isArray(res?.data?.items) ? res.data.items
      : Array.isArray(res?.data?.locations) ? res.data.locations
      : []);
  if (!Array.isArray(arr)) arr = [];
  if (arr.length === 0 && res && typeof res === 'object' && Object.keys(res).length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[sponsorLocationsClient] empty extractList from response:', res);
  }
  return arr.map(normalize);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const sponsorLocationsClient = {
  /** Spec supports `?country_id=` filter (§13.7). */
  async list(_studyId, filters = {}) {
    const params = {};
    if (filters?.countryId) params.country_id = filters.countryId;
    const res = await sponsorAxiosClient.get(BASE, { params });
    return extractList(res);
  },

  async getById(_studyId, id) {
    const res = await sponsorAxiosClient.get(`${BASE}/${id}`);
    return normalize(res?.item ?? res?.location ?? res?.data ?? res ?? {});
  },

  async create(_studyId, form) {
    const res = await sponsorAxiosClient.post(BASE, {
      country_id:  form.countryId,
      state:       form.state,
      city:        form.city,
      district:    form.district  || undefined,
      postal_code: form.postalCode || undefined,
      status:      form.status ?? 'Active',
    });
    return normalize(res?.item ?? res?.location ?? res?.data ?? res ?? {});
  },

  async update(_studyId, id, form) {
    const res = await sponsorAxiosClient.put(`${BASE}/${id}`, {
      country_id:  form.countryId,
      state:       form.state,
      city:        form.city,
      district:    form.district  || undefined,
      postal_code: form.postalCode || undefined,
      status:      form.status,
    });
    return normalize(res?.item ?? res?.location ?? res?.data ?? res ?? {});
  },

  async delete(_studyId, id) {
    return sponsorAxiosClient.delete(`${BASE}/${id}`);
  },

  // ── Non-spec extensions ───────────────────────────────────────────────────
  /**
   * Bulk-import locations from a CSV or XLSX file. Same contract as the CRO
   * master endpoint (see locationsClient.bulkImport) but scoped to the
   * sponsor study workspace. `onProgress` receives upload percentage 0–100.
   */
  async bulkImport(_studyId, file, { onProgress } = {}) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await sponsorAxiosClient.post(`${BASE}/import`, fd, {
      onUploadProgress: (evt) => {
        if (!onProgress || !evt?.total) return;
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    });
    return {
      imported: res?.imported ?? 0,
      skipped:  res?.skipped ?? 0,
      errors:   Array.isArray(res?.errors) ? res.errors : [],
    };
  },

  async exportCSV(_studyId) {
    const res  = await sponsorAxiosClient.get(`${BASE}/export`, { responseType: 'blob' });
    const blob = res instanceof Blob ? res : new Blob([res], { type: 'text/csv' });
    const d    = new Date();
    triggerDownload(blob, `Locations_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.csv`);
  },

  checkDependencies: () => Promise.resolve(false),
};
