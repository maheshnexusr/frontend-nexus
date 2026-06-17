/**
 * SFBRight — Right properties panel.
 * Shows field properties when a field is selected,
 * otherwise shows page/block properties.
 */
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { X, Trash2, Copy, Plus, ChevronDown, ChevronUp, Minus, Settings, LayoutGrid, Eye, EyeOff, Lock, FilePen, Check, MessageSquare, StickyNote, HelpCircle, Paperclip, BadgeCheck, Eraser, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import {
  selectActiveBlock, selectActivePage, selectActiveField, selectAllFields,
  selectBlocks,
  updateField, removeField, duplicateField, deselectField,
  updatePage, updateBlock, makeChildField,
} from '@/features/cro/store/studyFormSlice';
import { selectStep3 } from '@/features/cro/store/studyWizardSlice';
import { REGEX_PRESETS } from '@/features/form-builder/lib/fieldSchema';
import { TableConfigPanel, ColumnBuilder } from './tableConfig';
import FormulaBuilder from './FormulaBuilder';
import {
  HEADING_FONT_SIZES, HEADING_FONT_WEIGHTS, HEADING_ALIGNMENTS,
  HEADING_THEME_COLORS, headingStyleToCss,
} from './headingStyle';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
import { activityLogService } from '@/services/activityLogService';
import { usePermissions } from '@/features/auth/usePermissions';
import s from './SFBRight.module.css';

/* Rich-text Paragraph editor (display-only field). Toolbar is scoped to the
   spec: bold / italic / underline, bulleted + numbered lists, and hyperlink.
   Output is stored as HTML on field.content and rendered verbatim at runtime. */
const PARA_QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};
const PARA_QUILL_FORMATS = ['bold', 'italic', 'underline', 'list', 'bullet', 'link'];

/* Accepted-file presets for file/image fields. The picker is multi-select;
   the chosen presets compose into field.accept (the native input accept attr)
   so the runtime + preview keep reading a single string. */
const FILE_TYPE_PRESETS = [
  { key: 'images',    label: 'Images (JPG, PNG)',                       exts: ['.jpg', '.jpeg', '.png'] },
  { key: 'documents', label: 'Documents (PDF, XLSX, DOCX, PPT, CSV)',   exts: ['.pdf', '.xlsx', '.docx', '.ppt', '.pptx', '.csv'] },
];
const acceptFromPresets = (keys = []) =>
  FILE_TYPE_PRESETS.filter((p) => keys.includes(p.key)).flatMap((p) => p.exts).join(',');
