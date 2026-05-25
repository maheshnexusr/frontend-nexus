/**
 * RuntimeFieldRenderer — wraps any field input with the runtime collaboration
 * stack: toolbar, badges, validation messages, conditional show/hide/disable,
 * and modals/drawers for annotations, notes, queries, attachments,
 * verification, and audit history.
 *
 * Usage:
 *   <RuntimeFieldRenderer
 *     field={fieldConfig}
 *     value={fieldValue}                  // optional; falls back to runtime store
 *     onChange={(v) => …}                 // optional; falls back to runtime store
 *     allValues={mapOfFieldIdToValue}     // for conditional logic evaluation
 *   >
 *     {(props) => <YourFieldInput {...props} />}
 *   </RuntimeFieldRenderer>
 *
 * `field.collaboration` toggles individual toolbar actions (set in the form
 * builder's Comments tab on the right panel):
 *   field.collaboration = {
 *     annotations: true, notes: true, queries: true,
 *     attachments: true, verification: true, clear: false,
 *   }
 *
 * Anything missing/false hides that action; audit is always available.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setFieldValue, clearField, setValidationError,
  selectFieldValue, selectFieldErrors,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import FieldToolbar         from './FieldToolbar';
import CollaborationBadges  from './CollaborationBadges';
import CollaborationChips   from './CollaborationChips';
import { useFieldCapabilities } from './useFieldCapabilities';
import { useFormGate } from './useFormGate';
import { Lock, Snowflake } from 'lucide-react';
import AnnotationModal      from './AnnotationModal';
import NotesPopover         from './NotesPopover';
import QueryDrawer          from './QueryDrawer';
import AttachmentDrawer     from './AttachmentDrawer';
import VerificationPanel    from './VerificationPanel';
import AuditTimeline        from './AuditTimeline';
import { validateField, evaluateField } from './runtimeEngine';
import s from './runtime.module.css';

export default function RuntimeFieldRenderer({
  field,
  value: extValue,
  onChange: extOnChange,
  allValues,
  children,
}) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const caps     = useFieldCapabilities();
  const gate     = useFormGate(field.id);
  const me       = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  // Use runtime store as source of truth if the parent didn't provide
  // controlled value/onChange. Hybrid mode also fine — external takes
  // precedence when defined.
  const runtimeVal = useSelector(selectFieldValue(field.id));
  const value      = extValue !== undefined ? extValue : runtimeVal;
  const errFromStore = useSelector(selectFieldErrors(field.id));

  const handleChange = (next) => {
    if (extOnChange) {
      extOnChange(next);
    }
    // Mirror to runtime store regardless so collaboration / audit see it.
    dispatch(setFieldValue({
      fieldId: field.id, value: next, label: field.label, ...me,
    }));
  };

  // Conditional logic — evaluate once per render against allValues.
  const evalResult = useMemo(
    () => evaluateField(field, allValues ?? {}),
    [field, allValues],
  );

  // setValue / clearValue side-effects driven by logic rules.
  useEffect(() => {
    if (evalResult.clearValue && value !== undefined && value !== '' && value !== null) {
      handleChange('');
    }
    if (Object.prototype.hasOwnProperty.call(evalResult, 'setValue') && evalResult.setValue !== value) {
      handleChange(evalResult.setValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalResult.clearValue, evalResult.setValue]);

  // Validation runs on every value change; we also surface store-level errors.
  const localErr = useMemo(
    () => validateField({ ...field, required: evalResult.required }, value),
    [field, evalResult.required, value],
  );
  useEffect(() => {
    dispatch(setValidationError({ fieldId: field.id, error: localErr }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localErr]);

  const error = errFromStore || localErr;

  // One workflow open at a time per field, anchored to whatever was clicked.
  const [open, setOpen] = useState(null); // 'annotations' | 'notes' | 'queries' | 'attachments' | 'verification' | 'audit'
  const [anchorRect, setAnchorRect] = useState(null);
  const wrapRef = useRef(null);

  const openWith = (kind, rect) => {
    // Use the click anchor if provided, otherwise fall back to the field row.
    setAnchorRect(rect ?? wrapRef.current?.getBoundingClientRect() ?? null);

    if (kind === 'clear') {
      dispatch(clearField({ fieldId: field.id, ...me }));
      handleChange('');
      return;
    }
    // Map both singular (toolbar) and plural (badge) kinds to a single state.
    const map = {
      annotation: 'annotations', annotations: 'annotations',
      note:       'notes',       notes:       'notes',
      query:      'queries',     queries:     'queries',
      attachment: 'attachments', attachments: 'attachments',
      verification: 'verification',
      audit:      'audit',
    };
    setOpen(map[kind] ?? kind);
  };

  // Conditional hide → render nothing.
  if (evalResult.hidden) return null;

  // Field input is disabled when:
  //   - rule logic flagged it as disabled, OR
  //   - the form's overall status forbids edits (Locked/Frozen/Signed), OR
  //   - the field itself is locked/frozen, OR
  //   - the user lacks `canEditField` capability.
  const isDisabled = evalResult.disabled || !gate.canEditField;
  const lockedMeta = gate.fieldLock || {};

  return (
    <div
      ref={wrapRef}
      className={`${s.fieldWrap} ${isDisabled ? s.disabled : ''}`}
      data-field-id={field.id}
    >
      <div className={s.fieldHead}>
        <div className={s.labelGroup}>
          <div className={s.labelRow}>
            {field.label && (
              <span className={s.label}>
                {field.label}
                {evalResult.required && <span className={s.req}>*</span>}
                {lockedMeta.locked && (
                  <Lock
                    size={11}
                    style={{ marginLeft: 6, color: '#92400e', verticalAlign: 'middle' }}
                    aria-label="Locked"
                    title={`Locked by ${lockedMeta.byName ?? 'system'}${lockedMeta.reason ? ` — ${lockedMeta.reason}` : ''}`}
                  />
                )}
                {lockedMeta.frozen && (
                  <Snowflake
                    size={11}
                    style={{ marginLeft: 6, color: '#1e40af', verticalAlign: 'middle' }}
                    aria-label="Frozen"
                    title={`Frozen by ${lockedMeta.byName ?? 'system'}${lockedMeta.reason ? ` — ${lockedMeta.reason}` : ''}`}
                  />
                )}
              </span>
            )}
            <CollaborationBadges fieldId={field.id} onOpen={openWith} />
          </div>
          {field.helpText && <p className={s.help}>{field.helpText}</p>}
        </div>

        <div className={s.fieldHeadActions}>
          <CollaborationChips
            fieldId={field.id}
            collaboration={field.collaboration}
            capabilities={gate}
            onOpen={openWith}
          />
          <FieldToolbar
            enabled={field.collaboration}
            capabilities={gate}
            onAction={openWith}
          />
        </div>
      </div>

      {/* Field input — render-prop pattern keeps the wrapper agnostic of types. */}
      {typeof children === 'function'
        ? children({ field, value, onChange: handleChange, disabled: isDisabled })
        : children}

      {error && <div className={s.errorMsg}>⚠ {error}</div>}

      {/* ── Workflow surfaces (every one is a Popover anchored to anchorRect) */}
      {open === 'annotations' && (
        <AnnotationModal
          fieldId={field.id}
          fieldLabel={field.label || field.id}
          anchorRect={anchorRect}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'notes' && (
        <NotesPopover
          fieldId={field.id}
          fieldLabel={field.label || field.id}
          anchorRect={anchorRect}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'queries' && (
        <QueryDrawer
          fieldId={field.id}
          fieldLabel={field.label || field.id}
          anchorRect={anchorRect}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'attachments' && (
        <AttachmentDrawer
          fieldId={field.id}
          fieldLabel={field.label || field.id}
          anchorRect={anchorRect}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'verification' && (
        <VerificationPanel
          fieldId={field.id}
          fieldLabel={field.label || field.id}
          fieldValue={value}
          anchorRect={anchorRect}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'audit' && (
        <AuditTimeline
          fieldId={field.id}
          fieldLabel={field.label || field.id}
          anchorRect={anchorRect}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
