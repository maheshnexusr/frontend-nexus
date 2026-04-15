/**
 * authService.js
 * All authentication-related API calls.
 * All request payloads use snake_case per API spec.
 */

import axiosClient from '@/api/axiosClient';

export const authService = {
  /** POST /api/v1/auth/register */
  register: ({ fullName, emailAddress, contactNumber, jobTitle, organizationCode, organizationName }) =>
    axiosClient.post('/api/v1/auth/register', {
      full_name:         fullName,
      email_address:     emailAddress,
      contact_number:    contactNumber   || undefined,
      job_title:         jobTitle        || undefined,
      organization_code: organizationCode || undefined,
      organization_name: organizationName || undefined,
    }),

  /** POST /api/v1/auth/activate */
  activate: ({ token, password, confirmPassword }) =>
    axiosClient.post('/api/v1/auth/activate', {
      token,
      password,
      confirm_password: confirmPassword,
    }),

  /** POST /api/v1/auth/login/password */
  login: ({ emailAddress, password }) =>
    axiosClient.post('/api/v1/auth/login/password', {
      email_address: emailAddress,
      password,
    }),

  /** POST /api/v1/auth/login/otp/request */
  requestOtp: ({ emailAddress }) =>
    axiosClient.post('/api/v1/auth/login/otp/request', {
      email_address: emailAddress,
    }),

  /** POST /api/v1/auth/login/otp/verify */
  verifyOtp: ({ emailAddress, otp }) =>
    axiosClient.post('/api/v1/auth/login/otp/verify', {
      email_address: emailAddress,
      otp,
    }),

  /** POST /api/v1/auth/refresh */
  refreshToken: (refreshToken) =>
    axiosClient.post('/api/v1/auth/refresh', { refresh_token: refreshToken }),

  /** POST /api/v1/auth/logout */
  logout: () =>
    axiosClient.post('/api/v1/auth/logout'),
};
