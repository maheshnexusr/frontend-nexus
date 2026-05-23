/**
 * useFormGate — combines role capabilities with the form's current status
 * and (optionally) a field's lock/freeze state to produce the effective
 * gate for any action on the runner.
 *
 * Status rules (form-wide):
 *   In Progress  — fully editable (subject to role caps)
 *   Completed    — fully editable; "Mark Reviewed" / "Verify" available
 *   Reviewed     — editable by DM; CRA can verify
 *   Verified     — editable by DM only; queries still possible
 *   Frozen       — read-only; only Unfreeze (with reason) restores edits
 *   Locked       — read-only everywhere; only Unlock can reopen
 *   Signed       — read-only; signature can be revoked only by signer/admin
 *
 * Field-level lock/freeze beats the form-level status:
 *   - A frozen field blocks edits even when the form is "In Progress"
 *   - A locked field cannot have queries raised / resolved
 *
 * The returned object mirrors useFieldCapabilities' shape and overrides
 * any capability that the status/lock state forbids.
 */

import { useSelector } from 'react-redux';
import { selectFormStatus, selectFieldLock, READ_ONLY_STATUSES } from '@/features/cro/store/formRuntimeSlice';
import { useFieldCapabilities } from './useFieldCapabilities';

export function useFormGate(fieldId) {
  const caps        = useFieldCapabilities();
  const formStatus  = useSelector(selectFormStatus);
  const fieldLock   = useSelector(fieldId ? selectFieldLock(fieldId) : (() => ({})));

  const formReadOnly  = READ_ONLY_STATUSES.has(formStatus);
  const fieldReadOnly = !!(fieldLock?.locked || fieldLock?.frozen);
  const anyReadOnly   = formReadOnly || fieldReadOnly;

  return {
    // Forward all capabilities so callers can keep one source of truth.
    ...caps,

    // Status + lock summary
    formStatus,
    fieldLock,
    formReadOnly,
    fieldReadOnly,
    anyReadOnly,

    // Override write capabilities when the status / lock forbids them.
    // Note: viewing actions are NOT gated by status — users can always
    // browse history, see existing queries, see verifications.
    canEditField:   caps.canEditField   && !anyReadOnly,
    canCreateQuery: caps.canCreateQuery && !anyReadOnly,
    canEditQuery:   caps.canEditQuery   && !formReadOnly, // field lock doesn't block query lifecycle
    canDeleteQuery: caps.canDeleteQuery && !formReadOnly,
    canVerify:      caps.canVerify      && !formReadOnly,
    canSubmitForm:  caps.canSubmitForm  && !formReadOnly,

    // Per-status transition gates — used by the runner footer to decide
    // which action buttons to show. `canEditField` already collapses to
    // false in read-only statuses; these decide the next legal transition.
    canMarkCompleted:  formStatus === 'In Progress' && caps.canEditField,
    // Marking the form Reviewed is a data-capture workflow transition — gate it
    // on data_capture.edit, consistent with the other toolbar transitions, so a
    // view-only role (e.g. Query Manager with no data_capture.edit) can't move
    // the form's status.
    canMarkReviewed:   formStatus === 'Completed'   && caps.canEditField,
    canMarkVerified:   formStatus === 'Reviewed'    && caps.canVerify,
    // Freeze / lock / sign — each gated by its own data_capture permission
    // (migration 021), combined with the workflow-state rule.
    canFreezeForm:     !['Frozen', 'Locked', 'Signed'].includes(formStatus) && caps.canFreeze,
    canUnfreezeForm:   formStatus === 'Frozen'      && caps.canFreeze,
    canLockForm:       !['Locked', 'Signed'].includes(formStatus) && caps.canLock,
    canUnlockForm:     formStatus === 'Locked'      && caps.canLock,
    canSignForm:       ['Verified', 'Reviewed', 'Completed', 'Approved'].includes(formStatus) && caps.canSign,
    canRevokeSignature: formStatus === 'Signed'     && caps.canSign,

    // Phase 3 — Medical Reviewer approval
    canApproveForm:    ['Verified', 'Reviewed', 'Completed'].includes(formStatus) && caps.canVerify,
    canRevokeApproval: formStatus === 'Approved'    && caps.canVerify,
  };
}
