/**
 * getRoleRedirect — returns the post-login destination path.
 *
 * Logic:
 *   CRO roles   → /cro/dashboard
 *   Sponsor roles
 *     with studyId  → /sponsor/:studyId/dashboard   (single study, go straight in)
 *     without studyId → /sponsor/select-study        (multiple studies, pick one)
 *
 * The `user` object comes directly from the API login response.
 * When the real backend is connected, include `studyId` in the response
 * for single-study sponsor users, or omit it to show the study picker.
 *
 * @param {object|null|undefined} user  - Full user object from authSlice
 * @returns {string}
 */
export function getRoleRedirect(user) {
  const role = user?.role;

  switch (role) {
    case 'admin':
    case 'cro_admin':
    case 'cro':
      return '/cro/dashboard';

    case 'sponsor':
    case 'site_staff':
    case 'investigator':
    case 'data_manager':
      // If the backend gave us a studyId, go straight to the study dashboard
      if (user?.studyId) return `/sponsor/${user.studyId}/dashboard`;
      // Otherwise show the sponsor-facing study picker
      return '/sponsor/select-study';

    default:
      return '/cro/dashboard';
  }
}
