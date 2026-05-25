/**
 * SFBRight — Right properties panel.
 * Shows field properties when a field is selected,
 * otherwise shows page/block properties.
 */
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Trash2, Copy, Plus, ChevronDown, ChevronUp, Minus, Settings, LayoutGrid, Eye, EyeOff, Lock, FilePen, Check, MessageSquare, StickyNote, HelpCircle, Paperclip, BadgeCheck, Eraser } from 'lucide-react';
import {
  selectActiveBlock, selectActivePage, selectActiveField, selectAllFields,
  selectBlocks,
  updateField, removeField, duplicateField, deselectField,
  updatePage, updateBlock,
} from '@/features/cro/store/studyFormSlice';
import { selectStep3 } from '@/features/cro/store/studyWizardSlice';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
import { activityLogService } from '@/services/activityLogService';
import { usePermissions } from '@/features/auth/usePermissions';
import s from './SFBRight.module.css';

export default function SFBRight() {
  const block    = useSelector(selectActiveBlock);
  const page     = useSelector(selectActivePage);
  const field    = useSelector(selectActiveField);

  if (field && page && block) {
    return <FieldPropsPanel block={block} page={page} field={field} />;
  }
  if (page && block) {
    return <PagePropsPanel block={block} page={page} />;
  }
  return <EmptyPanel />;
}

/* ── Empty panel ──────────────────────────────────────────────────────────*/
function EmptyPanel() {
  return (
    <div className={s.panel}>
      <div className={s.emptyState}>
        <p className={s.emptyTitle}>Properties</p>
        <p className={s.emptyDesc}>Select a field to edit its properties, or click a page in the left panel.</p>
      </div>
    </div>
  );
}

/* ── Page/Block properties ────────────────────────────────────────────────*/
function PagePropsPanel({ block, page }) {
  const dispatch = useDispatch();
  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.headerTitle}>Page Properties</span>
      </div>
      <div className={s.body}>
        <Section title="Page" defaultOpen>
          <Row label="Title">
            <input
              className={s.input}
              value={page.title}
              onChange={(e) => dispatch(updatePage({ blockId: block.id, pageId: page.id, updates: { title: e.target.value } }))}
            />
          </Row>
          <Row label="Description" top>
            <textarea
              className={s.textarea}
              rows={2}
              value={page.description}
              onChange={(e) => dispatch(updatePage({ blockId: block.id, pageId: page.id, updates: { description: e.target.value } }))}
              placeholder="Optional description"
            />
          </Row>
        </Section>
        <Section title="Block">
          <Row label="Title">
            <input
              className={s.input}
              value={block.title}
              onChange={(e) => dispatch(updateBlock({ blockId: block.id, updates: { title: e.target.value } }))}
            />
          </Row>
          <Row label="Description" top>
            <textarea
              className={s.textarea}
              rows={2}
              value={block.description}
              onChange={(e) => dispatch(updateBlock({ blockId: block.id, updates: { description: e.target.value } }))}
              placeholder="Optional description"
            />
          </Row>
        </Section>
      </div>
    </div>
  );
}

