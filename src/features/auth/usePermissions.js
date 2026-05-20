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
    canFreezeForm:      can('data_verification', 'edit'),    // freezing is a quality control
    canLockForm:        can('query_manager', 'edit'),         // locking after queries closed
    canUnlockForm:      can('query_manager', 'edit'),
    canSignForm:        can('data_capture', 'edit'),          // Investigator/Site signer
    canApproveForm:     can('data_verification', 'create') || can('data_verification', 'edit'),

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
    canVerifyField:               can('data_verification', 'create') || can('data_verification', 'edit'),
    canUnverifyField:             can('data_verification', 'edit')   || can('data_verification', 'delete'),
    canViewVerificationStatus:    can('data_verification', 'view'),
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

  return useMemo(() => {
    // ── Override: CRO user inside a sponsor workspace ─────────────────
    // A CRO operator has full access of the sponsor role they're viewing.
    // We treat their effective permissions as super-admin ('*') regardless
    // of what the backend ships. This keeps the CRO-side experience write-
    // capable inside the sponsor portal without requiring backend perm
    // synchronisation. Direct sponsor logins (and site logins) keep using
    // their own backend-supplied permissions.
    const wildcardFromArr = Array.isArray(permissionsArr) && permissionsArr.includes('*');
    const base            = wildcardFromArr ? '*' : (permissionsTree ?? null);
    const effective       = viewingAsSponsor ? '*' : base;

    const flat = buildFlat(effective);
    return {
      ...flat,
      // Escape hatch for legacy { leaf, action } lookups.
      has: (leaf, action) => hasPerm(effective, leaf, action),
      // Raw backend payload — exposed so debug screens / inspectors can
      // show the full tree without piercing the abstraction.
      raw: permissionsTree,
      // True when the CRO override is in effect (useful for UI hints).
      isCROOverride: viewingAsSponsor,
    };
  }, [permissionsTree, permissionsArr, viewingAsSponsor]);
}
