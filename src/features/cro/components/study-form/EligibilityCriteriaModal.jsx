import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { selectBlocks, selectEligibilityCriteria, setEligibilityCriteria } from '@/features/cro/store/studyFormSlice';

/**
 * EligibilityCriteriaModal — configure Inclusion / Exclusion criteria (form
 * level). Each row references a source Block → Page → Field + Operator + Value,
 * tagged Inclusion or Exclusion. The runtime auto-derives the subject's
 * eligibility (Included / Excluded / Pending Review / Screen Failed), with
 * exclusion taking priority. Reuses the same operator vocabulary as Conditional
 * Visibility.
 */

const OP_LABELS = {
  equals: 'Equals', not_equals: 'Not Equals', contains: 'Contains',
  does_not_contain: 'Does Not Contain', starts_with: 'Starts With', ends_with: 'Ends With',
  is_empty: 'Is Empty', is_not_empty: 'Is Not Empty',
  greater_than: 'Greater Than', less_than: 'Less Than',
  gte: 'Greater Than or Equal To', lte: 'Less Than or Equal To', between: 'Between',
  in_list: 'In List', not_in_list: 'Not In List',
  includes_any: 'Includes Any', includes_all: 'Includes All',
  checked: 'Checked', unchecked: 'Unchecked', on: 'On', off: 'Off',
  uploaded: 'Uploaded', not_uploaded: 'Not Uploaded',
  signed: 'Signed', not_signed: 'Not Signed', before: 'Before', after: 'After',
};
const NO_VALUE_OPS = new Set(['is_empty', 'is_not_empty', 'checked', 'unchecked', 'on', 'off', 'uploaded', 'not_uploaded', 'signed', 'not_signed']);
const opItems = (...keys) => keys.map((k) => ({ value: k, label: OP_LABELS[k] }));
function operatorsForType(type) {
  switch (type) {
    case 'text': case 'textarea': return opItems('equals', 'not_equals', 'contains', 'does_not_contain', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty');
    case 'email': return opItems('equals', 'contains', 'ends_with', 'is_empty', 'is_not_empty');
    case 'phone': return opItems('equals', 'contains', 'starts_with', 'is_empty', 'is_not_empty');
    case 'number': case 'calculated': case 'formula': case 'derived': return opItems('equals', 'not_equals', 'greater_than', 'less_than', 'gte', 'lte', 'between', 'is_empty');
    case 'slider': return opItems('equals', 'not_equals', 'greater_than', 'less_than', 'gte', 'lte', 'between');
    case 'date': case 'datetime': return opItems('equals', 'before', 'after', 'between', 'is_empty');
    case 'time': return opItems('equals', 'before', 'after', 'between');
    case 'select': case 'dropdown': return opItems('equals', 'not_equals', 'in_list', 'not_in_list', 'is_empty');
    case 'multiselect': return opItems('contains', 'does_not_contain', 'includes_any', 'includes_all', 'is_empty');
    case 'radiogroup': case 'radio': return opItems('equals', 'not_equals');
    case 'checkbox': return opItems('checked', 'unchecked');
    case 'checkboxgroup': return opItems('contains', 'does_not_contain', 'includes_any', 'includes_all');
    case 'toggle': case 'switch': return opItems('on', 'off');
    case 'file': return opItems('uploaded', 'not_uploaded');
    case 'signature': return opItems('signed', 'not_signed');
    default: return opItems('equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty');
  }
}

const sel = { padding: '5px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', minWidth: 0 };

export default function EligibilityCriteriaModal({ onClose }) {
  const dispatch = useDispatch();
  const blocks   = useSelector(selectBlocks);
  const saved    = useSelector(selectEligibilityCriteria);
  const [rows, setRows] = useState(() => (saved ?? []).map((r) => ({
    id: r.id, type: r.type ?? r.criteria_type ?? 'inclusion',
    blockId: r.blockId ?? r.block_id ?? '', pageId: r.pageId ?? r.page_id ?? '',
    fieldId: r.fieldId ?? r.field_id ?? '', fieldLabel: r.fieldLabel ?? r.field_label ?? '',
    operator: r.operator ?? 'equals', value: r.value ?? '', logic: r.logic ?? 'AND',
  })));

  const blockById = (id) => blocks.find((b) => b.id === id);
  const pagesFor  = (bid) => blockById(bid)?.pages ?? [];
  const fieldsFor = (bid, pid) => {
    const LAYOUT = ['h2', 'h3', 'paragraph', 'divider'];
    const p = blockById(bid)?.pages.find((pp) => pp.id === pid);
    return (p?.fields ?? []).filter((f) => f && !LAYOUT.includes(f.type));
  };

  const addRow = () => setRows((r) => [...r, {
    id: `crit_${Date.now()}_${r.length}`, type: 'inclusion',
    blockId: blocks[0]?.id ?? '', pageId: '', fieldId: '', fieldLabel: '',
    operator: 'equals', value: '', logic: 'AND',
  }]);
  const delRow = (i) => setRows((r) => r.filter((_, j) => j !== i));
  const upd = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const save = () => {
    dispatch(setEligibilityCriteria(rows.filter((r) => r.fieldId && r.operator)));
    onClose();
  };

  const footer = (
    <>
      <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      <button type="button" onClick={save} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <ShieldCheck size={13} /> Save Criteria
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Inclusion / Exclusion Criteria" size="lg" footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12.5, color: '#475569', margin: 0 }}>
          Define eligibility criteria. The subject is auto-evaluated as <strong style={{ color: '#15803d' }}>Included</strong> /
          <strong style={{ color: '#b91c1c' }}> Excluded</strong> / <strong style={{ color: '#b45309' }}>Pending Review</strong> /
          Screen&nbsp;Failed. <em>Exclusion criteria take priority over inclusion.</em>
          <br />
          <strong>AND / OR</strong> joins a criterion to the <strong>next one of the same type</strong> (Inclusion or Exclusion),
          applied top-to-bottom. The connector on the last criterion of each type is ignored.
        </p>

        {rows.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px dashed #e2e8f0', borderRadius: 8 }}>
            No criteria yet. Click “Add Criterion”.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr 1fr 130px 1fr 70px 28px', gap: 6, alignItems: 'center', fontSize: 12 }}>
            {['Type', 'Block', 'Page', 'Field', 'Condition', 'Value', 'Logic', ''].map((h, i) => (
              <span key={i} style={{ fontWeight: 700, color: '#64748b', fontSize: 10.5, textTransform: 'uppercase' }}>{h}</span>
            ))}
            {rows.map((row, i) => {
              const fields = fieldsFor(row.blockId, row.pageId);
              const srcType = fields.find((f) => f.id === row.fieldId)?.type ?? '';
              const operators = operatorsForType(srcType);
              const srcOptions = fields.find((f) => f.id === row.fieldId)?.options ?? [];
              const noVal = NO_VALUE_OPS.has(row.operator);
              return (
                <Row key={row.id ?? i}
                  row={row} i={i} blocks={blocks} pagesFor={pagesFor} fields={fields}
                  operators={operators} srcOptions={srcOptions} noVal={noVal}
                  upd={upd} delRow={delRow} sel={sel} operatorsForType={operatorsForType}
                />
              );
            })}
          </div>
        )}

        <button type="button" onClick={addRow} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12.5, fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
          <Plus size={13} /> Add Criterion
        </button>
      </div>
    </Modal>
  );
}