/* ── Field properties ─────────────────────────────────────────────────────*/
function FieldPropsPanel({ block, page, field }) {
  const dispatch  = useDispatch();
  const allFields = useSelector(selectAllFields);
  const step3     = useSelector(selectStep3);
  const queryManagerEnabled        = !!step3?.queryManager;
  const verificationManagerEnabled = !!step3?.verificationManager;
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Studies-permission gates for author-only sections. Hidden entirely from
  // CRO team members who don't have the permission — that way an author can
  // still configure validation rules / appearance without seeing Conditional
  // Visibility or Collaboration accordions they aren't allowed to author.
  const { has } = usePermissions();
  const canEditConditions    = has('studies', 'conditional_visibility');
  const canEditCollaboration = has('studies', 'collaboration');

  const handleDelete = () => {
    dispatch(removeField({ blockId: block.id, pageId: page.id, fieldId: field.id }));
    activityLogService.record({
      actionType:  'DELETE',
      module:      'Study Form Builder',
      entityType:  'Control',
      entityId:    field.id,
      entityName:  field.label || field.type,
      description: `Deleted ${field.type} control "${field.label || field.id}" via the properties panel.`,
      beforeValue: { type: field.type, label: field.label, required: field.required ?? false },
    });
  };

  const up       = (k, v) => dispatch(updateField({ blockId: block.id, pageId: page.id, fieldId: field.id, updates: { [k]: v } }));
  const upV      = (k, v) => up('validation',   { ...field.validation,   [k]: v });
  const upC      = (k, v) => up('condition',    { ...field.condition,    [k]: v });
  const upCollab = (k, v) => up('collaboration', { ...field.collaboration, [k]: v });

  const isLayout   = ['h2', 'paragraph', 'divider'].includes(field.type);
  const hasOptions = ['select','multiselect','radiogroup','checkboxgroup'].includes(field.type);
  const isText     = ['text','textarea','email','phone','url','password'].includes(field.type);
  const isNum      = field.type === 'number' || field.type === 'slider';

  return (
    <div className={s.panel}>
      {/* Header */}
      <div className={s.header}>
        <span className={s.fieldTypePill}>{field.type}</span>
        <div className={s.headerActions}>
          <button className={s.iconBtn} title="Duplicate" onClick={() => dispatch(duplicateField({ blockId: block.id, pageId: page.id, fieldId: field.id }))}>
            <Copy size={13} />
          </button>
          <button className={`${s.iconBtn} ${s.iconBtnDanger}`} title="Delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} />
          </button>
          <ConfirmDialog
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            title="Delete control?"
            message={`This will permanently remove the "${field.label || field.type}" control. Any data or queries already captured for this control will be inaccessible. This action cannot be undone.`}
            confirmLabel="Delete control"
            variant="danger"
          />
          <button className={s.iconBtn} onClick={() => dispatch(deselectField())}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Accordion body — sections */}
      <div className={s.body}>
        <Accordion title="Field Configuration" icon={<Settings size={13} />} defaultOpen>
          <GeneralTab field={field} up={up} hasOptions={hasOptions} isLayout={isLayout} />
        </Accordion>

        {!isLayout && (
          <Accordion title="Appearance & Layout" icon={<LayoutGrid size={13} />}>
            <AppearanceTab field={field} up={up} />
          </Accordion>
        )}

        {!isLayout && (
          <Accordion title="Validation Rules">
            <ValidationTab field={field} up={up} upV={upV} isText={isText} isNum={isNum} />
          </Accordion>
        )}

        {!isLayout && canEditConditions && (
          <Accordion title="Conditional Behavior">
            <LogicTab field={field} block={block} page={page} allFields={allFields} />
          </Accordion>
        )}

        {canEditCollaboration && (
          <Accordion title="Collaboration & Audit Tools">
            <CommentsTab
              field={field}
              upCollab={upCollab}
              queryManagerEnabled={queryManagerEnabled}
              verificationManagerEnabled={verificationManagerEnabled}
            />
          </Accordion>
        )}
      </div>
    </div>
  );
}

