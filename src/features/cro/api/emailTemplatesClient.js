/**
 * emailTemplatesClient — real API client for Email Templates.
 * Normalizes snake_case API ↔ camelCase UI.
 */

import axiosClient from '@/api/axiosClient';

/* ── Response normalizer ─────────────────────────────────────────────────── */
function normalize(raw) {
  return {
    id:             raw.template_id      ?? raw.id,
    templateName:   raw.template_name    ?? raw.templateName ?? '',
    templateCode:   raw.template_code    ?? raw.templateCode ?? '',
    category:       raw.category         ?? '',
    description:    raw.description      ?? '',
    subjectLine:    raw.subject_line     ?? raw.subjectLine ?? '',
    emailBody:      raw.email_body       ?? raw.emailBody ?? '',
    fromName:       raw.from_name        ?? raw.fromName ?? '',
    fromEmail:      raw.from_email       ?? raw.fromEmail ?? '',
    ccEmails:       raw.cc_emails        ?? raw.ccEmails ?? [],
    bccEmails:      raw.bcc_emails       ?? raw.bccEmails ?? [],
    templateType:   raw.template_type    ?? raw.templateType ?? 'Custom',
    status:         raw.status           ?? 'Active',
    isSystem:       raw.is_system_template ?? raw.isSystem ?? false,
    attachments:    raw.attachments      ?? [],
    createdAt:      raw.created_at       ?? raw.createdAt,
    updatedAt:      raw.updated_at       ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  return arr.map(normalize);
}

/* ── Request serializer (camelCase → snake_case) ─────────────────────────── */
function serialize(data) {
  return {
    template_name:  data.templateName,
    template_code:  data.templateCode,
    subject_line:   data.subjectLine,
    email_body:     data.emailBody,
    from_email:     data.fromEmail     || undefined,
    from_name:      data.fromName      || undefined,
    cc_emails:      data.ccEmails      || undefined,
    bcc_emails:     data.bccEmails     || undefined,
    category:       data.category      || undefined,
    description:    data.description   || undefined,
    template_type:  data.templateType  || undefined,
    status:         data.status        || undefined,
  };
}

/* ── Client ──────────────────────────────────────────────────────────────── */
export const emailTemplatesClient = {
  async list() {
    const res = await axiosClient.get('/api/v1/masters/email-templates');
    return extractList(res);
  },

  async getById(id) {
    const res = await axiosClient.get(`/api/v1/masters/email-templates/${id}`);
    return normalize(res?.item ?? res);
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/masters/email-templates', serialize(data));
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/masters/email-templates/${id}`, serialize(data));
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/masters/email-templates/${id}`);
  },

  async duplicate(id) {
    const res = await axiosClient.post(`/api/v1/masters/email-templates/${id}/duplicate`);
    return normalize(res?.item ?? res);
  },

  async preview({ subjectLine, emailBody, sampleData }) {
    return axiosClient.post('/api/v1/masters/email-templates/preview', {
      subject_line: subjectLine,
      email_body:   emailBody,
      sample_data:  sampleData,
    });
  },

  // Validation stub — backend enforces template code uniqueness (409)
  codeExists: () => Promise.resolve(false),
};
