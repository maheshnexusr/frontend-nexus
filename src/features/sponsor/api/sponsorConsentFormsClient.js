/**
 * sponsorConsentFormsClient — multiple consent forms per study (Consent Builder).
 *
 *   GET    /consent/templates              — list (Consent Code, Title, Roles, Status)
 *   GET    /consent/templates/:id          — one form incl. form_structure content
 *   POST   /consent/templates              — create (auto Consent Code) → { templateId, consentCode }
 *   PATCH  /consent/templates/:id          — update title / assigned roles / body
 *   DELETE /consent/templates/:id          — delete
 *   POST   /consent/templates/:id/publish  — publish (Draft → Published)
 *
 * Each consent form carries: consent_code (CNSNT-001…), template_name (Title),
 * assigned_role_ids (Site Roles it applies to; empty = all roles), and a
 * form_structure body ({ blocks, submissionControls }) authored with the study
 * form-builder primitives. Sponsor-scoped (the builder is a sponsor/CRO masters
 * feature); the axios client attaches study_id + environment.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import { normalizeConsentContent } from '@/utils/consentContent';

const BASE = '/api/v1/sponsor/workspace/consent/templates';

function normalizeForm(raw = {}) {
  return {
    templateId:      raw.template_id   ?? raw.templateId   ?? '',
    consentCode:     raw.consent_code  ?? raw.consentCode  ?? '',
    title:           raw.template_name ?? raw.templateName ?? '',
    version:         raw.version       ?? '',
    status:          raw.status        ?? 'Draft',
    language:        raw.language      ?? 'English',
    assignedRoleIds: raw.assigned_role_ids ?? raw.assignedRoleIds ?? [],
    updatedAt:       raw.updated_at    ?? raw.updatedAt    ?? '',
  };
}

export const sponsorConsentFormsClient = {
  /** GET list — optional { status, search }. */
  async list(params = {}) {
    const res = await sponsorAxiosClient.get(BASE, { params });
    const arr = Array.isArray(res) ? res : (res?.templates ?? res?.items ?? res?.data ?? []);
    return arr.map(normalizeForm);
  },

  /** GET one — content deep-camelled so the builder reads field appearance/layout. */
  async get(templateId) {
    const res = await sponsorAxiosClient.get(`${BASE}/${templateId}`);
    const t = res?.template ?? res ?? {};
    return { ...normalizeForm(t), content: normalizeConsentContent(t.content) };
  },

  /** POST create → { templateId, consentCode }. */
  async create({ title, assignedRoleIds = [], content = {} }) {
    const res = await sponsorAxiosClient.post(BASE, {
      template_name:     title,
      assigned_role_ids: assignedRoleIds,
      content,
    });
    return { templateId: res?.templateId ?? res?.template_id ?? '', consentCode: res?.consentCode ?? res?.consent_code ?? '' };
  },

  /** PATCH update — only sends the fields provided. */
  async update(templateId, { title, assignedRoleIds, content } = {}) {
    const body = {};
    if (title          !== undefined) body.template_name     = title;
    if (assignedRoleIds !== undefined) body.assigned_role_ids = assignedRoleIds;
    if (content        !== undefined) body.content           = content;
    return sponsorAxiosClient.patch(`${BASE}/${templateId}`, body);
  },

  /** POST duplicate → { templateId, consentCode }. Copies the full design into a
   *  new Draft consent; optional { title, assignedRoleIds } override. */
  async duplicate(templateId, { title, assignedRoleIds } = {}) {
    const body = {};
    if (title          !== undefined) body.template_name     = title;
    if (assignedRoleIds !== undefined) body.assigned_role_ids = assignedRoleIds;
    const res = await sponsorAxiosClient.post(`${BASE}/${templateId}/duplicate`, body);
    return { templateId: res?.templateId ?? res?.template_id ?? '', consentCode: res?.consentCode ?? res?.consent_code ?? '' };
  },

  async remove(templateId) {
    return sponsorAxiosClient.delete(`${BASE}/${templateId}`);
  },

  async publish(templateId) {
    return sponsorAxiosClient.post(`${BASE}/${templateId}/publish`, {});
  },
};

export default sponsorConsentFormsClient;
