/**
 * roleService.js
 * Role CRUD — /api/v1/roles
 */

import axiosClient from '@/api/axiosClient';

export const roleService = {
  /**
   * GET /api/v1/roles
   * Returns: { success, items }  — no pagination (full list)
   * Each item includes permissions[].
   */
  list: () =>
    axiosClient.get('/api/v1/roles'),

  /**
   * POST /api/v1/roles
   * Payload: { roleName, description, permissions[] }
   * Returns: { success, item }
   */
  create: (data) =>
    axiosClient.post('/api/v1/roles', data),

  /**
   * PUT /api/v1/roles/:id
   * Payload: same as create
   * Returns: { success, item }
   */
  update: (id, data) =>
    axiosClient.put(`/api/v1/roles/${id}`, data),

  /**
   * DELETE /api/v1/roles/:id
   * Returns: { success, item }
   */
  delete: (id) =>
    axiosClient.delete(`/api/v1/roles/${id}`),
};
