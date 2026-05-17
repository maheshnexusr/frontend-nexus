import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import {
  selectFieldBucket, addQuery, updateQueryStatus, deleteQuery,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import Popover from './Popover';
import s from './runtime.module.css';

const STATUS_FLOW = ['Open', 'Answered', 'Reviewed', 'Closed'];
const PRIORITIES  = ['Low', 'Medium', 'High', 'Critical'];

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function pillClass(status) {
  if (status === 'Open')     return s.pillOpen;
  if (status === 'Answered') return s.pillAnswered;
  if (status === 'Reviewed') return s.pillReviewed;
  if (status === 'Closed')   return s.pillClosed;
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

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: '', description: '', priority: 'Medium', assignedTo: '',
  });

  const queries = bucket?.queries ?? [];

  const startNew = () => {
    setDraft({ title: '', description: '', priority: 'Medium', assignedTo: '' });
    setCreating(true);
  };

  const submit = () => {
    if (!draft.title.trim()) return;
    dispatch(addQuery({
      fieldId,
      title:       draft.title.trim(),
      description: draft.description.trim(),
      priority:    draft.priority,
      assignedTo:  draft.assignedTo.trim() || null,
      ...me,
    }));
    setCreating(false);
  };

  const advance = (q) => {
    const idx = STATUS_FLOW.indexOf(q.status);
    const next = STATUS_FLOW[Math.min(STATUS_FLOW.length - 1, idx + 1)];
    if (next === q.status) return;
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
      {!creating && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" className={s.btnPrimary} onClick={startNew}>
            <Plus size={13} /> Raise Query
          </button>
        </div>
      )}

      {creating && (
        <div className={s.item} style={{ marginBottom: 12, background: '#fafbff' }}>
          <div className={s.formField}>
            <label className={s.fieldLabel}>Title</label>
            <input
              className={s.textInput}
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. DOB does not match source document"
            />
          </div>
          <div className={s.formField}>
            <label className={s.fieldLabel}>Description</label>
            <textarea
              className={s.textArea}
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <label className={s.fieldLabel}>Assign to</label>
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
            <button type="button" className={s.btnPrimary} onClick={submit} disabled={!draft.title.trim()}>
              Submit
            </button>
          </div>
        </div>
      )}

      {queries.length === 0 ? (
        <div className={s.emptyState}>No queries raised yet.</div>
      ) : (
        <div className={s.itemList}>
          {queries.map((q) => (
            <div key={q.id} className={s.item}>
              <div className={s.itemHead}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className={s.itemAuthor}>{q.title}</span>
                    <span className={`${s.pill} ${pillClass(q.status)}`}>{q.status}</span>
                    <span className={`${s.pill} ${priorityPill(q.priority)}`}>{q.priority}</span>
                  </div>
                  <div className={s.itemMeta}>
                    {q.createdByName} · {fmt(q.createdAt)}
                    {q.assignedTo && <> · @{q.assignedTo}</>}
                  </div>
                </div>
                <div className={s.itemActions}>
                  {q.status !== 'Closed' && (
                    <button
                      type="button"
                      className={s.btnSecondary}
                      style={{ height: 22, padding: '0 6px', fontSize: 10.5 }}
                      onClick={() => advance(q)}
                    >
                      → {STATUS_FLOW[STATUS_FLOW.indexOf(q.status) + 1]}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${s.itemActionBtn} ${s.itemActionBtnDanger}`}
                    title="Delete"
                    onClick={() => dispatch(deleteQuery({ fieldId, queryId: q.id, ...me }))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {q.description && <div className={s.itemBody}>{q.description}</div>}
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}
