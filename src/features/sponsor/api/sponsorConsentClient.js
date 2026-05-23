/**
 * sponsorConsentClient — Sponsor study-scoped consent builder.
 *
 * Spec §13.4 — /api/v1/sponsor/workspace/consent/templates
 * This client predates the spec's template/workflow model and is keyed by
 * role (role-scoped config) rather than templateId. For now we route to the
 * correct workspace base; the role-scoped endpoints (`/consent/:roleId`,
 * `/consent/:roleId/documents`) are non-spec extensions preserved for the
 * existing config UI.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE      = '/api/v1/sponsor/workspace/consent';
const WORKSPACE = '/api/v1/sponsor/workspace';

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeParagraph(raw) {
  return {
    id:           raw.id             ?? raw.paragraph_id  ?? crypto.randomUUID(),
    sectionTitle: raw.section_title  ?? raw.sectionTitle  ?? '',
    content:      raw.content        ?? '',
    displayOrder: raw.display_order  ?? raw.displayOrder  ?? 1,
    isMandatory:  raw.is_mandatory   ?? raw.isMandatory   ?? false,
  };
}

function normalizeConfig(raw) {
  return {
    id:         raw.id         ?? null,
    roleId:     raw.role_id    ?? raw.roleId    ?? '',
    roleName:   raw.role_name  ?? raw.roleName  ?? '',
    version:    raw.version    ?? 1,
    paragraphs: (raw.paragraphs ?? []).map(normalizeParagraph),
    fields:     raw.fields     ?? [],
    workflow:   raw.workflow   ?? null,
    documents:  (raw.documents ?? []).map((d) => ({
      id:   d.id       ?? d.doc_id      ?? crypto.randomUUID(),
      name: d.name     ?? d.file_name   ?? '',
      size: d.size     ?? d.file_size   ?? 0,
      url:  d.url      ?? d.file_url    ?? '',
    })),
    updatedAt:  raw.updated_at ?? raw.updatedAt ?? null,
  };
}

// ── Client ─────────────────────────────────────────────────────────────────────

export const sponsorConsentClient = {
  /** Fetch site roles for the study (spec §13.2). */
  async getRoles(_studyId) {
    const res = await sponsorAxiosClient.get(`${WORKSPACE}/lookups/site-roles`);
    const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
    return arr.map((r) => ({
      id:   r.id        ?? r.role_id  ?? r.roleId,
      name: r.name      ?? r.role_name ?? r.roleName ?? '',
    }));
  },

  /** Fetch saved consent config for a role — non-spec role-scoped variant. */
  async getConfig(_studyId, roleId) {
    const res = await sponsorAxiosClient.get(`${BASE}/${roleId}`);
    return normalizeConfig(res?.item ?? res ?? {});
  },

  /** Persist full consent config for a role — non-spec role-scoped variant. */
  async saveConfig(_studyId, roleId, config) {
    const res = await sponsorAxiosClient.put(`${BASE}/${roleId}`, config);
    return normalizeConfig(res?.item ?? res ?? {});
  },

  /** Upload a supporting document. */
  async uploadDocument(_studyId, roleId, file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await sponsorAxiosClient.post(`${BASE}/${roleId}/documents`, fd);
    const d = res?.item ?? res ?? {};
    return {
      id:   d.id       ?? d.doc_id    ?? crypto.randomUUID(),
      name: d.name     ?? file.name,
      size: d.size     ?? file.size,
      url:  d.url      ?? d.file_url  ?? '',
    };
  },

  /** Delete a supporting document. */
  async deleteDocument(_studyId, roleId, docId) {
    return sponsorAxiosClient.delete(`${BASE}/${roleId}/documents/${docId}`);
  },
};
