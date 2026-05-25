/**
 * usePermissions — central hook that exposes the spec's flat camelCase
 * permission keys (canRaiseQuery, canVerifyField, canAccessQueryManager …)
 * derived from the existing nested `{leaf}.{action}` permission tree stored
 * in `state.auth.permissions`.
 *
 * Two contracts in one place:
 *
 *   1. `usePermissions()` — returns the spec's flat object. Everywhere in
 *      the UI that needs to gate behavior should call this and check
 *      `permissions.canRaiseQuery` etc. — never `role === 'CRA'`.
 *
 *   2. `usePermissions().has(leaf, action)` — escape hatch for the raw
 *      tree lookup so existing call-sites (`useFieldCapabilities`,
 *      `useFormGate`, `canViewLeaf`) stay compatible.
 *
 * Fail-open semantics match the existing pattern:
 *   - `permissions === null/undefined` → allow everything (pre-login)
 *   - `permissions === '*'`            → super-admin
 *   - missing leaf                     → deny
 *   - leaf === '*' or true             → all actions on that leaf
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectPermissions, selectPermissionsTree } from '@/features/auth/authSlice';
import { selectIsViewingSponsor } from '@/features/workspace/store/sponsorViewSlice';
import { useSiteRolePermissions } from '@/features/site/hooks/useSiteRolePermissions';

const ALLOW_ALL = true;
const DENY      = false;

/** Low-level lookup; exported for reuse. */
export function hasPerm(permissions, leaf, action) {
  if (permissions == null) return ALLOW_ALL;
  if (permissions === '*') return ALLOW_ALL;
  if (typeof permissions !== 'object') return ALLOW_ALL;
  const node = permissions[leaf];
  if (!node) return DENY;
  if (node === '*' || node === true) return ALLOW_ALL;
  return !!node[action];
}

/**
 * Mapping spec → existing permission tree.
 *
 * The frontend has historically been built on `{leaf}.{action}` so we
 * derive every flat camelCase key from that to avoid a backend migration.
 * If the backend later returns the flat shape directly, we just merge it
 * on top.
 */
function buildFlat(permissions) {
  const can = (leaf, action) => hasPerm(permissions, leaf, action);

  const flat = {
    // ── Form / Data Capture ──────────────────────────────────────────────
    canViewForm:        can('data_capture', 'view'),
    canEditForm:        can('data_capture', 'edit'),
    canSaveForm:        can('data_capture', 'edit'),
    canSubmitForm:      can('data_capture', 'create') || can('data_capture', 'edit'),
    // Data-capture form-lifecycle actions — granular toggles on the
    // `data_capture` leaf (migrations 021 + 022). Each maps to its own
    // permission so an "edit"-only role can't move the form's status.
    canCompleteForm:    can('data_capture', 'complete'),
    canReviewForm:      can('data_capture', 'review'),
    // Inline Raise Query on a captured field (migration 025). Distinct from
    // query_manager.create — a role can raise queries inline without seeing
    // the Query Manager page. Legacy roles configured with only
    // query_manager.create are accepted as a fallback inside the drawer.
    canRaiseQueryOnField: can('data_capture', 'raise_query'),
    // Inline Close (resolve) Query (migration 026). Strict — no fallback to
    // query_manager.edit. A role can answer queries without being able to
    // close them.
    canCloseQueryOnField: can('data_capture', 'close_query'),
    canFreezeForm:      can('data_capture', 'freeze'),
    canLockForm:        can('data_capture', 'lock'),
    canUnlockForm:      can('data_capture', 'lock'),
    canSignForm:        can('data_capture', 'sign'),
    canApproveForm:     can('data_capture', 'verify'),

    // ── Query Management ─────────────────────────────────────────────────
    canViewQueries:     can('query_manager', 'view'),
    canRaiseQuery:      can('query_manager', 'create'),
    canRespondQuery:    can('query_manager', 'edit'),
    canResolveQuery:    can('query_manager', 'edit'),
    canReopenQuery:     can('query_manager', 'edit'),
    canDeleteQuery:     can('query_manager', 'delete'),
    canExportQueries:   can('query_manager', 'export'),
    canViewAllQueries:  can('query_manager', 'view'),        // backend should scope by site otherwise
    canAccessQueryManager: can('query_manager', 'view'),

    // ── Verification / SDV ───────────────────────────────────────────────
    // Field/form verification is the `verify` action on the data_capture leaf
    // (migration 021). The data_verification leaf still gates the standalone
    // Verification Manager screen.
    canVerifyField:               can('data_capture', 'verify'),
    canUnverifyField:             can('data_capture', 'verify'),
    canViewVerificationStatus:    can('data_verification', 'view') || can('data_capture', 'verify'),
    canAccessVerificationManager: can('data_verification', 'view'),

    // ── Audit Trail ──────────────────────────────────────────────────────
    canViewAuditTrail:   can('activity_log', 'view') || can('data_capture', 'view'),
    canExportAuditTrail: can('activity_log', 'export'),

    // ── Subject / Site Access ────────────────────────────────────────────
    canViewSubjects:    can('data_capture', 'view'),
    canViewAllSites:    can('sites', 'view'),
    canManageSites:     can('sites', 'edit') || can('sites', 'create'),

    // ── Consent ──────────────────────────────────────────────────────────
    canViewConsent:     can('consent_builder', 'view') || can('consent_review', 'view'),
    canBuildConsent:    can('consent_builder', 'create') || can('consent_builder', 'edit'),
    canReviewConsent:   can('consent_review', 'edit'),

    // ── Annotations + Notes + Attachments — runtime collaboration ────────
    canAddAnnotation:   can('data_capture', 'edit'),
    canAddNote:         can('data_capture', 'edit'),
    canAddAttachment:   can('data_capture', 'edit'),
    canClearField:      can('data_capture', 'edit'),
  };

  return flat;
}

