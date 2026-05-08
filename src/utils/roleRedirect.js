/**
 * getRoleRedirect — returns the post-login destination path.
 *
 * Logic:
 *   CRO roles     → /cro/dashboard
 *   Sponsor roles → /sponsor/select-study
 *                   (SponsorStudySelectorPage picks a study; if the user is
 *                    assigned to exactly one and has "remember my choice" set,
 *                    it auto-routes to /sponsor/:studyId/dashboard.)
 *
 * The `user` object comes directly from the API login response, normalized
 * in authSlice. `roleName` examples: "CRO Admin", "Sponsor", "Sponsor Admin".
 *
 * @param {object|null|undefined} user
 * @returns {string}
 */
export function getRoleRedirect(user) {
  const roleName = (user?.roleName ?? '').toLowerCase();

  if (roleName.includes('sponsor')) {
    return '/sponsor/select-study';
  }

  return '/cro/dashboard';
}

/** True if the role should enter the sponsor workspace (separate token scope). */
export function isSponsorRole(user) {
  return (user?.roleName ?? '').toLowerCase().includes('sponsor');
}
