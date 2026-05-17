/**
 * sponsorCountriesClient — Sponsor study-scoped country master.
 *
 * Spec §13.7 — /api/v1/sponsor/workspace/masters/countries
 * Sponsor Bearer + (study_id, environment) auto-attached.
 *
 * Spec body: `{ country_name, iso_code?, status? }`. We send `iso_code` when
 * the UI provides `countryCode` for compatibility, and also pass through
 * `dialing_code` + `description` which are UI-only (backend may ignore).
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE = '/api/v1/sponsor/workspace/masters/countries';

function normalize(raw) {
  // The backend has used several ID names across iterations; pick whichever
  // is present so the dropdown's `value` is never undefined (which silently
  // drops country_id from the Locations create payload).
  const id =
    raw.country_id ?? raw.countryId ?? raw.id ?? raw._id ?? raw.uuid ?? raw.uuId ?? '';
  if (!id) {
    // eslint-disable-next-line no-console
    console.warn('[sponsorCountriesClient] country row missing id; received keys:', Object.keys(raw ?? {}));
  }
  return {
    id,
    countryName: raw.country_name ?? raw.countryName ?? raw.name ?? '',
    countryCode: raw.iso_code     ?? raw.country_code ?? raw.countryCode ?? '',
    isoCode:     raw.iso_code     ?? raw.isoCode      ?? '',
    dialingCode: raw.dialing_code ?? raw.dialingCode  ?? '',
    description: raw.description  ?? '',
    status:      raw.status       ?? 'Active',
    createdAt:   raw.created_at   ?? raw.createdAt,
    updatedAt:   raw.updated_at   ?? raw.updatedAt,
  };
}

function extractList(res) {
  // Handle every wrapping shape the backend has used:
  //   [...]                                                                ← array body
  //   { items: [...] }                                                     ← spec §0
  //   { success, items: [...] } / { success, data: [...] }                 ← envelope
  //   { countries: [...] }                                                 ← domain key
  //   { data: { items: [...] | countries: [...] } }                        ← double-wrapped
  let arr =
       (Array.isArray(res)              ? res
      : Array.isArray(res?.items)       ? res.items
      : Array.isArray(res?.data)        ? res.data
      : Array.isArray(res?.countries)   ? res.countries
      : Array.isArray(res?.data?.items) ? res.data.items
      : Array.isArray(res?.data?.countries) ? res.data.countries
      : []);
  if (!Array.isArray(arr)) arr = [];
  if (arr.length === 0 && res && typeof res === 'object' && Object.keys(res).length > 0) {
    // Help the developer if a new wrapping shape is encountered.
    // eslint-disable-next-line no-console
    console.warn('[sponsorCountriesClient] empty extractList from response:', res);
  }
  return arr.map(normalize);
}

export const sponsorCountriesClient = {
  async list(_studyId) {
    const res = await sponsorAxiosClient.get(BASE);
    return extractList(res);
  },

  async getById(_studyId, id) {
    const res = await sponsorAxiosClient.get(`${BASE}/${id}`);
    return normalize(res?.item ?? res);
  },

  async create(_studyId, form) {
    const res = await sponsorAxiosClient.post(BASE, {
      country_name: form.countryName,
      iso_code:     form.isoCode ?? form.countryCode,
      dialing_code: form.dialingCode || undefined,
      description:  form.description || undefined,
      status:       form.status ?? 'Active',
    });
    return normalize(res?.item ?? res?.country ?? res?.data ?? res ?? {});
  },

  async update(_studyId, id, form) {
    const res = await sponsorAxiosClient.put(`${BASE}/${id}`, {
      country_name: form.countryName,
      iso_code:     form.isoCode ?? form.countryCode,
      dialing_code: form.dialingCode || undefined,
      description:  form.description || undefined,
      status:       form.status,
    });
    return normalize(res?.item ?? res?.country ?? res?.data ?? res ?? {});
  },

  async delete(_studyId, id) {
    return sponsorAxiosClient.delete(`${BASE}/${id}`);
  },

  nameExists:        () => Promise.resolve(false),
  codeExists:        () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
