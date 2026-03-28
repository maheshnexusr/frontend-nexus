/**
 * authService.js
 * All authentication-related API calls.
 *
 * Rules:
 *  - Only Axios calls here — zero UI/Redux logic
 *  - Each function returns the unwrapped response payload (axiosClient unwraps .data)
 *  - Callers (hooks / thunks) decide what to do with the result
 */

import axiosClient from '@/api/axiosClient';

export const authService = {
  /**
   * Sign in with email + password.
   * @returns {{ accessToken, refreshToken, user, permissions }}
   */
  login: ({ email, password, geoInfo }) =>
    axiosClient.post('/auth/signin', { email, password, geoInfo }),

  /**
   * Register a new account.
   * @returns {{ message }}
   */
  signup: ({ fullName, email, password }) =>
    axiosClient.post('/auth/signup', { fullName, email, password }),

  /**
   * Invalidate the current session server-side.
   */
  logout: () =>
    axiosClient.post('/auth/signout'),

  /**
   * Fetch the authenticated user's profile.
   * @returns {{ user, permissions }}
   */
  me: () =>
    axiosClient.get('/auth/me'),

  /**
   * Exchange a refresh token for a new access token.
   * @returns {{ accessToken, refreshToken }}
   */
  refreshToken: (refreshToken) =>
    axiosClient.post('/auth/refresh-token', { refreshToken }),

  /**
   * Request a password-reset email.
   */
  requestPasswordReset: (email) =>
    axiosClient.post('/auth/forgot-password', { email }),

  /**
   * Set a new password using a reset token.
   */
  resetPassword: ({ token, newPassword }) =>
    axiosClient.post('/auth/reset-password', { token, newPassword }),

  /**
   * Change password for the currently authenticated user.
   */
  changePassword: ({ oldPassword, newPassword }) =>
    axiosClient.put('/auth/change-password', { oldPassword, newPassword }),

  /**
   * Verify an email address using a one-time token.
   */
  verifyEmail: (token) =>
    axiosClient.post('/auth/verify-email', { token }),

  /**
   * Verify a one-time password sent to the user's email.
   */
  verifyOtp: ({ email, otp, geoInfo }) =>
    axiosClient.post('/auth/verify-otp', { email, otp, geoInfo }),
};
