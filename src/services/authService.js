/**
 * authService.js
 * All authentication-related API calls.
 * All request payloads use snake_case per API spec.
 */

import axiosClient from '@/api/axiosClient';

export const authService = {
  /** POST /api/v1/auth/register — CRO self-service sign-up.
   *  Creates a pending CRO account and emails an activation link. */
  register: ({ fullName, emailAddress, organizationName, contactNumber, jobTitle }) =>
    axiosClient.post('/api/v1/auth/register', {
      full_name:         fullName,
      email_address:     emailAddress,
      organization_name: organizationName || undefined,
      contact_number:    contactNumber || undefined,
      job_title:         jobTitle || undefined,
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

  /** POST /api/v1/auth/login/mfa/verify — finish an MFA login with the emailed
   *  code. Returns the same session shape as a normal login. */
  verifyMfa: ({ mfaToken, code }) =>
    axiosClient.post('/api/v1/auth/login/mfa/verify', {
      mfa_token: mfaToken,
      code,
    }),

  /** POST /api/v1/auth/login/mfa/resend — re-send the MFA code. */
  resendMfa: ({ mfaToken }) =>
    axiosClient.post('/api/v1/auth/login/mfa/resend', {
      mfa_token: mfaToken,
    }),

  /** POST /api/v1/auth/switch-identity — in-app workspace switch, no password.
   *  The caller is already authenticated; the backend mints the target
   *  identity's session after matching its email to the current session's. */
  switchIdentity: (identityId) =>
    axiosClient.post('/api/v1/auth/switch-identity', {
      identity_id: identityId,
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

  /** POST /api/v1/auth/forgot-password/otp/request — send a reset OTP to the
   *  registered email. 404 when no account exists for the email. */
  forgotPasswordRequestOtp: ({ email }) =>
    axiosClient.post('/api/v1/auth/forgot-password/otp/request', { email }),

  /** POST /api/v1/auth/forgot-password/otp/verify — validate the OTP. Returns a
   *  short-lived reset_token that authorises the set-new-password step. */
  forgotPasswordVerifyOtp: ({ email, otp }) =>
    axiosClient.post('/api/v1/auth/forgot-password/otp/verify', { email, otp }),

  /** POST /api/v1/auth/forgot-password/otp/reset — set the new password using
   *  the reset_token returned by verify. */
  forgotPasswordResetWithOtp: ({ resetToken, password }) =>
    axiosClient.post('/api/v1/auth/forgot-password/otp/reset', {
      reset_token: resetToken,
      password,
    }),

  /** POST /api/v1/auth/refresh */
  refreshToken: (refreshToken) =>
    axiosClient.post('/api/v1/auth/refresh', { refresh_token: refreshToken }),

  /** POST /api/v1/auth/logout */
  logout: () =>
    axiosClient.post('/api/v1/auth/logout'),
};