export function usePermissions() {
  // hasPerm + buildFlat expect the raw `{leaf}.{action}` tree shape the
  // backend ships (e.g. { data_capture: { view: true } }). The flat
  // dot-notation array stored at state.auth.permissions is only useful
  // for the CRO sidebar's `Array.includes(...)` checks — it can't answer
  // per-leaf questions. Prefer the tree; fall back to the array's '*'
  // wildcard when the tree is absent (legacy cached sessions).
  const permissionsTree  = useSelector(selectPermissionsTree);
  const permissionsArr   = useSelector(selectPermissions);
  const viewingAsSponsor = useSelector(selectIsViewingSponsor);
  // Per-study sponsor permission tree for a CRO team member who entered a
  // sponsor workspace — resolved from their cro_team_member_study_permissions
  // assignment (authUser.assignedStudies[studyId].sponsorPermissions).
  // Returns null = unrestricted (system-role CRO admin / direct sponsor).
  const sponsorRolePerms = useSiteRolePermissions();

  return useMemo(() => {
    // ── CRO user inside a sponsor workspace ───────────────────────────
    // Gate by their PER-STUDY assigned permissions, not a blanket '*'. A
    // scoped CRO team member sees/does only what was assigned to them in
    // cro_team_member_study_permissions; a system-role CRO admin resolves to
    // null here → hasPerm treats null as allow-all, so they keep full access.
    // Mirrors the backend (buildSponsorView / authorizeSponsor). Direct
    // sponsor + site logins are unaffected (viewingAsSponsor is false).
    const wildcardFromArr = Array.isArray(permissionsArr) && permissionsArr.includes('*');
    // Site + direct-sponsor sessions don't populate state.auth.permissionsTree
    // — their tree lives in (site|sponsor)StudyContext.permissions, exposed via
    // useSiteRolePermissions (`sponsorRolePerms`). Without routing these
    // sessions through that tree, every leaf check fell through to null →
    // ALLOW_ALL, so Mark Reviewed / Approve / Freeze / Lock / Sign Form / Raise
    // & Close Query all rendered for users who weren't granted them.
    const isSiteSession    = typeof window !== 'undefined' &&
                             !!localStorage.getItem('siteAccessToken');
    const isSponsorSession = typeof window !== 'undefined' &&
                             !!localStorage.getItem('sponsorAccessToken');
    // Site + sponsor sessions take ABSOLUTE precedence — must short-circuit
    // before checking wildcardFromArr / permissionsTree, because both can
    // contain STALE data from a previous CRO session that the user logged out
    // of without clearing localStorage.
    //
    // Null vs empty-object semantics:
    //   • Site session, sponsorRolePerms === null → fail CLOSED ({}). Site
    //     sessions always have a per-study tree once /site/studies/choose
    //     has been called; null means "tree missing", so deny everything.
    //   • Sponsor session, sponsorRolePerms === null → fail OPEN (null).
    //     useSiteRolePermissions returns null for a sponsor sys-admin
    //     (`permissions: '*'` in sponsorStudyContext) — passing null through
    //     lets hasPerm treat them as unrestricted.
    //   • Either session, sponsorRolePerms is an object → use it verbatim.
    //     Missing leaves on a granted tree mean DENY (correct).
    const base            =
        isSiteSession                ? (sponsorRolePerms ?? {})
      : isSponsorSession             ? sponsorRolePerms            // null = sys-admin (unrestricted)
      : wildcardFromArr              ? '*'
                                     : (permissionsTree ?? null);
    const effective       = viewingAsSponsor ? sponsorRolePerms : base;

    const flat = buildFlat(effective);
    return {
      ...flat,
      // Escape hatch for legacy { leaf, action } lookups.
      has: (leaf, action) => hasPerm(effective, leaf, action),
      // Raw backend payload — exposed so debug screens / inspectors can
      // show the full tree without piercing the abstraction.
      raw: permissionsTree,
      // True when the CRO user is inside a sponsor workspace.
      isCROOverride: viewingAsSponsor,
    };
  }, [permissionsTree, permissionsArr, viewingAsSponsor, sponsorRolePerms]);
}
