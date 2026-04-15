/**
 * sponsorsClient — real API client for Sponsors.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:                 raw.sponsor_id          ?? raw.id,
    photograph:         raw.photograph_path      ?? raw.photograph ?? null,
    fullName:           raw.full_name            ?? raw.fullName   ?? '',
    contactNumber:      raw.contact_number       ?? raw.contactNumber ?? '',
    email:              raw.email_address        ?? raw.email ?? '',
    organizationName:   raw.organization_name    ?? raw.organizationName ?? '',
    website:            raw.website              ?? '',
    registrationNumber: raw.registration_number  ?? raw.registrationNumber ?? '',
    addressLine1:       raw.address_line1        ?? raw.addressLine1 ?? '',
    addressLine2:       raw.address_line2        ?? raw.addressLine2 ?? '',
    city:               raw.city                 ?? '',
    district:           raw.district             ?? '',
    state:              raw.state                ?? '',
    zipcode:            raw.postal_code          ?? raw.zipcode ?? '',
    countryId:          raw.country_id           ?? raw.countryId ?? '',
    countryName:        raw.country_name         ?? raw.countryName ?? '',
    status:             raw.status               ?? 'Active',
    createdAt:          raw.created_at           ?? raw.createdAt,
    updatedAt:          raw.updated_at           ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  return arr.map(normalize);
}

/* ── Request builder (camelCase form → snake_case FormData) ─────────────── */
function toFormData(form) {
  const fd = new FormData();
  const add = (key, val) => { if (val !== undefined && val !== null && val !== '') fd.append(key, val); };

  add('full_name',           form.fullName);
  add('email_address',       form.email);
  add('contact_number',      form.contactNumber);
  add('organization_name',   form.organizationName);
  add('registration_number', form.registrationNumber);
  add('website',             form.website);
  add('address_line1',       form.addressLine1);
  add('address_line2',       form.addressLine2);
  add('country_id',          form.countryId);
  add('city',                form.city);
  add('district',            form.district);
  add('state',               form.state);
  add('postal_code',         form.zipcode);
  add('status',              form.status);

  if (form.photograph) {
    if (form.photograph instanceof File || form.photograph instanceof Blob) {
      fd.append('photograph', form.photograph);
    } else if (typeof form.photograph === 'string' && form.photograph.startsWith('data:')) {
      const [meta, b64] = form.photograph.split(',');
      const mime = meta.match(/:(.*?);/)[1];
      const bin  = atob(b64);
      const buf  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      fd.append('photograph', new Blob([buf], { type: mime }), 'photo.jpg');
    }
  }

  return fd;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const sponsorsClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/sponsors');
    return extractList(res);
  },

  async getById(id) {
    const res = await axiosClient.get(`/api/v1/sponsors/${id}`);
    return normalize(res?.item ?? res);
  },

  async create(form) {
    const res = await axiosClient.post('/api/v1/sponsors', toFormData(form), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalize(res?.item ?? res);
  },

  async update(id, form) {
    const res = await axiosClient.put(`/api/v1/sponsors/${id}`, toFormData(form), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/sponsors/${id}`);
  },

  // Validation stubs — backend validates on conflict (409)
  emailExists:       () => Promise.resolve(false),
  regNumExists:      () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};

export async function exportSponsorsCSV() {
  const res      = await axiosClient.get('/api/v1/sponsors/export', { responseType: 'blob' });
  const blob     = res instanceof Blob ? res : new Blob([res], { type: 'text/csv' });
  const d        = new Date();
  const filename = `Sponsors_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.csv`;
  triggerDownload(blob, filename);
  return filename;
}

export function buildExportFilename() { return 'sponsors.csv'; }
