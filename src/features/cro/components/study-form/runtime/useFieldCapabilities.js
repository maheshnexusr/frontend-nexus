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
  canCloseQuery:       true,
  canEditQuery:        true,
  canDeleteQuery:      true,
  canVerify:           true,
  canEditField:        true,
  canSubmitForm:       true,
  // Data-capture form-lifecycle actions.
  canComplete:         true,
  canReview:           true,
  canSign:             true,
  canFreeze:           true,
  canLock:             true,
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
    // workspaceSlice.activeStudy is set only by the sponsor study picker;
    // direct site/sponsor sessions live entirely through (site|sponsor)
    // StudyContext (localStorage) and may not have dispatched selectStudy yet.
    // Treat any active session-token as having a workspace — otherwise the
    // fail-open below leaks EVERY permission (Mark Reviewed / Approve Form /
    // Freeze / Lock / Sign / Raise Query / Close Query) to sponsor + site
    // users whose Redux activeStudy hadn't been populated.
    const isSiteSession    = typeof window !== 'undefined' &&
                             !!localStorage.getItem('siteAccessToken');
    const isSponsorSession = typeof window !== 'undefined' &&
                             !!localStorage.getItem('sponsorAccessToken');
    const hasWorkspace = !!study?.id || isSiteSession || isSponsorSession;
    if (!hasWorkspace) return ALLOW_ALL;

    const config = resolveStudyConfig(study?.config);

    return {
      // ─ Stage 1 ∧ Stage 2: feature ON for the study AND user can act on it ─
      // The query icon shows when the user can EITHER manage queries
      // (query_manager.view) OR raise them inline (data_capture.raise_query) —
      // raising IS a data_capture action, so a data-capture role with
      // raise_query must see it (the "see" and "do" gates were decoupled,
      // causing a "no permission" dead-end).
      canSeeQueries:      config.queryManager        && (p.canAccessQueryManager || p.canRaiseQueryOnField),
      // Verification has NO data_capture equivalent — the actual SDV verify is
      // gated on data_verification.edit (verify-page route), so the icon is
      // driven purely by Verification Manager access. (data_capture.verify is a
      // separate legacy "approve form" permission — it must NOT reveal the SDV
      // icon, or a Query-Manager role would wrongly see Verify after VM is off.)
      canSeeVerification: config.verificationManager && p.canAccessVerificationManager,
      canSeeAnnotations:  p.canViewForm,
      canSeeNotes:        p.canViewForm,
      canSeeAttachments:  p.canViewForm,
      canSeeAudit:        p.canViewAuditTrail,
      canSeeClear:        p.canClearField,

      // ─ Per-action perms — used to gate buttons inside popovers ─
      // Inline Raise Query is gated strictly on data_capture.raise_query
      // (migration 025). The legacy query_manager.create gate no longer
      // grants this — Query Manager roles must now ALSO tick Raise Query
      // on data_capture to keep raising inline.
      canCreateQuery:     p.canRaiseQueryOnField,
      // Strict close gate (migration 026). The legacy canEditQuery (above)
      // still gates the "Answer" button and other respond/reopen actions —
      // close is its own discrete permission.
      canCloseQuery:      p.canCloseQueryOnField,
      canEditQuery:       p.canRespondQuery || p.canResolveQuery || p.canReopenQuery,
      canDeleteQuery:     p.canDeleteQuery,
      canVerify:          p.canVerifyField,
      canEditField:       p.canEditForm,
      canSubmitForm:      p.canSubmitForm,

      // ─ Data-capture form-lifecycle actions (migrations 021 + 022) ─
      canComplete:        p.canCompleteForm,
      canReview:          p.canReviewForm,
      canSign:            p.canSignForm,
      canFreeze:          p.canFreezeForm,
      canLock:            p.canLockForm,

      // ─ Phase 1/3 form-status gates (re-exposed for useFormGate) ─
      canApproveForm:     p.canApproveForm,

      _hasWorkspace:   true,
      _hasPermissions: p.raw != null,
    };
  }, [p, study]);
}
