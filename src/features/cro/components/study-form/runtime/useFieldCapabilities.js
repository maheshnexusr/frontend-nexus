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
import { selectActiveStudy } from '@/features/workspace/store/workspaceSlice';
import { resolveStudyConfig } from '@/features/cro/utils/studyConfigGating';
import { usePermissions } from '@/features/auth/usePermissions';

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

export function useFieldCapabilities() {
  // Read the spec's flat camelCase keys from the central hook. The previous
  // `{leaf}.{action}` lookups still happen inside usePermissions, so no
  // contract change for callers.
  const p     = usePermissions();
  const study = useSelector(selectActiveStudy);

  return useMemo(() => {
    const hasWorkspace = !!study?.id;
    if (!hasWorkspace) return ALLOW_ALL;

    const config = resolveStudyConfig(study?.config);

    return {
      // ─ Stage 1 ∧ Stage 2: feature ON for the study AND user can view it ─
      canSeeQueries:      config.queryManager        && p.canAccessQueryManager,
      canSeeVerification: config.verificationManager && p.canAccessVerificationManager,
      canSeeAnnotations:  p.canViewForm,
      canSeeNotes:        p.canViewForm,
      canSeeAttachments:  p.canViewForm,
      canSeeAudit:        p.canViewAuditTrail,
      canSeeClear:        p.canClearField,

      // ─ Per-action perms — used to gate buttons inside popovers ─
      canCreateQuery:     p.canRaiseQuery,
      canEditQuery:       p.canRespondQuery || p.canResolveQuery || p.canReopenQuery,
      canDeleteQuery:     p.canDeleteQuery,
      canVerify:          p.canVerifyField,
      canEditField:       p.canEditForm,
      canSubmitForm:      p.canSubmitForm,

      // ─ Phase 1/3 form-status gates (re-exposed for useFormGate) ─
      canApproveForm:     p.canApproveForm,

      _hasWorkspace:   true,
      _hasPermissions: p.raw != null,
    };
  }, [p, study]);
}
