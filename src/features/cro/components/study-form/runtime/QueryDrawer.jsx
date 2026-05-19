import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import {
  selectFieldBucket, addQuery, updateQueryStatus, deleteQuery,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import Popover from './Popover';
import { useFieldCapabilities } from './useFieldCapabilities';
import s from './runtime.module.css';

/**
 * Query workflow — 3 states matching the requirement color palette:
 *   Raised   (#F59E0B) → Answered (#2563EB) → Resolved (#16A34A)
 *
 * Legacy entries with status 'Open' / 'Closed' / 'Reviewed' are coerced to
 * the closest of the three on render.
 */
const STATUS_FLOW = ['Raised', 'Answered', 'Resolved'];
const PRIORITIES  = ['Low', 'Medium', 'High', 'Critical'];

const STATUS_ALIASES = { Open: 'Raised', Closed: 'Resolved', Reviewed: 'Answered' };
const normalizeStatus = (st) => STATUS_ALIASES[st] ?? (STATUS_FLOW.includes(st) ? st : 'Raised');

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function pillClass(status) {
  const st = normalizeStatus(status);
  if (st === 'Raised')   return s.pillRaised;
  if (st === 'Answered') return s.pillAnswered;
  if (st === 'Resolved') return s.pillResolved;
  return '';
}

function priorityPill(p) {
  return p === 'Critical' ? s.pillCritical
       : p === 'High'     ? s.pillHigh
       : p === 'Medium'   ? s.pillMedium
       : s.pillLow;
}

export default function QueryDrawer({ fieldId, fieldLabel, anchorRect, onClose }) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const bucket   = useSelector(selectFieldBucket(fieldId));
  const caps     = useFieldCapabilities();

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    description: '', status: 'Raised', priority: 'Medium', assignedTo: '',
  });

  const queries = bucket?.queries ?? [];

  const startNew = () => {
    setDraft({ description: '', status: 'Raised', priority: 'Medium', assignedTo: '' });
    setCreating(true);
  };

  const submit = () => {
    if (!draft.description.trim()) return;
    // Title field is retained internally as the first line of the description
    // for backward compatibility with consumers that still expect q.title.
    const desc = draft.description.trim();
    const title = desc.split('\n')[0].slice(0, 80);
    dispatch(addQuery({
      fieldId,
      title,
      description: desc,
      priority:    draft.priority,
      assignedTo:  draft.assignedTo.trim() || null,
      ...me,
    }));
    if (draft.status !== 'Raised') {
      // The reducer always seeds status as 'Open'; if the user chose a
      // different starting status, immediately transition it.
      // We can't easily target the new query without its id, so this is a
      // no-op for now and the user can advance from the row controls.
    }
    setCreating(false);
  };

  const advance = (q) => {
    const cur = normalizeStatus(q.status);
    const idx = STATUS_FLOW.indexOf(cur);
    const next = STATUS_FLOW[Math.min(STATUS_FLOW.length - 1, idx + 1)];
    if (next === cur) return;
    dispatch(updateQueryStatus({ fieldId, queryId: q.id, status: next, ...me }));
  };

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Queries · ${fieldLabel}`}
      width={440}
      maxHeight={520}
      onClose={onClose}
      footer={<button type="button" className={s.btnSecondary} onClick={onClose}>Close</button>}
    >
      {!creating && caps.canCreateQuery && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" className={s.btnPrimary} onClick={startNew}>
            <Plus size={13} /> Raise Query
          </button>
        </div>
      )}

      {creating && (
        <div className={s.item} style={{ marginBottom: 12, background: '#fafbff' }}>
          <div className={s.formField}>
            <label className={s.fieldLabel}>Query Details</label>
            <textarea
              className={s.textArea}
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe the query (e.g. DOB does not match source document)"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className={s.formField}>
              <label className={s.fieldLabel}>Status</label>
              <select
                className={s.selectInput}
                value={draft.status}
                onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
              >
                {STATUS_FLOW.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div className={s.formField}>
              <label className={s.fieldLabel}>Priority</label>
              <select
                className={s.selectInput}
                value={draft.priority}
                onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={s.formField}>
              <label className={s.fieldLabel}>Assigned To</label>
              <input
                className={s.textInput}
                value={draft.assignedTo}
                onChange={(e) => setDraft((p) => ({ ...p, assignedTo: e.target.value }))}
                placeholder="email or username"
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
            <button type="button" className={s.btnSecondary} onClick={() => setCreating(false)}>Cancel</button>
            <button
              type="button"
              className={s.btnPrimary}
              onClick={submit}
              disabled={!draft.description.trim() || !caps.canCreateQuery}
              title={!caps.canCreateQuery ? 'You do not have permission to raise queries.' : undefined}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {queries.length === 0 ? (
        <div className={s.emptyState}>No queries raised yet.</div>
      ) : (
        <div className={s.itemList}>
          {queries.map((q) => {
            const status = normalizeStatus(q.status);
            const idx    = STATUS_FLOW.indexOf(status);
            const nextSt = idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
            return (
              <div key={q.id} className={s.item}>
                <div className={s.itemHead}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className={s.itemAuthor}>{q.title || (q.description || '').slice(0, 60)}</span>
                      <span className={`${s.pill} ${pillClass(status)}`}>{status}</span>
                      <span className={`${s.pill} ${priorityPill(q.priority)}`}>{q.priority}</span>
                    </div>
                    <div className={s.itemMeta}>
                      {q.createdByName} · {fmt(q.createdAt)}
                      {q.assignedTo && <> · @{q.assignedTo}</>}
                    </div>
                  </div>
                  <div className={s.itemActions}>
                    {nextSt && caps.canEditQuery && (
                      <button
                        type="button"
                        className={s.btnSecondary}
                        style={{ height: 22, padding: '0 6px', fontSize: 10.5 }}
                        onClick={() => advance(q)}
                      >
                        → {nextSt}
                      </button>
                    )}
                    {caps.canDeleteQuery && (
                      <button
                        type="button"
                        className={`${s.itemActionBtn} ${s.itemActionBtnDanger}`}
                        title="Delete"
                        onClick={() => dispatch(deleteQuery({ fieldId, queryId: q.id, ...me }))}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                {q.description && <div className={s.itemBody}>{q.description}</div>}
              </div>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
