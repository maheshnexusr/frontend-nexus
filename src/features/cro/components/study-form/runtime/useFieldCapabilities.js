/**
 * useFieldCapabilities — single source of truth for "can this user use
 * <feature X> on a field?"
 *
 * Combines two gates:
 *   Stage 1 — Study Step-3 config flags (queryManager, verificationManager,
 *             dataManager, consentManager). If the study has the module
 *             switched off, no one — even an admin — can use the feature on
 *             this study.
 *   Stage 2 — Role permissions from authSlice. Granular per-action perms
 *             (view / create / edit / delete / export) live in the
 *             permissions tree under leaves like `query_manager`,
 *             `data_verification`, `data_capture`.
 *
 * Returned shape is consumed by FieldToolbar / CollaborationChips (to
 * filter which actions show on a field) and by individual popovers
 * (QueryDrawer, VerificationPanel) to gate their Submit/Resolve/Delete
 * buttons on per-action perms.
 *
 * "Fail open" semantics: when there's no workspace context (e.g. the
 * form-builder Preview is invoked before any sponsor/site workspace is
 * loaded) or no permissions object is set, every capability is allowed —
 * matching the existing `canViewLeaf` / `useReadOnlyView` pattern. This
 * lets a CRO designer test the form without a role assigned.
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectPermissions } from '@/features/auth/authSlice';
import { selectActiveStudy } from '@/features/workspace/store/workspaceSlice';
import { resolveStudyConfig } from '@/features/cro/utils/studyConfigGating';

const ALLOW_ALL = Object.freeze({
  // Stage 1 + Stage 2 — whether the feature is visible on a field at all.
  canSeeQueries:       true,
  canSeeVerification:  true,
  canSeeAnnotations:   true,
  canSeeNotes:         true,
  canSeeAttachments:   true,
  canSeeAudit:         true,
  canSeeClear:         true,
  // Per-action perms — gate buttons inside popovers.
  canCreateQuery:      true,
  canEditQuery:        true,
  canDeleteQuery:      true,
  canVerify:           true,
  canEditField:        true,
  canSubmitForm:       true,
  // Debug helpers — useful for "Why can't I see X?" inspection.
  _hasWorkspace: false,
  _hasPermissions: false,
});

/**
 * Look up `perms[leaf][action]`. Treats:
 *   - permissions === null/undefined → fail open (true)
 *   - permissions === '*'            → super-admin (true)
 *   - permissions is plain object    → require leaf and action to be truthy
 */
function canPerform(permissions, leaf, action) {
  if (permissions == null) return true;            // not yet loaded → fail open
  if (permissions === '*') return true;            // super-admin
  if (typeof permissions !== 'object') return true;
  const node = permissions[leaf];
  if (!node) return false;
  if (node === '*' || node === true) return true;  // role grants all actions
  return !!node[action];
}

export function useFieldCapabilities() {
  const permissions = useSelector(selectPermissions);
  const study       = useSelector(selectActiveStudy);

  return useMemo(() => {
    const hasWorkspace = !!study?.id;
    if (!hasWorkspace) return ALLOW_ALL;

    const config = resolveStudyConfig(study?.config);
    const can = (leaf, action) => canPerform(permissions, leaf, action);

    return {
      // ─ Stage 1 ∧ Stage 2: feature ON for the study AND user can view it ─
      canSeeQueries:      config.queryManager        && can('query_manager',     'view'),
      canSeeVerification: config.verificationManager && can('data_verification', 'view'),
      canSeeAnnotations:  can('data_capture', 'view'),  // master is global; gate on form access
      canSeeNotes:        can('data_capture', 'view'),
      canSeeAttachments:  can('data_capture', 'view'),
      canSeeAudit:        can('data_capture', 'view'),
      canSeeClear:        can('data_capture', 'edit'),

      // ─ Per-action perms — used to gate buttons inside popovers ─
      canCreateQuery:     can('query_manager',     'create'),
      canEditQuery:       can('query_manager',     'edit'),     // resolve / answer
      canDeleteQuery:     can('query_manager',     'delete'),
      canVerify:          can('data_verification', 'create') || can('data_verification', 'edit'),
      canEditField:       can('data_capture',      'edit'),     // value change / clear
      canSubmitForm:      can('data_capture',      'create') || can('data_capture', 'edit'),

      _hasWorkspace:   true,
      _hasPermissions: permissions != null,
    };
  }, [permissions, study]);
}