const presetsFromAccept = (accept) => {
  if (!accept) return [];
  const lower = accept.toLowerCase();
  return FILE_TYPE_PRESETS.filter((p) => p.exts.some((e) => lower.includes(e))).map((p) => p.key);
};

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
  const { has }  = usePermissions();
  const canEditConditions = has('studies', 'conditional_visibility');
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

        {/* Page-level conditional visibility (Show / Hide / Read-Only). */}
        {canEditConditions && (
          <Section title="Page Conditional Behavior">
            <LogicTab
              level="page"
              saved={page.condition}
              block={block}
              page={page}
              onSave={(condition) => dispatch(updatePage({
                blockId: block.id, pageId: page.id, updates: { condition },
              }))}
            />
          </Section>
        )}

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

        {/* Block-level conditional visibility (applies to the whole block). */}
        {canEditConditions && (
          <Section title="Block Conditional Behavior">
            <LogicTab
              level="block"
              saved={block.condition}
              block={block}
              page={page}
              onSave={(condition) => dispatch(updateBlock({
                blockId: block.id, updates: { condition },
              }))}
            />
          </Section>
        )}
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
  const upH      = (k, v) => up('headingStyle', { ...field.headingStyle, [k]: v });

  const isLayout   = ['h2', 'h3', 'paragraph', 'divider'].includes(field.type);
  const isTable    = field.type === 'table';
  const isFormula  = field.type === 'formula';
  const isHeading  = field.type === 'h2' || field.type === 'h3';
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

        {isHeading && (
          <Accordion title="Heading Style" icon={<Type size={13} />} defaultOpen>
            <HeadingStyleTab field={field} upH={upH} />
          </Accordion>
        )}

        {isTable && (
          <>
            <Accordion title="Table Settings" icon={<LayoutGrid size={13} />} defaultOpen>
              <TableConfigPanel field={field} up={up} />
            </Accordion>
            <Accordion title="Columns" icon={<Settings size={13} />} defaultOpen>
              <ColumnBuilder field={field} up={up} />
            </Accordion>
          </>
        )}

        {isFormula && (
          <Accordion title="Formula Builder" icon={<Settings size={13} />} defaultOpen>
            <FormulaBuilder field={field} up={up} />
          </Accordion>
        )}

        {!isLayout && !isTable && !isFormula && (
          <Accordion title="Appearance & Layout" icon={<LayoutGrid size={13} />}>
            <AppearanceTab field={field} up={up} />
          </Accordion>
        )}

        {!isLayout && !isTable && !isFormula && (
          <Accordion title="Validation Rules">
            <ValidationTab field={field} up={up} upV={upV} isText={isText} isNum={isNum} />
          </Accordion>
        )}

        {!isLayout && canEditConditions && (
          <Accordion title="Conditional Behavior">
            <LogicTab
              level="field"
              saved={field.condition}
              block={block}
              page={page}
              currentFieldId={field.id}
              onSave={(condition) => dispatch(updateField({
                blockId: block.id, pageId: page.id, fieldId: field.id, updates: { condition },
              }))}
            />
            {/* Hidden-field data policy — default RETAIN; opt in to clear. */}
            <div className={s.toggleRow} style={{ marginTop: 8 }}>
              <span className={s.toggleRowLabel}>Clear data when hidden</span>
              <Toggle value={field.clearOnHide ?? false} onChange={(v) => up('clearOnHide', v)} />
            </div>
            <p className={s.condDesc} style={{ marginTop: 4 }}>
              When on, this field’s value is cleared if a condition hides it. Default keeps the data.
            </p>
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
  const isH       = field.type === 'h2' || field.type === 'h3';
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

  if (isPara) {
    // Rich-text paragraph — Quill editor; HTML stored on field.content. An empty
    // editor serialises to '<p><br></p>', which we normalise back to '' so the
    // runtime falls back to placeholder text.
    return (
      <div className={s.accordionBodyInner}>
        <SField label="Content">
          <div className={s.paraQuillWrap}>
            <ReactQuill
              theme="snow"
              value={field.content ?? ''}
              onChange={(html) => up('content', html === '<p><br></p>' ? '' : html)}
              modules={PARA_QUILL_MODULES}
              formats={PARA_QUILL_FORMATS}
              placeholder="Paragraph text…"
            />
          </div>
        </SField>
      </div>
    );
  }
  if (isH) {
    return (
      <div className={s.accordionBodyInner}>
        <SField label="Content">
          <textarea
            className={s.stextarea}
            rows={3}
            value={field.content ?? field.label}
            onChange={(e) => up('label', e.target.value)}
            placeholder={field.type === 'h3' ? 'Sub-heading…' : 'Section title…'}
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

      {field.type !== 'table' && (
        <SField label="Default Value">
          <input
            className={s.sinput}
            value={field.defaultValue ?? ''}
            onChange={(e) => up('defaultValue', e.target.value)}
            placeholder="Enter default value"
          />
        </SField>
      )}

      <SField label="Help Text">
        <textarea
          className={s.stextarea}
          rows={2}
          value={field.helpText ?? ''}
          onChange={(e) => up('helpText', e.target.value)}
          placeholder="Provide guidance or instructions"
        />
      </SField>

      {/* Formula fields are always read-only — the toggle is hidden for them. */}
      {field.type !== 'formula' && (
        <div className={s.toggleRow}>
          <span className={s.toggleRowLabel}>Read-only</span>
          <Toggle value={field.readOnly ?? false} onChange={(v) => up('readOnly', v)} />
        </div>
      )}

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

      {/* File / Attachment control properties */}
      {['file','image','multifile','multiimage'].includes(field.type) && (() => {
        // field.multiple is authoritative when set; legacy fields fall back to
        // their multi-variant type. Single vs multi is now a toggle, not the type.
        const fileMulti = field.multiple != null
          ? !!field.multiple
          : ['multifile','multiimage'].includes(field.type);
        const presets = field.acceptPresets ?? presetsFromAccept(field.accept);
        return (
        <>
          <div className={s.subSectionLabel}>Attachment</div>
          <SField label="Accepted Types">
            <AcceptTypePicker
              value={presets}
              onChange={(keys) => {
                up('acceptPresets', keys);
                up('accept', acceptFromPresets(keys));
              }}
            />
          </SField>
          <div className={s.toggleRow}>
            <span className={s.toggleRowLabel}>Allow multiple files</span>
            <Toggle value={fileMulti} onChange={(v) => up('multiple', v)} />
          </div>
          <SField label="Max Size (MB)">
            <input
              className={s.sinput}
              type="number"
              min={1}
              value={field.maxSize ?? 5}
              onChange={(e) => up('maxSize', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="5"
            />
          </SField>
          {fileMulti && (
            <SField label="Max Files">
              <input
                className={s.sinput}
                type="number"
                min={1}
                value={field.maxFiles ?? 10}
                onChange={(e) => up('maxFiles', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="10"
              />
            </SField>
          )}
        </>
        );
      })()}

      {/* Radio / checkbox group — default selection + "Other" option */}
      {['radiogroup','checkboxgroup'].includes(field.type) && (
        <>
          {field.type === 'radiogroup' && (
            <SField label="Default Selected Value">
              <select className={s.sselect} value={field.defaultValue ?? ''} onChange={(e) => up('defaultValue', e.target.value)}>
                <option value="">— None —</option>
                {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </SField>
          )}
          {field.type === 'checkboxgroup' && (
            <div className={s.sfield}>
              <span className={s.sfieldLabel}>Default Selected Values</span>
              {(field.options ?? []).map((o) => {
                const sel = Array.isArray(field.defaultValues) ? field.defaultValues : [];
                const on = sel.includes(o.value);
                return (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', padding: '2px 0' }}>
                    <input type="checkbox" checked={on} onChange={() => up('defaultValues', on ? sel.filter((x) => x !== o.value) : [...sel, o.value])} />
                    {o.label}
                  </label>
                );
              })}
            </div>
          )}

          <div className={s.toggleRow}>
            <span className={s.toggleRowLabel}>Allow &quot;Other&quot;</span>
            <Toggle value={field.allowOther ?? false} onChange={(v) => up('allowOther', v)} />
          </div>
          {field.allowOther && (
            <>
              <SField label="Other Label">
                <input className={s.sinput} value={field.otherLabel ?? 'Other'} onChange={(e) => up('otherLabel', e.target.value)} />
              </SField>
              <div className={s.toggleRow}>
                <span className={s.toggleRowLabel}>Free text entry</span>
                <Toggle value={field.otherFreeText !== false} onChange={(v) => up('otherFreeText', v)} />
              </div>
            </>
          )}

          {field.type === 'checkboxgroup' && (
            <>
              <div className={s.toggleRow}>
                <span className={s.toggleRowLabel}>Allow additional input per option</span>
                <Toggle value={field.allowOptionInput ?? false} onChange={(v) => up('allowOptionInput', v)} />
              </div>
              {field.allowOptionInput && (
                <OptionInputEditor options={field.options ?? []} onChange={(opts) => up('options', opts)} />
              )}
            </>
          )}
        </>
      )}

      {/* Option-based child fields — reveal dependent inputs when an option is
          selected. Available on radio / checkbox / dropdown / multi-select. */}
      {['radiogroup','checkboxgroup','select','multiselect'].includes(field.type) && (
        <>
          <div className={s.subSectionLabel}>Child Fields</div>
          <div className={s.toggleRow}>
            <span className={s.toggleRowLabel}>Enable child fields per option</span>
            <Toggle value={field.enableOptionChildren ?? false} onChange={(v) => up('enableOptionChildren', v)} />
          </div>
          {field.enableOptionChildren && (
            <>
              <div className={s.toggleRow}>
                <span className={s.toggleRowLabel}>Clear child values when option deselected</span>
                <Toggle value={field.clearChildOnDeselect !== false} onChange={(v) => up('clearChildOnDeselect', v)} />
              </div>
              <OptionChildEditor options={field.options ?? []} onChange={(opts) => up('options', opts)} />
            </>
          )}
        </>
      )}

      {/* Conditional auto-selection — auto check/uncheck an option (and force its
          child fields required/optional) when a condition over other fields is
          met. Checkbox group only. */}
      {field.type === 'checkboxgroup' && (
        <>
          <div className={s.subSectionLabel}>Auto-Selection</div>
          <div className={s.toggleRow}>
            <span className={s.toggleRowLabel}>Enable auto-selection rules</span>
            <Toggle value={field.enableOptionAutoSelect ?? false} onChange={(v) => up('enableOptionAutoSelect', v)} />
          </div>
          {field.enableOptionAutoSelect && (
            <OptionAutoSelectEditor options={field.options ?? []} currentFieldId={field.id} onChange={(opts) => up('options', opts)} />
          )}
        </>
      )}

      {/* Checkbox group — advanced + audit */}
      {field.type === 'checkboxgroup' && (
        <>
          <div className={s.subSectionLabel}>Advanced</div>
          <div className={s.toggleRow}><span className={s.toggleRowLabel}>Select all option</span><Toggle value={field.selectAll ?? false} onChange={(v) => up('selectAll', v)} /></div>
          <div className={s.toggleRow}><span className={s.toggleRowLabel}>Randomize order</span><Toggle value={field.randomizeOptions ?? false} onChange={(v) => up('randomizeOptions', v)} /></div>
          <div className={s.toggleRow}><span className={s.toggleRowLabel}>Display option codes</span><Toggle value={field.displayCodes ?? false} onChange={(v) => up('displayCodes', v)} /></div>
          <div className={s.subSectionLabel}>Audit &amp; Compliance</div>
          <div className={s.toggleRow}><span className={s.toggleRowLabel}>Capture audit trail</span><Toggle value={field.captureAudit !== false} onChange={(v) => up('captureAudit', v)} /></div>
          <div className={s.toggleRow}><span className={s.toggleRowLabel}>Track value changes</span><Toggle value={field.trackChanges !== false} onChange={(v) => up('trackChanges', v)} /></div>
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
          <option value="full">Full width (100%)</option>
          <option value="left">Half — left (50%)</option>
          <option value="right">Half — right (50%)</option>
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

      {['radiogroup','checkboxgroup'].includes(field.type) && (
        <SField label="Display Orientation">
          <select
            className={s.sselect}
            value={field.orientation ?? 'vertical'}
            onChange={(e) => up('orientation', e.target.value)}
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </SField>
      )}
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
          onChange={(val) => up('required', val)}
        />
      </div>

      {field.required && (
        <>
          {/* Hard vs Soft are MUTUALLY EXCLUSIVE — a required field is either a
              hard block or a soft warning, never both. Toggling one off-sets the
              other so the author can't accidentally leave hard on. */}
          {/* Hard check — default ON. Blocks Save/Submit/Next. */}
          <div className={s.toggleRow}>
            <span className={s.toggleRowLabel}>Hard check</span>
            <Toggle
              value={field.hardCheck !== false}
              onChange={(val) => {
                up('hardCheck', val);
                if (val) up('softCheck', false);
              }}
            />
          </div>
          {field.hardCheck !== false && (
            <div className={s.sfield}>
              <span className={s.sfieldLabel}>Error Message</span>
              <input
                className={s.sinput}
                value={field.hardMessage ?? ''}
                onChange={(e) => up('hardMessage', e.target.value)}
                placeholder="{Field Name} is required."
              />
            </div>
          )}

          {/* Soft check — warning only; user can continue (Save / Next / Submit). */}
          <div className={s.toggleRow}>
            <span className={s.toggleRowLabel}>Soft check</span>
            <Toggle
              value={field.softCheck ?? false}
              onChange={(val) => {
                up('softCheck', val);
                if (val) up('hardCheck', false);
              }}
            />
          </div>
          {field.softCheck && (
            <div className={s.sfield}>
              <span className={s.sfieldLabel}>Warning Message</span>
              <input
                className={s.sinput}
                value={field.softMessage ?? ''}
                onChange={(e) => up('softMessage', e.target.value)}
                placeholder="Please review {Field Name} before continuing."
              />
            </div>
          )}

          <p className={s.hintText}>
            Hard check blocks Save/Submit/Next until a value is entered. Soft check shows a
            warning only — the user can still save and continue. Use {'{Field Name}'} as a placeholder.
          </p>
        </>
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
            <span className={s.sfieldLabel}>Pattern (Regex)</span>
            <RegexPatternPicker
              preset={v.patternPreset ?? ''}
              pattern={v.pattern ?? ''}
              onChange={(preset, regex) => up('validation', { ...v, patternPreset: preset, pattern: regex })}
            />
          </div>
        </>
      )}

      {/* Checkbox group — min / max selections */}
      {field.type === 'checkboxgroup' && (
        <div className={s.twoColRow}>
          <div className={s.twoColField}>
            <span className={s.sfieldLabel}>Min Selections</span>
            <input className={s.sinput} type="number" min={0} value={field.minSelections ?? ''} onChange={(e) => up('minSelections', e.target.value)} placeholder="0" />
          </div>
          <div className={s.twoColField}>
            <span className={s.sfieldLabel}>Max Selections</span>
            <input className={s.sinput} type="number" min={0} value={field.maxSelections ?? ''} onChange={(e) => up('maxSelections', e.target.value)} placeholder="—" />
          </div>
        </div>
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

      {/* Date / datetime: selectable-date Display Settings */}
      {(field.type === 'date' || field.type === 'datetime') && (
        <DateDisplaySettings field={field} up={up} />
      )}

      {!isText && !isNum && field.type !== 'checkboxgroup' && field.type !== 'date' && field.type !== 'datetime' && (
        <p className={s.hintText}>No additional validation for this field type.</p>
      )}
    </div>
  );
}

/* ── Date "Display Settings" — restrict which dates are selectable ──────────*/
const DATE_MODES = [
  { value: 'none',           label: 'No restrictions (any date)' },
  { value: 'past_current',   label: 'Past and current dates' },
  { value: 'future_only',    label: 'Future dates only' },
  { value: 'current_future', label: 'Current and future dates' },
  { value: 'custom',         label: 'Custom date range' },
];
const DATE_MIN_TYPES = [
  { value: 'none',         label: 'No minimum' },
  { value: 'static',       label: 'Static date' },
  { value: 'current',      label: 'Current date' },
  { value: 'minus_days',   label: 'Current date − X days' },
  { value: 'minus_months', label: 'Current date − X months' },
  { value: 'minus_years',  label: 'Current date − X years' },
];
const DATE_MAX_TYPES = [
  { value: 'none',        label: 'No maximum' },
  { value: 'static',      label: 'Static date' },
  { value: 'current',     label: 'Current date' },
  { value: 'plus_days',   label: 'Current date + X days' },
  { value: 'plus_months', label: 'Current date + X months' },
  { value: 'plus_years',  label: 'Current date + X years' },
];
function DateDisplaySettings({ field, up }) {
  const dd = field.dateDisplay ?? { mode: 'none' };
  const setDD  = (patch) => up('dateDisplay', { ...dd, ...patch });
  const setMin = (patch) => setDD({ min: { ...(dd.min ?? { type: 'none' }), ...patch } });
  const setMax = (patch) => setDD({ max: { ...(dd.max ?? { type: 'none' }), ...patch } });
  const min = dd.min ?? { type: 'none' };
  const max = dd.max ?? { type: 'none' };
  const minAmt = ['minus_days', 'minus_months', 'minus_years'].includes(min.type);
  const maxAmt = ['plus_days', 'plus_months', 'plus_years'].includes(max.type);
  return (
    <>
      <div className={s.subSectionLabel}>Display Settings</div>
      <SField label="Selectable dates">
        <select className={s.sselect} value={dd.mode ?? 'none'} onChange={(e) => setDD({ mode: e.target.value })}>
          {DATE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </SField>
      {dd.mode === 'custom' && (
        <>
          <SField label="Minimum date">
            <select className={s.sselect} value={min.type ?? 'none'} onChange={(e) => setMin({ type: e.target.value })}>
              {DATE_MIN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </SField>
          {min.type === 'static' && (
            <SField label="Minimum (static date)">
              <input type="date" className={s.sinput} value={min.date ?? ''} onChange={(e) => setMin({ date: e.target.value })} />
            </SField>
          )}
          {minAmt && (
            <SField label="Days / Months / Years">
              <input type="number" min={0} className={s.sinput} value={min.amount ?? ''} onChange={(e) => setMin({ amount: e.target.value })} placeholder="e.g. 6" />
            </SField>
          )}
          <SField label="Maximum date">
            <select className={s.sselect} value={max.type ?? 'none'} onChange={(e) => setMax({ type: e.target.value })}>
              {DATE_MAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </SField>
          {max.type === 'static' && (
            <SField label="Maximum (static date)">
              <input type="date" className={s.sinput} value={max.date ?? ''} onChange={(e) => setMax({ date: e.target.value })} />
            </SField>
          )}
          {maxAmt && (
            <SField label="Days / Months / Years">
              <input type="number" min={0} className={s.sinput} value={max.amount ?? ''} onChange={(e) => setMax({ amount: e.target.value })} placeholder="e.g. 6" />
            </SField>
          )}
        </>
      )}
      {dd.mode !== 'none' && (
        <SField label="Validation message (optional)">
          <input className={s.sinput} value={dd.message ?? ''} onChange={(e) => setDD({ message: e.target.value })} placeholder="Please select a date within the last 6 months." />
        </SField>
      )}
    </>
  );
}

/* ── Pattern (Regex) preset picker + ? library popover ────────────────────*/
function RegexPatternPicker({ preset, pattern, onChange }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const grouped = REGEX_PRESETS.reduce((acc, r) => { (acc[r.category] ??= []).push(r); return acc; }, {});
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          className={s.sselect}
          style={{ flex: 1 }}
          value={preset}
          onChange={(e) => {
            const p = REGEX_PRESETS.find((r) => r.name === e.target.value);
            onChange(e.target.value, p ? p.regex : (e.target.value === '' ? '' : pattern));
          }}
        >
          <option value="">No pattern</option>
          {Object.entries(grouped).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" style={regexHelpBtn} title="Browse / copy patterns" onClick={() => setHelpOpen(true)}>
          <HelpCircle size={14} />
        </button>
      </div>
      {pattern && (
        <input
          className={s.sinput}
          style={{ fontFamily: 'monospace', fontSize: 11 }}
          value={pattern}
          onChange={(e) => onChange(preset, e.target.value)}
          placeholder="Regular expression"
        />
      )}
      {helpOpen && <RegexHelpModal onClose={() => setHelpOpen(false)} onInsert={(r) => { onChange(r.name, r.regex); setHelpOpen(false); }} />}
    </div>
  );
}

function RegexHelpModal({ onClose, onInsert }) {
  const [copied, setCopied] = useState('');
  const [q, setQ] = useState('');
  const list = REGEX_PRESETS.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.category.toLowerCase().includes(q.toLowerCase()),
  );
  const copy = (r) => {
    navigator.clipboard?.writeText(r.regex).catch(() => {});
    setCopied(r.name);
    setTimeout(() => setCopied(''), 1200);
  };
  return (
    <div style={rxOverlay} onClick={onClose}>
      <div style={rxModal} onClick={(e) => e.stopPropagation()}>
        <div style={rxHead}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Pattern Library</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <input className={s.sinput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patterns…" autoFocus />
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto', padding: '0 8px 12px' }}>
          {list.map((r) => (
            <div key={r.name} style={rxRow}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{r.name}</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{r.category}</div>
                <code style={{ fontSize: 11, color: '#2563eb', wordBreak: 'break-all' }}>{r.regex}</code>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>e.g. {r.example}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button type="button" style={rxBtn} onClick={() => copy(r)} title="Copy">
                  {copied === r.name ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button type="button" style={{ ...rxBtn, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} onClick={() => onInsert(r)} title="Insert">Insert</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const regexHelpBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0, cursor: 'pointer', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 };
const rxOverlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
const rxModal = { width: 'min(520px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' };
const rxHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #e2e8f0' };
const rxRow = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px', borderBottom: '1px solid #f1f5f9' };
const rxBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 6, cursor: 'pointer' };

/* ── Conditional Logic Tab — reusable for field / page / block ─────────────*/
// `level` = 'field' | 'page' | 'block'. `saved` is the existing condition;
// `onSave(condition)` persists it (the caller dispatches updateField/Page/Block).
function LogicTab({ level, saved, block, page, currentFieldId, onSave }) {
  const [open, setOpen] = useState(false);
  const count = (saved?.rules ?? []).length;
  const noun  = level === 'block' ? 'block' : level === 'page' ? 'page' : 'field';

  return (
    <div className={s.accordionBodyInner}>
      <p className={s.condDesc}>Show, hide, or lock this {noun} based on other field values</p>
      {count > 0 && (
        <p className={s.condActive}>{count} condition{count !== 1 ? 's' : ''} active</p>
      )}
      <button className={s.configureBtn} onClick={() => setOpen(true)}>
        <Settings size={13} /> Configure
      </button>
      {open && (
        <ConditionalModal
          level={level}
          saved={saved}
          block={block}
          page={page}
          currentFieldId={currentFieldId}
          onSave={onSave}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Conditional Logic Modal ──────────────────────────────────────────────*/
// Actions are the same Show / Hide / Read-Only across all three levels (field /
// page / block); "editable" is an extra field-only override of a static
// read-only. Labels adapt to the target noun.
function actionsForLevel(level) {
  const noun = level === 'block' ? 'block' : level === 'page' ? 'page' : 'field';
  const base = [
    { value: 'show',     label: `Show this ${noun}`,            Icon: Eye    },
    { value: 'hide',     label: `Hide this ${noun}`,            Icon: EyeOff },
    { value: 'readonly', label: `Make this ${noun} read-only`,  Icon: Lock   },
  ];
  if (level === 'field') {
    base.push({ value: 'editable', label: 'Make this field editable (override read-only)', Icon: FilePen });
  }
  return base;
}

// Operator vocabulary per the spec's per-control-type table. Values are the
// canonical operator codes understood by runtimeEngine.compareOp.
const OP_LABELS = {
  equals: 'Equals', not_equals: 'Not Equals',
  contains: 'Contains', does_not_contain: 'Does Not Contain',
  starts_with: 'Starts With', ends_with: 'Ends With',
  is_empty: 'Is Empty', is_not_empty: 'Is Not Empty',
  greater_than: 'Greater Than', less_than: 'Less Than',
  gte: 'Greater Than or Equal To', lte: 'Less Than or Equal To', between: 'Between',
  in_list: 'In List', not_in_list: 'Not In List',
  includes_any: 'Includes Any', includes_all: 'Includes All',
  checked: 'Checked', unchecked: 'Unchecked', on: 'On', off: 'Off',
  uploaded: 'Uploaded', not_uploaded: 'Not Uploaded',
  signed: 'Signed', not_signed: 'Not Signed', before: 'Before', after: 'After',
  // legacy codes (older saved conditions) so they still render a sensible label
  is: 'Equals', is_not: 'Not Equals', gt: 'Greater Than', lt: 'Less Than',
};
// Operators that take no value (the source field's own state is the test).
const NO_VALUE_OPS = new Set([
  'is_empty', 'is_not_empty', 'checked', 'unchecked', 'on', 'off',
  'uploaded', 'not_uploaded', 'signed', 'not_signed',
]);
const opItems = (...keys) => keys.map((k) => ({ value: k, label: OP_LABELS[k] }));

function operatorsForType(type) {
  switch (type) {
    case 'text': case 'textarea':
      return opItems('equals', 'not_equals', 'contains', 'does_not_contain', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty');
    case 'email':
      return opItems('equals', 'contains', 'ends_with', 'is_empty', 'is_not_empty');
    case 'phone':
      return opItems('equals', 'contains', 'starts_with', 'is_empty', 'is_not_empty');
    case 'number': case 'calculated': case 'formula': case 'derived':
      return opItems('equals', 'not_equals', 'greater_than', 'less_than', 'gte', 'lte', 'between', 'is_empty');
    case 'slider':
      return opItems('equals', 'not_equals', 'greater_than', 'less_than', 'gte', 'lte', 'between');
    case 'date': case 'datetime':
      return opItems('equals', 'before', 'after', 'between', 'is_empty');
    case 'time':
      return opItems('equals', 'before', 'after', 'between');
    case 'select': case 'dropdown':
      return opItems('equals', 'not_equals', 'in_list', 'not_in_list', 'is_empty');
    case 'multiselect':
      return opItems('contains', 'does_not_contain', 'includes_any', 'includes_all', 'is_empty');
    case 'radiogroup': case 'radio':
      return opItems('equals', 'not_equals');
    case 'checkbox':
      return opItems('checked', 'unchecked');
    case 'checkboxgroup':
      return opItems('contains', 'does_not_contain', 'includes_any', 'includes_all');
    case 'toggle': case 'switch':
      return opItems('on', 'off');
    case 'file':
      return opItems('uploaded', 'not_uploaded');
    case 'signature':
      return opItems('signed', 'not_signed');
    case 'autocomplete': case 'search':
      return opItems('equals', 'not_equals', 'contains');
    case 'table':
      return opItems('is_empty', 'is_not_empty');
    default:
      return opItems('equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty');
  }
}

function ConditionalModal({ level = 'field', saved: savedProp, block, page, currentFieldId, onSave, onClose }) {
  const blocks   = useSelector(selectBlocks);
  const COND_ACTIONS = actionsForLevel(level);

  const saved = savedProp ?? { action: 'show', rules: [], match: 'all' };
  // Saved rules come back snake_cased from the API (block_id/page_id/field_id);
  // normalise to the camelCase keys this editor uses so re-editing shows the
  // saved Block/Page/Field selections.
  const normRule = (r) => ({
    blockId:  r.blockId  ?? r.block_id  ?? '',
    pageId:   r.pageId   ?? r.page_id   ?? '',
    fieldId:  r.fieldId  ?? r.field_id  ?? '',
    operator: r.operator ?? 'equals',
    value:    r.value    ?? '',
  });
  const [action,      setAction]      = useState(saved.action ?? 'show');
  const [match,       setMatch]       = useState(saved.match  ?? 'all');
  const [rules,       setRules]       = useState((saved.rules ?? []).map(normRule));
  const [actionOpen,  setActionOpen]  = useState(false);
  const [operDropIdx, setOperDropIdx] = useState(null); // which rule's operator dropdown is open

  // Look up the source block + page + field options for a rule, with cascading.
  const blockById = (id) => blocks.find((b) => b.id === id);
  const pagesFor  = (blockId) => blockById(blockId)?.pages ?? [];
  const fieldsFor = (blockId, pageId) => {
    const b = blockById(blockId);
    if (!b) return [];
    const p = b.pages.find((pp) => pp.id === pageId);
    // A field's own rule can't reference itself; page/block rules can reference
    // any field.
    return (p?.fields ?? []).filter((f) => f.id !== currentFieldId);
  };
  const fieldType = (blockId, pageId, fieldId) =>
    fieldsFor(blockId, pageId).find((f) => f.id === fieldId)?.type ?? '';

  // New rules default to the current block/page so the field dropdown is
  // immediately populated.
  const addRule = () =>
    setRules((r) => [
      ...r,
      { blockId: block?.id ?? '', pageId: page?.id ?? '', fieldId: '', operator: 'equals', value: '' },
    ]);
  const delRule = (i) => setRules((r) => r.filter((_, j) => j !== i));
  const updateRule = (i, patch) =>
    setRules((r) => r.map((rule, j) => (j === i ? { ...rule, ...patch } : rule)));

  const save = () => {
    onSave?.({ action, match, rules });
    onClose();
  };

  const selectedAction = COND_ACTIONS.find((a) => a.value === action) ?? COND_ACTIONS[0];
  const targetLabel = level === 'block' ? (block?.title || 'Block')
    : level === 'page' ? (page?.title || 'Page')
    : 'Field';

  return (
    <div className={s.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>

        {/* Modal header */}
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>Conditional Visibility — {targetLabel}</h3>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* AND/OR combinator — only meaningful with 2+ conditions. */}
                {rules.length > 1 && (
                  <div style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    {[{ v: 'all', l: 'Match ALL (AND)' }, { v: 'any', l: 'Match ANY (OR)' }].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setMatch(o.v)}
                        style={{
                          padding: '3px 8px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                          background: match === o.v ? '#2563eb' : '#fff',
                          color: match === o.v ? '#fff' : '#475569',
                        }}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                )}
                <button className={s.addCondBtn} onClick={addRule}>
                  <Plus size={13} /> Add Condition
                </button>
              </div>
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
                  // Resolve the source field so we can pick the right operator
                  // set + Value control for its control type.
                  const srcField    = fields.find((f) => f.id === rule.fieldId);
                  const srcOptions  = srcField?.options ?? [];
                  const srcType     = srcField?.type ?? '';
                  const operators   = operatorsForType(srcType);
                  const noValue     = NO_VALUE_OPS.has(rule.operator);
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

                      {/* Field — filtered by page. Changing the source field
                          resets the operator to one valid for its control type. */}
                      <select
                        className={s.condRowSelect}
                        value={rule.fieldId ?? ''}
                        onChange={(e) => {
                          const newId   = e.target.value;
                          const newType = fields.find((f) => f.id === newId)?.type ?? '';
                          updateRule(i, { fieldId: newId, operator: operatorsForType(newType)[0]?.value ?? 'equals', value: '' });
                        }}
                        disabled={!rule.pageId}
                      >
                        <option value="">{rule.pageId ? 'Select field' : '—'}</option>
                        {fields.map((f) => (
                          <option key={f.id} value={f.id}>{f.label || f.type}</option>
                        ))}
                      </select>

                      {/* Operator — per-control-type dropdown */}
                      <div
                        className={s.condOperWrap}
                        onClick={() => setOperDropIdx(operDropIdx === i ? null : i)}
                      >
                        <span className={s.condOperVal}>
                          {OP_LABELS[rule.operator] ?? 'Equals'}
                        </span>
                        <ChevronDown size={12} />
                        {operDropIdx === i && (
                          <div className={s.operDropdown}>
                            {operators.map((op) => (
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

                      {/* Value — hidden for operators that test the field's own
                          state (Is Empty, Checked, Uploaded…); a dropdown when
                          the source field has predefined options; else a text
                          input (comma-separate for Between / In List). */}
                      {noValue ? (
                        <span className={s.condOperVal} style={{ opacity: 0.5, fontSize: 11, alignSelf: 'center' }}>
                          (no value)
                        </span>
                      ) : useOptionDD ? (
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
                          placeholder={rule.operator === 'between' ? 'min, max'
                            : (rule.operator === 'in_list' || rule.operator === 'not_in_list') ? 'a, b, c'
                            : 'Enter value'}
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
/* ── Heading Style Tab ───────────────────────────────────────────────────*/
// Visual styling for h2/h3 headings: theme presets, text + highlight colors,
// font size/weight, alignment — with a live preview. Persisted on
// `field.headingStyle` and rendered identically by the canvas, preview and
// runtime via headingStyleToCss().
function HeadingStyleTab({ field, upH }) {
  const hs = field.headingStyle ?? {};

  const segBtn = (active) => ({
    flex: 1, padding: '6px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1px solid ' + (active ? '#2563eb' : '#cbd5e1'),
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1d4ed8' : '#475569',
    borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  });

  const previewStyle = headingStyleToCss(field) ?? {};
  const PreviewTag = field.type === 'h3' ? 'h3' : 'h2';

  return (
    <div className={s.accordionBodyInner}>
      {/* Theme presets — set text + highlight together for consistency. */}
      <SField label="Theme Color">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {HEADING_THEME_COLORS.map((t) => {
            const active = (hs.textColor ?? '') === t.text && (hs.bgColor ?? '') === t.bg;
            return (
              <button
                key={t.name}
                type="button"
                title={t.name}
                onClick={() => { upH('textColor', t.text); upH('bgColor', t.bg); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                  border: '1px solid ' + (active ? '#2563eb' : '#e2e8f0'),
                  background: active ? '#eff6ff' : '#fff', color: '#475569',
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 4, border: '1px solid #cbd5e1',
                  background: t.bg || '#fff',
                  color: t.text || '#0f172a', fontSize: 10, lineHeight: '12px', textAlign: 'center',
                }}>A</span>
                {t.name}
              </button>
            );
          })}
        </div>
      </SField>

      <SField label="Text Color">
        <ColorControl value={hs.textColor ?? ''} onChange={(v) => upH('textColor', v)} fallback="#0f172a" />
      </SField>

      <SField label="Background Highlight">
        <ColorControl value={hs.bgColor ?? ''} onChange={(v) => upH('bgColor', v)} fallback="#f1f5f9" />
      </SField>

      <SField label="Font Size">
        <div style={{ display: 'flex', gap: 6 }}>
          {HEADING_FONT_SIZES.map((o) => (
            <button key={o.value} type="button" style={segBtn(hs.fontSize === o.value)}
              onClick={() => upH('fontSize', hs.fontSize === o.value ? '' : o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </SField>

      <SField label="Font Weight">
        <div style={{ display: 'flex', gap: 6 }}>
          {HEADING_FONT_WEIGHTS.map((o) => (
            <button key={o.value} type="button" style={segBtn(hs.fontWeight === o.value)}
              onClick={() => upH('fontWeight', hs.fontWeight === o.value ? '' : o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </SField>

      <SField label="Text Alignment">
        <div style={{ display: 'flex', gap: 6 }}>
          {HEADING_ALIGNMENTS.map((o) => {
            const Icon = o.value === 'left' ? AlignLeft : o.value === 'center' ? AlignCenter : AlignRight;
            return (
              <button key={o.value} type="button" title={o.label} style={segBtn(hs.align === o.value)}
                onClick={() => upH('align', hs.align === o.value ? '' : o.value)}>
                <Icon size={14} /> {o.label}
              </button>
            );
          })}
        </div>
      </SField>

      {/* Live preview */}
      <SField label="Preview">
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, background: '#fff' }}>
          <PreviewTag style={{ margin: 0, ...previewStyle }}>
            {field.label || (field.type === 'h3' ? 'Sub-heading' : 'Section Title')}
          </PreviewTag>
        </div>
      </SField>
    </div>
  );
}

/** Color picker + hex input + clear, for an optional color value. */
function ColorControl({ value, onChange, fallback }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value || fallback}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 36, height: 30, padding: 0, border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
      />
      <input
        className={s.sinput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Default"
        style={{ flex: 1 }}
      />
      {value && (
        <button type="button" title="Clear" onClick={() => onChange('')}
          style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#64748b', display: 'inline-flex' }}>
          <Eraser size={13} />
        </button>
      )}
    </div>
  );
}

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

/** Multi-select dropdown for accepted file types (file/image fields). */
function AcceptTypePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = value ?? [];
  const toggle = (key) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  const summary = selected.length
    ? FILE_TYPE_PRESETS.filter((p) => selected.includes(p.key)).map((p) => p.label).join(', ')
    : 'Any file type';
  return (
    <div className={s.msWrap}>
      <button type="button" className={s.msTrigger} onClick={() => setOpen((o) => !o)}>
        <span className={selected.length ? s.msValue : s.msPlaceholder}>{summary}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: '#94a3b8' }} />
      </button>
      {open && (
        <>
          <div className={s.msBackdrop} onClick={() => setOpen(false)} />
          <div className={s.msMenu}>
            {FILE_TYPE_PRESETS.map((p) => (
              <label key={p.key} className={s.msOption}>
                <input
                  type="checkbox"
                  checked={selected.includes(p.key)}
                  onChange={() => toggle(p.key)}
                />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  const update = (i, k, v) => onChange(options.map((o, j) => j === i ? { ...o, [k]: v } : o));
  const remove = (i) => onChange(options.filter((_, j) => j !== i));
  const move   = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const arr = [...options];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };
  const add    = () => { const n = options.length + 1; onChange([...options, { label: `Option ${n}`, value: `opt_${n}` }]); };
  return (
    <div>
      {options.map((opt, i) => (
        <div key={i} className={s.optRow}>
          <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={optMoveBtn} aria-label="Move up">▲</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === options.length - 1} style={optMoveBtn} aria-label="Move down">▼</button>
          </span>
          <input className={s.optInput} value={opt.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Label" />
          <input className={s.optInput} value={opt.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="Value" />
          <button className={s.optDel} onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button className={s.addBtn} onClick={add}><Plus size={12} /> Add option</button>
    </div>
  );
}
const optMoveBtn = { fontSize: 7, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' };

/* Per-option "additional input" config (checkbox group). Each option may turn
 * on an extra input captured only while that option is selected at runtime. */
const OPTION_INPUT_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'textarea', label: 'Textarea' },
];
function OptionInputEditor({ options, onChange }) {
  const update = (i, patch) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className={s.sfield}>
      <span className={s.sfieldLabel}>Additional input per option</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(options ?? []).map((opt, i) => (
          <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', background: '#f8fafc' }}>
            <div className={s.toggleRow} style={{ marginBottom: opt.allowInput ? 8 : 0 }}>
              <span className={s.toggleRowLabel} style={{ fontWeight: 600 }}>{opt.label || opt.value || `Option ${i + 1}`}</span>
              <Toggle value={opt.allowInput ?? false} onChange={(v) => update(i, { allowInput: v })} />
            </div>
            {opt.allowInput && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SField label="Input type">
                  <select className={s.sselect} value={opt.inputType ?? 'text'} onChange={(e) => update(i, { inputType: e.target.value })}>
                    {OPTION_INPUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </SField>
                <SField label="Placeholder">
                  <input className={s.sinput} value={opt.inputPlaceholder ?? ''} onChange={(e) => update(i, { inputPlaceholder: e.target.value })} placeholder="Please specify" />
                </SField>
                <div className={s.toggleRow}>
                  <span className={s.toggleRowLabel}>Required when selected</span>
                  <Toggle value={opt.inputRequired ?? false} onChange={(v) => update(i, { inputRequired: v })} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Per-option CHILD FIELDS config (radio/checkbox/dropdown/multi-select). Each
 * option owns a list of dependent fields shown only when that option is
 * selected at data entry. Choice-type children carry their own option list. */
const CHILD_FIELD_TYPES = [
  { value: 'text',          label: 'Text' },
  { value: 'number',        label: 'Number' },
  { value: 'textarea',      label: 'Text Area' },
  { value: 'date',          label: 'Date' },
  { value: 'radiogroup',    label: 'Radio' },
  { value: 'checkboxgroup', label: 'Checkbox' },
  { value: 'select',        label: 'Dropdown' },
  { value: 'multiselect',   label: 'Multi Select' },
];
const CHILD_TYPE_HAS_OPTIONS = (t) => ['radiogroup', 'checkboxgroup', 'select', 'multiselect'].includes(t);

function OptionChildEditor({ options, onChange }) {
  // Patch one option in place (immutably).
  const patchOpt = (i, patch) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setChildren = (i, children) => patchOpt(i, { childFields: children });

  const addChild = (i) => {
    const kids = options[i]?.childFields ?? [];
    setChildren(i, [...kids, makeChildField('text')]);
  };
  const updateChild = (i, ci, patch) => {
    const kids = (options[i]?.childFields ?? []).map((c, k) => {
      if (k !== ci) return c;
      const next = { ...c, ...patch };
      // Switching to a choice type seeds default options; leaving one drops them.
      if (patch.type !== undefined) {
        if (CHILD_TYPE_HAS_OPTIONS(patch.type) && !Array.isArray(next.options)) {
          next.options = [{ label: 'Option 1', value: 'opt_1' }, { label: 'Option 2', value: 'opt_2' }];
        } else if (!CHILD_TYPE_HAS_OPTIONS(patch.type)) {
          next.options = undefined;
        }
      }
      return next;
    });
    setChildren(i, kids);
  };
  const removeChild = (i, ci) => setChildren(i, (options[i]?.childFields ?? []).filter((_, k) => k !== ci));

  return (
    <div className={s.sfield}>
      <span className={s.sfieldLabel}>Child fields per option</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(options ?? []).map((opt, i) => {
          const kids = opt.childFields ?? [];
          return (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', background: '#f8fafc' }}>
              <div className={s.toggleRow} style={{ marginBottom: kids.length ? 8 : 4 }}>
                <span className={s.toggleRowLabel} style={{ fontWeight: 600 }}>{opt.label || opt.value || `Option ${i + 1}`}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{kids.length} field{kids.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {kids.map((c, ci) => (
                  <div key={c.id ?? ci} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Field {ci + 1}</span>
                      <button type="button" className={s.optDel} onClick={() => removeChild(i, ci)} aria-label="Remove field">×</button>
                    </div>
                    <SField label="Label">
                      <input className={s.sinput} value={c.label ?? ''} onChange={(e) => updateChild(i, ci, { label: e.target.value })} placeholder="Field label" />
                    </SField>
                    <SField label="Type">
                      <select className={s.sselect} value={c.type ?? 'text'} onChange={(e) => updateChild(i, ci, { type: e.target.value })}>
                        {CHILD_FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </SField>
                    {!CHILD_TYPE_HAS_OPTIONS(c.type) && (
                      <SField label="Placeholder">
                        <input className={s.sinput} value={c.placeholder ?? ''} onChange={(e) => updateChild(i, ci, { placeholder: e.target.value })} placeholder="Placeholder" />
                      </SField>
                    )}
                    {CHILD_TYPE_HAS_OPTIONS(c.type) && (
                      <div className={s.sfield}>
                        <span className={s.sfieldLabel}>Options</span>
                        <OptionsEditor options={c.options ?? []} onChange={(opts) => updateChild(i, ci, { options: opts })} />
                      </div>
                    )}
                    <div className={s.toggleRow}>
                      <span className={s.toggleRowLabel}>Required</span>
                      <Toggle value={c.required ?? false} onChange={(v) => updateChild(i, ci, { required: v })} />
                    </div>
                  </div>
                ))}
                <button className={s.addBtn} type="button" onClick={() => addChild(i)}><Plus size={12} /> Add child field</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Per-option CONDITIONAL AUTO-SELECTION config (checkbox group). Each option may
 * carry an `autoRule` that auto-selects / auto-deselects that option when a
 * condition over other fields is met, and optionally forces its child fields
 * required / optional. Conditions reuse the same Block→Page→Field cascade and
 * operator vocabulary as Conditional Visibility. Stored on the option object as
 * `opt.autoRule`; evaluated edge-triggered at runtime (see StudyFormRunner). */
const AUTO_ACTIONS = [
  { value: 'select',   label: 'Select this option' },
  { value: 'deselect', label: 'Deselect this option' },
  { value: 'toggle',   label: 'Toggle — select when met, deselect when not' },
];
const AUTO_CHILD_REQ = [
  { value: 'inherit',  label: 'Keep child fields as configured' },
  { value: 'required', label: 'Make child fields required' },
  { value: 'optional', label: 'Make child fields optional' },
];
const blankCondition = () => ({ blockId: '', pageId: '', fieldId: '', operator: 'equals', value: '' });
const blankGroup = () => ({ match: 'all', rules: [blankCondition()] });
const blankAutoRule = () => ({ enabled: true, action: 'select', childRequired: 'inherit', groupMatch: 'all', groups: [blankGroup()], setField: null });
// Read the rule's condition groups, upgrading a legacy flat rule ({match,rules})
// to the grouped shape so old saved rules keep editing cleanly.
const autoRuleGroupsOf = (rule) =>
  (Array.isArray(rule?.groups) && rule.groups.length) ? rule.groups
    : [{ match: rule?.match ?? 'all', rules: rule?.rules ?? [blankCondition()] }];

// One Block→Page→Field + Operator + Value condition row. Shared by every group.
function AutoConditionRow({ blocks, pagesFor, fieldsFor, r, onChange, onRemove }) {
  const fields = fieldsFor(r.blockId, r.pageId);
  const srcField = fields.find((f) => f.id === r.fieldId);
  const ops = operatorsForType(srcField?.type ?? '');
  const srcOptions = srcField?.options ?? [];
  const noVal = NO_VALUE_OPS.has(r.operator);
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, background: '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className={s.optDel} onClick={onRemove} aria-label="Remove condition">×</button>
      </div>
      <select className={s.sselect} value={r.blockId ?? ''} onChange={(e) => onChange({ blockId: e.target.value, pageId: '', fieldId: '' })}>
        <option value="">Block…</option>
        {blocks.map((b) => <option key={b.id} value={b.id}>{b.title || 'Untitled'}</option>)}
      </select>
      <select className={s.sselect} value={r.pageId ?? ''} onChange={(e) => onChange({ pageId: e.target.value, fieldId: '' })} disabled={!r.blockId}>
        <option value="">Page…</option>
        {pagesFor(r.blockId).map((p) => <option key={p.id} value={p.id}>{p.title || 'Untitled'}</option>)}
      </select>
      <select className={s.sselect} value={r.fieldId ?? ''} disabled={!r.pageId}
        onChange={(e) => {
          const f = fields.find((x) => x.id === e.target.value);
          onChange({ fieldId: e.target.value, operator: operatorsForType(f?.type ?? '')[0]?.value ?? 'equals', value: '' });
        }}>
        <option value="">Field…</option>
        {fields.map((f) => <option key={f.id} value={f.id}>{f.label || f.type}</option>)}
      </select>
      <select className={s.sselect} value={r.operator ?? 'equals'} onChange={(e) => onChange({ operator: e.target.value })} disabled={!r.fieldId}>
        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {noVal ? null : srcOptions.length ? (
        <select className={s.sselect} value={r.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} disabled={!r.fieldId}>
          <option value="">Value…</option>
          {srcOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input className={s.sinput} value={r.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} placeholder="Value" disabled={!r.fieldId} />
      )}
    </div>
  );
}

function OptionAutoSelectEditor({ options, currentFieldId, onChange }) {
  const blocks = useSelector(selectBlocks);
  const allFields = useSelector(selectAllFields);
  const blockById = (id) => blocks.find((b) => b.id === id);
  const pagesFor  = (bid) => blockById(bid)?.pages ?? [];
  const LAYOUT = ['h2', 'h3', 'paragraph', 'divider'];
  const fieldsFor = (bid, pid) => {
    const p = blockById(bid)?.pages.find((pp) => pp.id === pid);
    // A checkbox option's auto-rule may reference any field except its own parent.
    return (p?.fields ?? []).filter((f) => f && f.id !== currentFieldId && !LAYOUT.includes(f.type));
  };
  // Targets for "set field value" — any data field except the parent checkbox.
  const setTargets = (allFields ?? []).filter((f) => f && f.id !== currentFieldId && !LAYOUT.includes(f.type));

  const patchOpt = (i, patch) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setRule  = (i, patch) => patchOpt(i, { autoRule: { ...(options[i]?.autoRule ?? blankAutoRule()), ...patch } });
  const setGroups = (i, groups) => setRule(i, { groups });
  const updGroup  = (i, gi, patch) => setGroups(i, autoRuleGroupsOf(options[i]?.autoRule).map((g, k) => (k === gi ? { ...g, ...patch } : g)));
  const addGroup  = (i) => setGroups(i, [...autoRuleGroupsOf(options[i]?.autoRule), blankGroup()]);
  const delGroup  = (i, gi) => setGroups(i, autoRuleGroupsOf(options[i]?.autoRule).filter((_, k) => k !== gi));
  const setRules  = (i, gi, rules) => updGroup(i, gi, { rules });
  const addCond   = (i, gi) => setRules(i, gi, [...(autoRuleGroupsOf(options[i]?.autoRule)[gi]?.rules ?? []), blankCondition()]);
  const delCond   = (i, gi, ci) => setRules(i, gi, (autoRuleGroupsOf(options[i]?.autoRule)[gi]?.rules ?? []).filter((_, k) => k !== ci));
  const updCond   = (i, gi, ci, patch) => setRules(i, gi, (autoRuleGroupsOf(options[i]?.autoRule)[gi]?.rules ?? []).map((r, k) => (k === ci ? { ...r, ...patch } : r)));

  return (
    <div className={s.sfield}>
      <span className={s.sfieldLabel}>Auto-selection rules per option</span>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>
        Auto check/uncheck the option from other fields. Use <strong>Toggle</strong> to keep it in sync both
        ways, or condition groups for logic like <em>(A OR B) AND C</em>. Every change is recorded in the audit trail.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(options ?? []).map((opt, i) => {
          const rule = opt.autoRule ?? null;
          const on = rule?.enabled === true;
          const groups = on ? autoRuleGroupsOf(rule) : [];
          const sf = rule?.setField ?? null;
          return (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', background: '#f8fafc' }}>
              <div className={s.toggleRow} style={{ marginBottom: on ? 8 : 0 }}>
                <span className={s.toggleRowLabel} style={{ fontWeight: 600 }}>{opt.label || opt.value || `Option ${i + 1}`}</span>
                <Toggle value={on} onChange={(v) => patchOpt(i, { autoRule: { ...(rule ?? blankAutoRule()), enabled: v } })} />
              </div>
              {on && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SField label="Action when condition is met">
                    <select className={s.sselect} value={rule.action ?? 'select'} onChange={(e) => setRule(i, { action: e.target.value })}>
                      {AUTO_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </SField>
                  <SField label="Child fields">
                    <select className={s.sselect} value={rule.childRequired ?? 'inherit'} onChange={(e) => setRule(i, { childRequired: e.target.value })}>
                      {AUTO_CHILD_REQ.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </SField>

                  {/* Set field value — additional action fired when the option is auto-selected. */}
                  <div className={s.toggleRow}>
                    <span className={s.toggleRowLabel}>Also set another field&apos;s value</span>
                    <Toggle value={!!sf} onChange={(v) => setRule(i, { setField: v ? { fieldId: '', value: '' } : null })} />
                  </div>
                  {sf && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, background: '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <select className={s.sselect} value={sf.fieldId ?? ''} onChange={(e) => setRule(i, { setField: { ...sf, fieldId: e.target.value } })}>
                        <option value="">Target field…</option>
                        {setTargets.map((f) => <option key={f.id} value={f.id}>{f.label || f.type}</option>)}
                      </select>
                      <input className={s.sinput} value={sf.value ?? ''} onChange={(e) => setRule(i, { setField: { ...sf, value: e.target.value } })} placeholder="Value to set" disabled={!sf.fieldId} />
                    </div>
                  )}

                  <div className={s.sfield} style={{ gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={s.sfieldLabel} style={{ margin: 0 }}>Condition groups</span>
                      {groups.length > 1 && (
                        <select className={s.sselect} style={{ width: 130 }} value={rule.groupMatch ?? 'all'} onChange={(e) => setRule(i, { groupMatch: e.target.value })}>
                          <option value="all">Groups: ALL (AND)</option>
                          <option value="any">Groups: ANY (OR)</option>
                        </select>
                      )}
                    </div>
                    {groups.map((g, gi) => (
                      <div key={gi} style={{ border: '1px dashed #cbd5e1', borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <select className={s.sselect} style={{ width: 130 }} value={g.match ?? 'all'} onChange={(e) => updGroup(i, gi, { match: e.target.value })}>
                            <option value="all">Match ALL (AND)</option>
                            <option value="any">Match ANY (OR)</option>
                          </select>
                          {groups.length > 1 && (
                            <button type="button" className={s.optDel} onClick={() => delGroup(i, gi)} aria-label="Remove group">×</button>
                          )}
                        </div>
                        {(g.rules ?? []).map((r, ci) => (
                          <AutoConditionRow
                            key={ci} blocks={blocks} pagesFor={pagesFor} fieldsFor={fieldsFor} r={r}
                            onChange={(patch) => updCond(i, gi, ci, patch)}
                            onRemove={() => delCond(i, gi, ci)}
                          />
                        ))}
                        <button className={s.addBtn} type="button" onClick={() => addCond(i, gi)}><Plus size={12} /> Add condition</button>
                      </div>
                    ))}
                    <button className={s.addBtn} type="button" onClick={() => addGroup(i)}><Plus size={12} /> Add group</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