function Row({ row, i, blocks, pagesFor, fields, operators, srcOptions, noVal, upd, delRow, sel, operatorsForType }) {
  return (
    <>
      <select style={sel} value={row.type} onChange={(e) => upd(i, { type: e.target.value })}>
        <option value="inclusion">Inclusion</option>
        <option value="exclusion">Exclusion</option>
      </select>
      <select style={sel} value={row.blockId} onChange={(e) => upd(i, { blockId: e.target.value, pageId: '', fieldId: '' })}>
        <option value="">Block…</option>
        {blocks.map((b) => <option key={b.id} value={b.id}>{b.title || 'Untitled'}</option>)}
      </select>
      <select style={sel} value={row.pageId} onChange={(e) => upd(i, { pageId: e.target.value, fieldId: '' })} disabled={!row.blockId}>
        <option value="">Page…</option>
        {pagesFor(row.blockId).map((p) => <option key={p.id} value={p.id}>{p.title || 'Untitled'}</option>)}
      </select>
      <select style={sel} value={row.fieldId}
        onChange={(e) => {
          const f = fields.find((x) => x.id === e.target.value);
          upd(i, { fieldId: e.target.value, fieldLabel: f?.label ?? '', operator: operatorsForType(f?.type ?? '')[0]?.value ?? 'equals', value: '' });
        }}
        disabled={!row.pageId}>
        <option value="">Field…</option>
        {fields.map((f) => <option key={f.id} value={f.id}>{f.label || f.type}</option>)}
      </select>
      <select style={sel} value={row.operator} onChange={(e) => upd(i, { operator: e.target.value })} disabled={!row.fieldId}>
        {operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {noVal ? (
        <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>(no value)</span>
      ) : srcOptions.length ? (
        <select style={sel} value={row.value} onChange={(e) => upd(i, { value: e.target.value })} disabled={!row.fieldId}>
          <option value="">Value…</option>
          {srcOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input style={sel} value={row.value} onChange={(e) => upd(i, { value: e.target.value })} placeholder="Value" disabled={!row.fieldId} />
      )}
      <select style={sel} value={row.logic} onChange={(e) => upd(i, { logic: e.target.value })}>
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
      <button type="button" onClick={() => delRow(i)} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
    </>
  );
}
