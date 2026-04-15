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
   * GET /api/v1/masters/email-templates
   * params: { page, pageSize, search, status }
   * Returns: { success, items, pagination }
   */
  list: (params = {}) =>
    axiosClient.get(`/api/v1/masters/email-templates${buildQueryString(params)}`),

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
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * DELETE /api/v1/masters/email-templates/:id/attachments/:attachmentId
   * Returns: { success, item }
   */
  deleteAttachment: (id, attachmentId) =>
    axiosClient.delete(`/api/v1/masters/email-templates/${id}/attachments/${attachmentId}`),

  /**
   * POST /api/v1/masters/email-templates/preview
   * Payload: { subjectLine, emailBody, sampleData? }
   * Returns: { success, renderedSubject, renderedBody }
   */
  preview: (data) =>
    axiosClient.post('/api/v1/masters/email-templates/preview', data),

  /** GET /api/v1/masters/email-templates/export — CSV download */
  export: async () => {
    const blob = await axiosClient.get('/api/v1/masters/email-templates/export', { responseType: 'blob' });
    csvDownload(blob);
  },
};
