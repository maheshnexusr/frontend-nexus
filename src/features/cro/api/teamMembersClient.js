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
    // Backend now returns `assigned_studies: [{ study_id, sponsor_permissions, ... }]`.
    // Normalise to the UI shape that TeamMemberNewPage's `assignedStudies`
    // expects: keep `id` as the DB PK (used in payload), `sponsorPermissions`
    // as the matrix tree, and the optional human protocol number under `studyId`.
    assignedStudies: (raw.assigned_studies ?? raw.assignedStudies ?? []).map((a) => ({
      id:                 a.study_id           ?? a.studyId ?? a.id,
      studyId:            a.protocol_number    ?? a.protocolNumber ?? a.studyId ?? '',
      studyTitle:         a.study_title        ?? a.studyTitle ?? '',
      sponsorId:          a.sponsor_id         ?? a.sponsorId ?? '',
      sponsorName:        a.sponsor_name       ?? a.sponsorName ?? '',
      sponsorPermissions: a.sponsor_permissions ?? a.sponsorPermissions ?? {},
    })),
    studyIds:       raw.study_ids       ?? raw.studyIds ?? [],
    createdAt:      raw.created_at      ?? raw.createdAt,
    updatedAt:      raw.updated_at      ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  return arr.map(normalize);
}

/* ── Request builder (camelCase → multipart FormData, spec §8.1) ─────────── */
function toFormData(form) {
  const fd  = new FormData();
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') fd.append(k, v); };

  add('full_name',      form.fullName);
  add('email_address',  form.email ?? form.emailAddress);
  add('contact_number', form.contactNumber);
  add('job_title',      form.jobTitle);
  add('role_id',        form.roleId);
  add('status',         form.status);

  // Per study assignment: the backend now accepts a richer shape
  //   assigned_studies: [{ study_id, sponsor_permissions }]
  // which is the canonical `cro_studies.study_id` (DB primary key — NOT
  // the human protocol_number). The legacy `study_ids: [...]` form is
  // still sent in parallel for any older endpoints that only read that.
  //
  // IMPORTANT: `s.id` is the DB PK. `s.studyId` would be the protocol
  // number — sending that returns "Unknown studyIds: PROTO-…".
  const idOf = (s) => (s && (s.id ?? s.studyDbId ?? s));
  const assignedStudies = Array.isArray(form.assignedStudies)
    ? form.assignedStudies
        .map((s) => ({
          study_id:            idOf(s),
          sponsor_permissions: s?.sponsorPermissions ?? {},
        }))
        .filter((x) => !!x.study_id)
    : [];

  // Legacy flat id list — kept for backwards compat.
  const studyIds = [
    ...(Array.isArray(form.studyIds) ? form.studyIds : []),
    ...assignedStudies.map((x) => x.study_id),
  ];

  if (assignedStudies.length) fd.append('assigned_studies', JSON.stringify(assignedStudies));
  if (studyIds.length)        fd.append('study_ids',        JSON.stringify(studyIds));

  // photograph may be a File/Blob or a data URL from the avatar picker.
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
    const res = await axiosClient.post('/api/v1/team-members', toFormData(form));
    return normalize(res?.item ?? res);
  },

  async update(id, form) {
    const res = await axiosClient.put(`/api/v1/team-members/${id}`, toFormData(form));
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