/* ── General Tab (Field Configuration) ───────────────────────────────────*/
function toFieldKey(label) {
  return (label ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function GeneralTab({ field, up, hasOptions, isLayout }) {
  const isH       = field.type === 'h2';
  const isPara    = field.type === 'paragraph';
  const isDivider = field.type === 'divider';

  // Auto-generate field key when label changes (only if key not manually set)
  const handleLabelChange = (val) => {
    up('label', val);
    if (!field.fieldKeyManual) {
      up('fieldKey', toFieldKey(val));
    }
  };

  if (isDivider) {
    return (
      <div className={s.accordionBodyInner}>
        <p className={s.hintText}>Divider has no configurable properties.</p>
      </div>
    );
  }

  if (isH || isPara) {
    return (
      <div className={s.accordionBodyInner}>
        <SField label="Content">
          <textarea
            className={s.stextarea}
            rows={3}
            value={field.content ?? field.label}
            onChange={(e) => up(isH ? 'label' : 'content', e.target.value)}
            placeholder={isH ? 'Section title…' : 'Paragraph text…'}
          />
        </SField>
      </div>
    );
  }

  return (
    <div className={s.accordionBodyInner}>
      <SField label="Field Label">
        <input
          className={s.sinput}
          value={field.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Text Input Field"
        />
      </SField>

      <SField label="Field Key">
        <input
          className={s.sinput}
          value={field.fieldKey ?? toFieldKey(field.label)}
          onChange={(e) => { up('fieldKey', e.target.value); up('fieldKeyManual', true); }}
          placeholder="text_input_field"
        />
      </SField>

      {['text','textarea','email','phone','number','password','url'].includes(field.type) && (
        <SField label="Placeholder Text">
          <input
            className={s.sinput}
            value={field.placeholder ?? ''}
            onChange={(e) => up('placeholder', e.target.value)}
            placeholder="Enter text..."
          />
        </SField>
      )}

      <SField label="Default Value">
        <input
          className={s.sinput}
          value={field.defaultValue ?? ''}
          onChange={(e) => up('defaultValue', e.target.value)}
          placeholder="Enter default value"
        />
      </SField>

      <SField label="Help Text">
        <textarea
          className={s.stextarea}
          rows={2}
          value={field.helpText ?? ''}
          onChange={(e) => up('helpText', e.target.value)}
          placeholder="Provide guidance or instructions"
        />
      </SField>

      <div className={s.toggleRow}>
        <span className={s.toggleRowLabel}>Read-only</span>
        <Toggle value={field.readOnly ?? false} onChange={(v) => up('readOnly', v)} />
      </div>

      <div className={s.toggleRow}>
        <span className={s.toggleRowLabel}>Hidden by Default</span>
        <Toggle value={field.hiddenByDefault ?? false} onChange={(v) => up('hiddenByDefault', v)} />
      </div>

      {field.type === 'select' && (
        <Row label="Allow multiple selections">
          <Toggle value={!!field.multiple} onChange={(v) => up('multiple', v)} />
        </Row>
      )}

      {field.type === 'slider' && (
        <>
          <SField label="Min Value">
            <input
              type="number"
              className={s.sinput}
              value={field.minValue ?? 0}
              onChange={(e) => up('minValue', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
            />
          </SField>
          <SField label="Max Value">
            <input
              type="number"
              className={s.sinput}
              value={field.maxValue ?? 100}
              onChange={(e) => up('maxValue', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="100"
            />
          </SField>
          <SField label="Step">
            <input
              type="number"
              className={s.sinput}
              value={field.step ?? 1}
              onChange={(e) => up('step', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="1"
              min="0"
            />
          </SField>
        </>
      )}

      {hasOptions && (
        <>
          <div className={s.subSectionLabel}>Options</div>
          <OptionsEditor options={field.options ?? []} onChange={(opts) => up('options', opts)} />
        </>
      )}
    </div>
  );
}

/* ── Appearance & Layout Tab ──────────────────────────────────────────────*/
function AppearanceTab({ field, up }) {
  return (
    <div className={s.accordionBodyInner}>
      <SField label="Field Width">
        <select
          className={s.sselect}
          value={field.fieldWidth ?? 'full'}
          onChange={(e) => up('fieldWidth', e.target.value)}
        >
          <option value="full">Full Width</option>
          <option value="half">Half Width</option>
          <option value="third">One Third</option>
          <option value="two-thirds">Two Thirds</option>
        </select>
      </SField>

      <SField label="Alignment">
        <select
          className={s.sselect}
          value={field.alignment ?? 'left'}
          onChange={(e) => up('alignment', e.target.value)}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </SField>
    </div>
  );
}

/* ── Validation Tab ───────────────────────────────────────────────────────*/
function ValidationTab({ field, up, upV, isText, isNum }) {
  const v = field.validation ?? {};
  return (
    <div className={s.accordionBodyInner}>

      {/* Required Field — stored at field root, not inside validation */}
      <div className={s.toggleRow}>
        <span className={s.toggleRowLabel}>Required Field</span>
        <Toggle
          value={field.required ?? false}
          onChange={(val) => {
            up('required', val);
            // Seed the default message the first time Required is turned on.
            if (val && !field.requiredMessage) {
              up('requiredMessage', 'Field is required');
            }
          }}
        />
      </div>

      {field.required && (
        <div className={s.sfield}>
          <span className={s.sfieldLabel}>Required Message</span>
          <input
            className={s.sinput}
            value={field.requiredMessage ?? 'Field is required'}
            onChange={(e) => up('requiredMessage', e.target.value)}
            placeholder="Field is required"
          />
        </div>
      )}

      {/* Text: Min + Max side by side, then Pattern */}
      {isText && (
        <>
          <div className={s.twoColRow}>
            <div className={s.twoColField}>
              <span className={s.sfieldLabel}>Min Length</span>
              <input
                className={s.sinput}
                type="number"
                min={0}
                value={v.minLength ?? ''}
                onChange={(e) => upV('minLength', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className={s.twoColField}>
              <span className={s.sfieldLabel}>Max Length</span>
              <input
                className={s.sinput}
                type="number"
                min={0}
                value={v.maxLength ?? ''}
                onChange={(e) => upV('maxLength', e.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          <div className={s.sfield}>
            <div className={s.sfieldLabelRow}>
              <span className={s.sfieldLabel}>Pattern (Regex)</span>
              <span className={s.infoIcon} title="Use a regular expression to validate input format">?</span>
            </div>
            <input
              className={s.sinput}
              value={v.pattern ?? ''}
              onChange={(e) => upV('pattern', e.target.value)}
              placeholder="^[A-Za-z0-9]+$"
            />
            <div className={s.regexHints}>
              {[
                { label: 'Email',        val: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
                { label: 'Phone',        val: '^\\d{10}$' },
                { label: 'Alphanumeric', val: '^[a-zA-Z0-9]+$' },
              ].map((p) => (
                <button key={p.label} className={s.regexHintBtn} onClick={() => upV('pattern', p.val)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Number: Min + Max side by side */}
      {isNum && (
        <div className={s.twoColRow}>
          <div className={s.twoColField}>
            <span className={s.sfieldLabel}>Min Value</span>
            <input
              className={s.sinput}
              type="number"
              value={v.min ?? ''}
              onChange={(e) => upV('min', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className={s.twoColField}>
            <span className={s.sfieldLabel}>Max Value</span>
            <input
              className={s.sinput}
              type="number"
              value={v.max ?? ''}
              onChange={(e) => upV('max', e.target.value)}
              placeholder="100"
            />
          </div>
        </div>
      )}

      {!isText && !isNum && (
        <p className={s.hintText}>No additional validation for this field type.</p>
      )}
    </div>
  );
}

/* ── Conditional Logic Tab ────────────────────────────────────────────────*/
function LogicTab({ field, block, page, allFields }) {
  const [open, setOpen] = useState(false);
  const cond  = field.condition ?? {};
  const count = (cond.rules ?? []).length;

  return (
    <div className={s.accordionBodyInner}>
      <p className={s.condDesc}>Control field visibility based on other field values</p>
      {count > 0 && (
        <p className={s.condActive}>{count} condition{count !== 1 ? 's' : ''} active</p>
      )}
      <button className={s.configureBtn} onClick={() => setOpen(true)}>
        <Settings size={13} /> Configure
      </button>
      {open && (
        <ConditionalModal
          field={field}
          block={block}
          page={page}
          allFields={allFields}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Conditional Logic Modal ──────────────────────────────────────────────*/
const COND_ACTIONS = [
  { value: 'show',     label: 'Show this field',                        Icon: Eye     },
  { value: 'hide',     label: 'Hide this field',                        Icon: EyeOff  },
  { value: 'readonly', label: 'Make this field read-only',              Icon: Lock    },
  { value: 'editable', label: 'Make this field editable (override read-only)', Icon: FilePen },
];

const MODAL_OPERATORS = [
  { value: 'is',          label: 'is'          },
  { value: 'is_not',      label: 'is not'      },
  { value: 'contains',    label: 'contains'    },
  { value: 'gt',          label: '>'           },
  { value: 'lt',          label: '<'           },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with',   label: 'ends with'   },
];

function ConditionalModal({ field, block, page, allFields, onClose }) {
  const dispatch = useDispatch();
  const blocks   = useSelector(selectBlocks);

  const saved = field.condition ?? { action: 'show', rules: [] };
  const [action,      setAction]      = useState(saved.action ?? 'show');
  const [rules,       setRules]       = useState(saved.rules  ?? []);
  const [actionOpen,  setActionOpen]  = useState(false);
  const [operDropIdx, setOperDropIdx] = useState(null); // which rule's operator dropdown is open

  // Look up the source block + page + field options for a rule, with cascading.
  const blockById = (id) => blocks.find((b) => b.id === id);
  const pagesFor  = (blockId) => blockById(blockId)?.pages ?? [];
  const fieldsFor = (blockId, pageId) => {
    const b = blockById(blockId);
    if (!b) return [];
    const p = b.pages.find((pp) => pp.id === pageId);
    return (p?.fields ?? []).filter((f) => f.id !== field.id);
  };

  // New rules default to the current field's block/page so the field dropdown
  // is immediately populated.
  const addRule = () =>
    setRules((r) => [
      ...r,
      { blockId: block.id, pageId: page.id, fieldId: '', operator: 'is', value: '' },
    ]);
  const delRule = (i) => setRules((r) => r.filter((_, j) => j !== i));
  const updateRule = (i, patch) =>
    setRules((r) => r.map((rule, j) => (j === i ? { ...rule, ...patch } : rule)));

  const save = () => {
    dispatch(updateField({
      blockId: block.id, pageId: page.id, fieldId: field.id,
      updates: { condition: { action, rules } },
    }));
    onClose();
  };

  const selectedAction = COND_ACTIONS.find((a) => a.value === action) ?? COND_ACTIONS[0];

  return (
    <div className={s.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>

        {/* Modal header */}
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>Conditional Visibility — {field.label || field.type}</h3>
          <button className={s.modalClose} onClick={onClose}><X size={15} /></button>
        </div>

        {/* Modal body */}
        <div className={s.modalBody}>

          {/* When conditions are met */}
          <div className={s.modalSection}>
            <label className={s.modalLabel}>When conditions are met</label>
            <div className={s.customSelect} onClick={() => { setActionOpen((v) => !v); setOperDropIdx(null); }}>
              <span className={s.customSelectVal}>
                <selectedAction.Icon size={14} className={s.customSelectIcon} />
                {selectedAction.label}
              </span>
              <ChevronDown size={14} className={s.customSelectChev} style={{ transform: actionOpen ? 'rotate(180deg)' : 'none' }} />
              {actionOpen && (
                <div className={s.customDropdown}>
                  {COND_ACTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`${s.customDropdownItem} ${opt.value === action ? s.customDropdownItemActive : ''}`}
                      onClick={(e) => { e.stopPropagation(); setAction(opt.value); setActionOpen(false); }}
                    >
                      {opt.value === action && <Check size={13} className={s.dropItemCheck} />}
                      <opt.Icon size={14} className={s.dropItemIcon} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className={s.modalSection}>
            <div className={s.condHeader}>
              <span className={s.modalLabel}>Conditions</span>
              <button className={s.addCondBtn} onClick={addRule}>
                <Plus size={13} /> Add Condition
              </button>
            </div>

            {rules.length === 0 ? (
              <div className={s.condEmpty}>
                <p className={s.condEmptyTitle}>No conditions configured yet.</p>
                <p className={s.condEmptySub}>Click "Add Condition" to create your first condition.</p>
              </div>
            ) : (
              <div className={s.condRows}>
                {/* Column headers */}
                <div className={s.condColHeaders}>
                  <span>Block</span>
                  <span>Page</span>
                  <span>Field</span>
                  <span>Operator</span>
                  <span>Value</span>
                  <span />
                </div>

                {rules.map((rule, i) => {
                  const pages  = pagesFor(rule.blockId);
                  const fields = fieldsFor(rule.blockId, rule.pageId);
                  // Resolve the source field so we can pick the right Value control.
                  const srcField    = fields.find((f) => f.id === rule.fieldId);
                  const srcOptions  = srcField?.options ?? [];
                  const srcType     = srcField?.type ?? '';
                  const useOptionDD = srcOptions.length > 0
                    && ['select', 'multiselect', 'radiogroup', 'checkboxgroup'].includes(srcType);
                  const useBoolDD   = ['toggle', 'checkbox'].includes(srcType);
                  return (
                    <div key={i} className={s.condRow}>
                      {/* Block — top-level cascade */}
                      <select
                        className={s.condRowSelect}
                        value={rule.blockId ?? ''}
                        onChange={(e) =>
                          updateRule(i, { blockId: e.target.value, pageId: '', fieldId: '' })
                        }
                      >
                        <option value="">Select block</option>
                        {blocks.map((b) => (
                          <option key={b.id} value={b.id}>{b.title || 'Untitled block'}</option>
                        ))}
                      </select>

                      {/* Page — filtered by block */}
                      <select
                        className={s.condRowSelect}
                        value={rule.pageId ?? ''}
                        onChange={(e) =>
                          updateRule(i, { pageId: e.target.value, fieldId: '' })
                        }
                        disabled={!rule.blockId}
                      >
                        <option value="">{rule.blockId ? 'Select page' : '—'}</option>
                        {pages.map((p) => (
                          <option key={p.id} value={p.id}>{p.title || 'Untitled page'}</option>
                        ))}
                      </select>

                      {/* Field — filtered by page */}
                      <select
                        className={s.condRowSelect}
                        value={rule.fieldId ?? ''}
                        onChange={(e) => updateRule(i, { fieldId: e.target.value })}
                        disabled={!rule.pageId}
                      >
                        <option value="">{rule.pageId ? 'Select field' : '—'}</option>
                        {fields.map((f) => (
                          <option key={f.id} value={f.id}>{f.label || f.type}</option>
                        ))}
                      </select>

                      {/* Operator — custom dropdown */}
                      <div
                        className={s.condOperWrap}
                        onClick={() => setOperDropIdx(operDropIdx === i ? null : i)}
                      >
                        <span className={s.condOperVal}>
                          {MODAL_OPERATORS.find((o) => o.value === rule.operator)?.label ?? 'is'}
                        </span>
                        <ChevronDown size={12} />
                        {operDropIdx === i && (
                          <div className={s.operDropdown}>
                            {MODAL_OPERATORS.map((op) => (
                              <button
                                key={op.value}
                                className={`${s.operDropItem} ${rule.operator === op.value ? s.operDropItemActive : ''}`}
                                onClick={(e) => { e.stopPropagation(); updateRule(i, { operator: op.value }); setOperDropIdx(null); }}
                              >
                                {rule.operator === op.value && <Check size={12} />}
                                {op.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Value — dropdown when the source field has predefined
                          options, otherwise a plain text input. */}
                      {useOptionDD ? (
                        <select
                          className={s.condRowSelect}
                          value={rule.value ?? ''}
                          onChange={(e) => updateRule(i, { value: e.target.value })}
                          disabled={!rule.fieldId}
                        >
                          <option value="">Select value</option>
                          {srcOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : useBoolDD ? (
                        <select
                          className={s.condRowSelect}
                          value={rule.value ?? ''}
                          onChange={(e) => updateRule(i, { value: e.target.value })}
                          disabled={!rule.fieldId}
                        >
                          <option value="">Select value</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          className={s.condRowInput}
                          value={rule.value ?? ''}
                          onChange={(e) => updateRule(i, { value: e.target.value })}
                          placeholder="Enter value"
                          disabled={!rule.fieldId}
                        />
                      )}

                      {/* Delete */}
                      <button className={s.condRowDel} onClick={() => delRule(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div className={s.modalFooter}>
          <button className={s.modalBtnCancel} onClick={onClose}>Cancel</button>
          <button className={s.modalBtnSave} onClick={save}>Save Changes</button>
        </div>

      </div>
    </div>
  );
}

/* ── Comments Tab ──────────────────────────────────────────────────────── */
/* ── Collaboration features config ────────────────────────────────────────*/
const COLLAB_FEATURES = [
  {
    key:   'annotations',
    label: 'Annotations',
    desc:  'Allow adding annotations to this field',
    Icon:  MessageSquare,
  },
  {
    key:   'notes',
    label: 'Notes',
    desc:  'Enable notes for this field',
    Icon:  StickyNote,
  },
  {
    key:   'queries',
    label: 'Queries',
    desc:  'Allow raising queries on this field',
    Icon:  HelpCircle,
  },
  {
    key:   'attachments',
    label: 'Attachments',
    desc:  'Enable file attachments',
    Icon:  Paperclip,
  },
  {
    key:   'verification',
    label: 'Verification',
    desc:  'Enable field verification in test mode',
    Icon:  BadgeCheck,
  },
  {
    key:   'clear',
    label: 'Clear',
    desc:  'Allow clearing field data in test mode',
    Icon:  Eraser,
  },
];

function CommentsTab({ field, upCollab, queryManagerEnabled, verificationManagerEnabled }) {
  const collab = field.collaboration ?? {};
  // Step 3 toggles drive which collaboration rows appear:
  //   • `queries` row is hidden when Query Manager is off
  //   • `verification` row is hidden when Verification Manager is off
  // Other rows (Annotations / Notes / Attachments / Clear) are always visible.
  const features = COLLAB_FEATURES.filter((f) => {
    if (f.key === 'queries')      return queryManagerEnabled;
    if (f.key === 'verification') return verificationManagerEnabled;
    return true;
  });
  return (
    <div className={s.collabWrap}>
      <p className={s.collabHint}>Enable collaboration features for this field</p>
      {features.map(({ key, label, desc, Icon }) => (
        <div key={key} className={s.collabRow}>
          <div className={s.collabLeft}>
            <span className={s.collabIcon}><Icon size={15} /></span>
            <div className={s.collabText}>
              <span className={s.collabLabel}>{label}</span>
              <span className={s.collabDesc}>{desc}</span>
            </div>
          </div>
          <Toggle value={collab[key] ?? false} onChange={(v) => upCollab(key, v)} />
        </div>
      ))}
      {!queryManagerEnabled && (
        <p className={s.collabHint} style={{ marginTop: 6, fontStyle: 'italic' }}>
          Enable Query Manager in study configuration to allow queries on fields.
        </p>
      )}
      {!verificationManagerEnabled && (
        <p className={s.collabHint} style={{ marginTop: 6, fontStyle: 'italic' }}>
          Enable Verification Manager in study configuration to allow field verification.
        </p>
      )}
    </div>
  );
}

/* ── Shared primitives ────────────────────────────────────────────────────*/

/** Top-level accordion matching the screenshot style */
function Accordion({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={s.accordion}>
      <button className={s.accordionHeader} onClick={() => setOpen((v) => !v)}>
        <span className={s.accordionTitleWrap}>
          {icon && <span className={s.accordionIcon}>{icon}</span>}
          <span className={s.accordionTitle}>{title}</span>
        </span>
        {open ? <ChevronUp size={15} className={s.accordionChevron} /> : <ChevronDown size={15} className={s.accordionChevron} />}
      </button>
      {open && <div className={s.accordionBody}>{children}</div>}
    </div>
  );
}

/** Stacked field row: label above, control below */
function SField({ label, children }) {
  return (
    <div className={s.sfield}>
      <span className={s.sfieldLabel}>{label}</span>
      {children}
    </div>
  );
}

/** Inner sub-section used within accordion bodies */
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={s.section}>
      <button className={s.sectionHeader} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        {open ? <Minus size={11} style={{ color: '#94a3b8' }} /> : <Plus size={11} style={{ color: '#94a3b8' }} />}
      </button>
      {open && <div className={s.sectionBody}>{children}</div>}
    </div>
  );
}

function Row({ label, top = false, children }) {
  return (
    <div className={`${s.row} ${top ? s.rowTop : ''}`}>
      <span className={s.rowLabel}>{label}</span>
      <div className={s.rowControl}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      className={s.toggle}
      style={{ background: value ? 'var(--color-primary, #2563eb)' : '#cbd5e1' }}
      onClick={() => onChange(!value)}
    >
      <span className={s.toggleThumb} style={{ transform: value ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}

function OptionsEditor({ options, onChange }) {
  const update = (i, k, v) => onChange(options.map((o, j) => j === i ? { ...o, [k]: v } : o));
  const remove = (i) => onChange(options.filter((_, j) => j !== i));
  const add    = () => { const n = options.length + 1; onChange([...options, { label: `Option ${n}`, value: `opt_${n}` }]); };
  return (
    <div>
      {options.map((opt, i) => (
        <div key={i} className={s.optRow}>
          <input className={s.optInput} value={opt.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Label" />
          <input className={s.optInput} value={opt.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="Value" />
          <button className={s.optDel} onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className={s.addBtn} onClick={add}><Plus size={12} /> Add option</button>
    </div>
  );
}
