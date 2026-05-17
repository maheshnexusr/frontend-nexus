/**
 * sponsorEmailTriggersClient — Email notification trigger configuration.
 *
 * Base: /api/v1/sponsor/workspace/email-triggers (non-spec extension — not in
 * spec §13). Sponsor Bearer + (study_id, environment) auto-attached.
 *
 * A "trigger" maps a system event (e.g. QUERY_RAISED) to an email template
 * and a set of recipient roles. Backend fires the email automatically when
 * the event occurs.
 */

import sponsorAxiosClient from '@/api/sponsorAxiosClient';

const BASE      = '/api/v1/sponsor/workspace/email-triggers';
const TEMPLATES = '/api/v1/sponsor/workspace/masters/email-templates';

function normalize(raw) {
  return {
    id:            raw.trigger_id    ?? raw.id,
    eventCode:     raw.event_code    ?? raw.eventCode,
    eventLabel:    raw.event_label   ?? raw.eventLabel,
    module:        raw.module        ?? '',
    templateId:    raw.template_id   ?? raw.templateId   ?? null,
    templateName:  raw.template_name ?? raw.templateName ?? null,
    templateCode:  raw.template_code ?? raw.templateCode ?? null,
    recipients:    raw.recipients    ?? [],
    status:        raw.status        ?? 'Active',
    description:   raw.description   ?? '',
    updatedAt:     raw.updated_at    ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  return arr.map(normalize);
}

export const sponsorEmailTriggersClient = {
  async list(_studyId) {
    try {
      const res = await sponsorAxiosClient.get(BASE);
      return extractList(res);
    } catch {
      return [];
    }
  },

  async update(_studyId, eventCode, payload) {
    const res = await sponsorAxiosClient.put(`${BASE}/${eventCode}`, payload);
    return normalize(res?.item ?? res);
  },

  async toggleStatus(_studyId, eventCode, status) {
    const res = await sponsorAxiosClient.patch(`${BASE}/${eventCode}/status`, { status });
    return normalize(res?.item ?? res);
  },

  /** Active email templates for the template selector — spec §4.7. */
  async listTemplates(_studyId) {
    try {
      const res = await sponsorAxiosClient.get(TEMPLATES, {
        params: { status: 'Active', limit: 200 },
      });
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      return arr.map((t) => ({
        id:   t.template_id   ?? t.id,
        name: t.template_name ?? t.name ?? '',
        code: t.template_code ?? t.code ?? '',
      }));
    } catch {
      return [];
    }
  },
};
