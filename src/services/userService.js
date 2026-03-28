/**
 * userService.js
 * User profile and team-member API calls.
 */

import axiosClient from '@/api/axiosClient';
import { buildQueryString } from '@/api/apiHelpers';

export const userService = {
  /* ── Own profile ──────────────────────────────────────────────────────── */

  /** Get the currently authenticated user's profile. */
  getProfile: () =>
    axiosClient.get('/users/me'),

  /** Update the currently authenticated user's profile. */
  updateProfile: (data) =>
    axiosClient.put('/users/me', data),

  /** Upload a new profile photograph (multipart). */
  uploadPhoto: (formData) =>
    axiosClient.post('/users/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /* ── Team members (admin) ─────────────────────────────────────────────── */

  /**
   * List team members with optional filters.
   * @param {{ status?, role?, search?, page?, pageSize? }} params
   */
  listMembers: (params = {}) =>
    axiosClient.get(`/users${buildQueryString(params)}`),

  /** Get a single team member by ID. */
  getMember: (id) =>
    axiosClient.get(`/users/${id}`),

  /** Create a new team member. */
  createMember: (data) =>
    axiosClient.post('/users', data),

  /** Update an existing team member. */
  updateMember: (id, data) =>
    axiosClient.put(`/users/${id}`, data),

  /** Delete a team member. */
  deleteMember: (id) =>
    axiosClient.delete(`/users/${id}`),

  /** Assign a team member to a study. */
  assignToStudy: (memberId, studyId) =>
    axiosClient.post(`/users/${memberId}/studies/${studyId}`),

  /** Remove a team member from a study. */
  removeFromStudy: (memberId, studyId) =>
    axiosClient.delete(`/users/${memberId}/studies/${studyId}`),
};
