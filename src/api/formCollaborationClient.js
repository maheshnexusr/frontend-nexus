/**
 * formCollaborationClient — persists per-field form attachments so they survive
 * reloads. Backs the AttachmentDrawer.
 *
 * Endpoints (mounted at /api/v1/forms, authenticateAny — works for site,
 * sponsor and CRO sessions):
 *   GET    /:formId/fields/:fieldId/collaboration       → { attachments, ... }
 *   POST   /:formId/fields/:fieldId/attachments         (metadata)
 *   DELETE /:formId/fields/:fieldId/attachments/:id
 *
 * We key `formId` = subjectId (a single nano id that fits the backend's
 * VARCHAR(32) form_id column and is unique per subject; field ids are unique
 * per form, so (subjectId, fieldId) is effectively per subject+form+field).
 *
 * The file bytes themselves are uploaded separately via formFileClient
 * (/var/www/uploads/<env>/<study_id>/); here we only store the reference.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_USE_LOCAL === 'true'
  ? (import.meta.env.VITE_LOCAL_API_URL ?? 'http://187.127.139.10:8080')
  : (import.meta.env.VITE_PROD_API_URL  ?? 'https://backend-nexusr.onrender.com');

function pickToken() {
  return localStorage.getItem('siteWorkspaceToken')
      || localStorage.getItem('sponsorViewToken')
      || localStorage.getItem('sponsorAccessToken')
      || localStorage.getItem('accessToken')
      || null;
}

function authHeaders() {
  const token = pickToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Backend attachment row (snake_case) → FE shape used by the slice / drawer.
function normalizeAttachment(row) {
  return {
    id:             row.attachment_id ?? row.id,
    fileName:       row.file_name ?? row.fileName,
    fileUrl:        row.file_url ?? row.fileUrl,
    fileSize:       row.file_size ?? row.fileSize ?? null,
    fileType:       row.file_type ?? row.fileType ?? '',
    uploadedBy:     row.uploaded_by ?? row.uploadedBy ?? null,
    uploadedByName: row.uploaded_by_name ?? row.uploadedByName ?? '',
    uploadedAt:     row.uploaded_at ?? row.uploadedAt ?? null,
  };
}

export const formCollaborationClient = {
  /** List persisted attachments for a (subject, field). */
  async listAttachments(subjectId, fieldId) {
    const res = await axios.get(
      `${API_BASE}/api/v1/forms/${subjectId}/fields/${fieldId}/collaboration`,
      { headers: authHeaders() },
    );
    const rows = res.data?.attachments ?? [];
    return rows.map(normalizeAttachment);
  },

  /** Persist one already-uploaded file reference. */
  async createAttachment(subjectId, fieldId, { fileUrl, fileName, fileSize, fileType }) {
    const res = await axios.post(
      `${API_BASE}/api/v1/forms/${subjectId}/fields/${fieldId}/attachments`,
      { fileUrl, fileName, fileSize, fileType },
      { headers: authHeaders() },
    );
    return normalizeAttachment(res.data?.item ?? {});
  },

  /** Remove a persisted attachment row. */
  async deleteAttachment(subjectId, fieldId, attachmentId) {
    await axios.delete(
      `${API_BASE}/api/v1/forms/${subjectId}/fields/${fieldId}/attachments/${attachmentId}`,
      { headers: authHeaders() },
    );
  },
};

export default formCollaborationClient;
