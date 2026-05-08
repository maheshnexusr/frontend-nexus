/**
 * emailTemplateService.js
 * Email template CRUD — /api/v1/masters/email-templates
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

function csvDownload(blob) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = 'email-templates.csv'; a.click();
  URL.revokeObjectURL(url);
}

export const emailTemplateService = {
  /**
   * GET /api/v1/masters/email-templates (spec §5.1)
   * Accepts camelCase: { page, pageSize, search, status }
   * Sends snake_case:  ?page=&limit=&search=&status=
   */
  list: (params = {}) => {
    const query = {
      page:   params.page,
      limit:  params.limit ?? params.pageSize,
      search: params.search,
      status: params.status,
    };
    return axiosClient.get(`/api/v1/masters/email-templates${buildQueryString(query)}`);
  },

  /**
   * GET /api/v1/masters/email-templates/:id
   * Returns: { success, item }  — includes attachments[]
   */
  getById: (id) =>
    axiosClient.get(`/api/v1/masters/email-templates/${id}`),

  /**
   * POST /api/v1/masters/email-templates
   * Payload: { templateName, templateCode, subjectLine, emailBody,
   *            fromEmail?, fromName?, ccEmails?, bccEmails?,
   *            category?, description?, templateType?, status? }
   * Returns: { success, item }
   */
  create: (data) =>
    axiosClient.post('/api/v1/masters/email-templates', data),

  /**
   * PUT /api/v1/masters/email-templates/:id
   * Same payload as create.
   */
  update: (id, data) =>
    axiosClient.put(`/api/v1/masters/email-templates/${id}`, data),

  /**
   * DELETE /api/v1/masters/email-templates/:id
   * Returns: { success, item }
   */
  delete: (id) =>
    axiosClient.delete(`/api/v1/masters/email-templates/${id}`),

  /**
   * POST /api/v1/masters/email-templates/:id/duplicate
   * Returns: { success, item }  — the new duplicate
   */
  duplicate: (id) =>
    axiosClient.post(`/api/v1/masters/email-templates/${id}/duplicate`),

  /**
   * POST /api/v1/masters/email-templates/:id/attachments  (multipart/form-data)
   * file: PDF/PNG/JPEG/DOC/DOCX, max 5MB
   * Returns: { success, item: { attachment_id, file_name, file_path, file_size, uploaded_at } }
   */
  addAttachment: (id, formData) =>
    axiosClient.post(`/api/v1/masters/email-templates/${id}/attachments`, formData, {
    }),

  /**
   * DELETE /api/v1/masters/email-templates/:id/attachments/:attachmentId
   * Returns: { success, item }
   */
  deleteAttachment: (id, attachmentId) =>
    axiosClient.delete(`/api/v1/masters/email-templates/${id}/attachments/${attachmentId}`),

  /**
   * POST /api/v1/masters/email-templates/preview  (spec §5.1)
   * Payload: { subject_line, email_body, sample_data }
   * Returns: { success, renderedSubject, renderedBody }
   */
  preview: ({ subjectLine, emailBody, sampleData = {} }) =>
    axiosClient.post('/api/v1/masters/email-templates/preview', {
      subject_line: subjectLine,
      email_body:   emailBody,
      sample_data:  sampleData,
    }),

  /**
   * POST /api/v1/masters/email-templates/:id/test-send
   * Sends a test email with sample values to the given address.
   */
  testSend: (id, email) =>
    axiosClient.post(`/api/v1/masters/email-templates/${id}/test-send`, { email }),

  /** GET /api/v1/masters/email-templates/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/email-templates/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
