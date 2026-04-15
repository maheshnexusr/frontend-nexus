/**
 * profileService.js
 * Authenticated user's own profile — /api/v1/profile
 */

import axiosClient from '@/api/axiosClient';

export const profileService = {
  /**
   * GET /api/v1/profile/me
   * Returns: { success, item: { id, full_name, email_address, contact_number,
   *            team_member_id, photograph_path, role_name } }
   */
  get: () =>
    axiosClient.get('/api/v1/profile/me'),

  /**
   * PUT /api/v1/profile/me  (multipart/form-data)
   * Fields: fullName*, contactNumber, removePhoto (boolean), photograph (file)
   * Returns: { success, item, message }
   */
  update: (formData) =>
    axiosClient.put('/api/v1/profile/me', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * POST /api/v1/profile/change-password
   * Payload: { currentPassword, newPassword, confirmNewPassword }
   * Returns: { success, message }
   */
  changePassword: ({ currentPassword, newPassword, confirmNewPassword }) =>
    axiosClient.post('/api/v1/profile/change-password', {
      current_password:     currentPassword,
      new_password:         newPassword,
      confirm_new_password: confirmNewPassword,
    }),
};
