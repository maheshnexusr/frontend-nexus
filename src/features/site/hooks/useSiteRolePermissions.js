/**
 * useSiteRolePermissions — returns the active user's sponsor-workspace
 * permission tree (the same shape we save when creating a Site Role).
 *
 * Lookup order:
 *   1. site auth scope     — `siteAuthUser.permissions`
 *      (PI activation flow / POST /api/v1/site/auth/login)
 *   2. CRO team member in sponsor view — looks up `studyId` against the
 *      logged-in CRO user's `assignedStudies[].sponsorPermissions`. So a
 *      CRO admin who's been assigned per-study sponsor permissions sees the
 *      sponsor menu filtered by THEIR permissions for that specific study.
 *
 * Direct sponsor users are intentionally treated as unrestricted at the
 * leaf level — their menu is gated only by study.config (consentManager,
 * queryManager, etc.) in SponsorLayout, not by `sponsorAuthUser.permissions`.
 *
 * Returns `null` (= unrestricted) when:
 *   - the user is a direct sponsor (no site / CRO-per-study match)
 *   - no scoped permissions can be found
 *   - the CRO user has no `assignedStudies` for the current studyId
 *
 * Permission tree shape (keys match FEATURE_TREE leaf keys):
 *   {
 *     dashboard:        { view, export },
 *     data_capture:     { view, create, edit, delete, export, screenshot },
 *     consent_builder:  { view, create, edit, delete, screenshot },
 *     consent_review:   { view, edit, export, screenshot },
 *     query_manager:    { view, create, edit, delete, export, screenshot },
 *     data_verification:{ view, create, edit, export, screenshot },
 *     sites:            { view, create, edit, delete, import, export, screenshot },
 *     site_personnel:   { view, create, edit, delete, export, screenshot },
 *     site_roles:       { view, create, edit, delete, export, screenshot },
 *     reports:          { view, create, export },
 *     email_templates:  { view, create, edit, delete },
 *     countries:        { view, create, edit, delete },
 *     locations:        { view, create, edit, delete },
 *     regions:          { view, create, edit, delete },
 *     activity_log:     { view, export, screenshot },
 *   }
 *
 * Usage:
 *   const { studyId } = useParams();
 *   const perms = useSiteRolePermissions(studyId);
 *   // or, when the layout already has studyId in scope:
 *   const perms = useSiteRolePermissions();   // reads from useParams() route
 */

import { useParams } from 'react-router-dom';

function readJSON(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Pure resolver — same logic without React, for non-component callers.
 *
 *  Resolution order: site auth → direct sponsor (per-study grant) → CRO
 *  viewer (per-study assignment) → unrestricted.
 *
 *  Direct sponsor users ARE gated by the per-study permission tree the CRO
 *  assigned in Study Wizard Step 1 — POST /sponsor/studies/choose returns it
 *  and it is persisted in `sponsorStudyContext`. A study with no per-study
 *  grant (legacy) resolves to unrestricted (null).
 */
export function resolveRolePermissions(studyId) {
  // 1. Direct site auth scope wins — but ONLY when a site token is actually
  //    active. Site permissions are study-scoped: they live in
  //    `siteStudyContext` (written by POST /site/studies/choose), not in the
  //    study-agnostic `siteAuthUser`. The guard stops a stale context from an
  //    earlier PI session leaking into a later sponsor session's menu.
  if (typeof window !== 'undefined' && localStorage.getItem('siteAccessToken')) {
    const ctx = readJSON('siteStudyContext');
    if (ctx?.permissions && Object.keys(ctx.permissions).length) return ctx.permissions;
  }

  // 1b. Sponsor workspace session — gate by the per-study permission tree
  //     returned by POST /sponsor/studies/choose (buildSponsorView projects
  //     the study's Step-1 grant). Stored in `sponsorStudyContext`, keyed by
  //     studyId. Applies to BOTH a direct sponsor login (`sponsorAccessToken`)
  //     and a CRO operator viewing the sponsor workspace (`sponsorViewToken`).
  //     `'*'` (system admin on a study with no grant) → null = unrestricted.
  if (
    typeof window !== 'undefined' &&
    (localStorage.getItem('sponsorAccessToken') || localStorage.getItem('sponsorViewToken'))
  ) {
    const ctx = readJSON('sponsorStudyContext');
    const perms = ctx?.permissions;
    if (ctx?.studyId && (!studyId || ctx.studyId === studyId)) {
      if (perms === '*' || perms === true) return null;
      if (perms && typeof perms === 'object' && Object.keys(perms).length) return perms;
    }
  }

  // 2. CRO team member viewing a sponsor workspace — find the assigned
  //    study and return its per-study sponsor permissions.
  if (studyId) {
    const croUser = readJSON('authUser');
    const list = Array.isArray(croUser?.assignedStudies) ? croUser.assignedStudies : [];
    const match = list.find((s) => s.studyId === studyId);
    if (match?.sponsorPermissions) return match.sponsorPermissions;

    // Diagnostic: this is the single most common cause of "menu doesn't
    // reflect my permissions" — the URL studyId doesn't match any of the
    // user's assignedStudies, so the layout falls back to "unrestricted"
    // (canViewLeaf returns true for everything → full default menu).
    if (typeof window !== 'undefined' && window.__AUTH_DEBUG !== false) {
      console.warn(
        '[perms] useSiteRolePermissions falling back to unrestricted (default menu) — no assignedStudies match.',
        {
          urlStudyId:                 studyId,
          authUserAssignedStudyIds:   list.map((s) => s.studyId),
          hint: list.length === 0
            ? 'authUser.assignedStudies is EMPTY — likely a cached pre-fix session. Sign out + sign in to refresh.'
            : 'URL studyId is not in the list. Check that the route uses the DB id (e.g. "2yqpkim154kxjfl1"), not the protocol number.',
        },
      );
    }
  }

  // Direct sponsor users + everyone else → unrestricted.
  return null;
}

export function useSiteRolePermissions(studyIdArg) {
  const params  = useParams();
  const studyId = studyIdArg ?? params?.studyId ?? null;
  return resolveRolePermissions(studyId);
}

/** Same lookup without React — used outside components if needed. */
export function getCurrentRolePermissions(studyId) {
  return resolveRolePermissions(studyId);
}
