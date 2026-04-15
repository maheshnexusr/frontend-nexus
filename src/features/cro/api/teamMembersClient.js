/**
 * teamMembersClient — real API client for CRO Team Members.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:             raw.team_member_id  ?? raw.id,
    userId:         raw.user_id         ?? raw.userId,
    fullName:       raw.full_name       ?? raw.fullName ?? '',
    email:          raw.email_address   ?? raw.email ?? '',
    roleId:         raw.role_id         ?? raw.roleId ?? '',
    roleName:       raw.role_name       ?? raw.roleName ?? '',
    photograph:     raw.photograph_path ?? raw.photograph ?? null,
    contactNumber:  raw.contact_number  ?? raw.contactNumber ?? '',
    isActive:       raw.is_active       ?? true,
    assignedStudies: raw.assigned_studies ?? raw.assignedStudies ?? [],
    studyIds:       raw.study_ids       ?? raw.studyIds ?? [],
    createdAt:      raw.created_at      ?? raw.createdAt,
    updatedAt:      raw.updated_at      ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  return arr.map(normalize);
}

/* ── Request builder ─────────────────────────────────────────────────────── */
function toFormData(form) {
  const fd  = new FormData();
  const add = (key, val) => { if (val !== undefined && val !== null && val !== '') fd.append(key, val); };

  add('full_name',      form.fullName);
  add('email_address',  form.email ?? form.emailAddress);
  add('role_id',        form.roleId);
  add('contact_number', form.contactNumber);

  if (Array.isArray(form.studyIds)) {
    form.studyIds.forEach((id) => fd.append('study_ids[]', id));
  }
  if (Array.isArray(form.assignedStudies)) {
    form.assignedStudies.forEach((s) => fd.append('study_ids[]', s.studyId ?? s));
  }

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
export const teamMembersClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/team-members');
    return extractList(res);
  },

  async getById(id) {
    const res = await axiosClient.get(`/api/v1/team-members/${id}`);
    return normalize(res?.item ?? res);
  },

  async create(form) {
    const res = await axiosClient.post('/api/v1/team-members', toFormData(form), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalize(res?.item ?? res);
  },

  async update(id, form) {
    const res = await axiosClient.put(`/api/v1/team-members/${id}`, toFormData(form), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/team-members/${id}`);
  },

  // Validation stub — backend enforces email uniqueness (409)
  emailExists: () => Promise.resolve(false),
};

export async function exportTeamMembersCSV() {
  const res      = await axiosClient.get('/api/v1/team-members/export', { responseType: 'blob' });
  const blob     = res instanceof Blob ? res : new Blob([res], { type: 'text/csv' });
  const d        = new Date();
  const filename = `Team_Members_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.csv`;
  triggerDownload(blob, filename);
  return filename;
}
