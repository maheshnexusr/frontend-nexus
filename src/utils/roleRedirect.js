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
  // API login response uses `roleName` (e.g. "CRO Admin", "Sponsor")
  const roleName = (user?.roleName ?? '').toLowerCase();

  if (roleName.includes('sponsor')) {
    return '/workspace';
  }

  // All CRO / admin roles → CRO dashboard
  return '/cro/dashboard';
}
