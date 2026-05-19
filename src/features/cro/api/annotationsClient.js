/**
 * annotationsClient — Annotations master (global code dictionary).
 *
 * One global list of { annotation, fullForm, description } maintained from
 * CRO → Masters → Annotations. The form-builder field popover fetches this
 * same list for reference (read-only browse with search).
 *
 * Endpoints:
 *   GET    /api/v1/masters/annotations
 *   POST   /api/v1/masters/annotations
 *   PUT    /api/v1/masters/annotations/:id
 *   DELETE /api/v1/masters/annotations/:id
 *   POST   /api/v1/masters/annotations/import   (CSV / XLSX)
 *   GET    /api/v1/masters/annotations/import/sample  (optional)
 *
 * Uniqueness: `annotation` only (case-insensitive).
 */

import axiosClient from '@/api/axiosClient';

function normalize(raw) {
  return {
    id:          raw.annotation_id ?? raw.id,
    annotation:  raw.annotation    ?? '',
    fullForm:    raw.full_form     ?? raw.fullForm    ?? '',
    description: raw.description   ?? '',
    status:      raw.status        ?? 'Active',
    createdAt:   raw.created_at    ?? raw.createdAt,
    updatedAt:   raw.updated_at    ?? raw.updatedAt,
  };
}

function extractList(res) {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? res?.annotations ?? []);
  return arr.map(normalize);
}

export const annotationsClient = {
  /** Returns [] on 404 so the field popover can render an empty browse state
   *  before the backend ships. */
  async list() {
    try {
      const res = await axiosClient.get('/api/v1/masters/annotations');
      return extractList(res);
    } catch (err) {
      if (err?.response?.status === 404) return [];
      throw err;
    }
  },

  async create(data) {
    const res = await axiosClient.post('/api/v1/masters/annotations', {
      annotation:  data.annotation,
      full_form:   data.fullForm    || undefined,
      description: data.description || undefined,
      status:      data.status ?? 'Active',
    });
    return normalize(res?.item ?? res);
  },

  async update(id, data) {
    const res = await axiosClient.put(`/api/v1/masters/annotations/${id}`, {
      annotation:  data.annotation,
      full_form:   data.fullForm    || undefined,
      description: data.description || undefined,
      status:      data.status,
    });
    return normalize(res?.item ?? res);
  },

  async delete(id) {
    return axiosClient.delete(`/api/v1/masters/annotations/${id}`);
  },

  /**
   * Bulk-import annotations from CSV / XLSX.
   *
   *   File: `Annotation List.csv` or `Annotation List.xlsx`
   *         (sheet name `Annotations` for XLSX).
   *   Columns: Annotation, Full Form, Description.
   *   Duplicates (case-insensitive on `Annotation`) are skipped, not overwritten.
   *
   * `onProgress` receives upload percentage 0–100.
   */
  async bulkImport(file, { onProgress } = {}) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await axiosClient.post('/api/v1/masters/annotations/import', fd, {
      onUploadProgress: (evt) => {
        if (!onProgress || !evt?.total) return;
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    });
    return {
      imported: res?.imported ?? 0,
      skipped:  res?.skipped  ?? 0,
      errors:   res?.errors   ?? [],
    };
  },

  // Validation stubs — backend enforces uniqueness / dependency constraints
  nameExists:        () => Promise.resolve(false),
  checkDependencies: () => Promise.resolve(false),
};
