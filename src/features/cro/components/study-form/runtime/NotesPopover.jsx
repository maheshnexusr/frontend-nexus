import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Pencil, Trash2, Check } from 'lucide-react';
import {
  selectFieldBucket, addNote, updateNote, deleteNote,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import Popover from './Popover';
import s from './runtime.module.css';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function NotesPopover({ fieldId, fieldLabel, anchorRect, onClose }) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const bucket   = useSelector(selectFieldBucket(fieldId));

  const [draft,    setDraft]    = useState('');
  const [editing,  setEditing]  = useState(null); // { id, text }

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    dispatch(addNote({ fieldId, text, ...me }));
    setDraft('');
  };

  const handleSaveEdit = () => {
    const text = (editing?.text ?? '').trim();
    if (!editing || !text) return;
    dispatch(updateNote({ fieldId, noteId: editing.id, text, ...me }));
    setEditing(null);
  };

  const notes = bucket?.notes ?? [];

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Notes · ${fieldLabel}`}
      width={340}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={s.btnSecondary} onClick={onClose}>Close</button>
          <button type="button" className={s.btnPrimary} onClick={handleAdd} disabled={!draft.trim()}>
            Add Note
          </button>
        </>
      }
    >
      {notes.length === 0 ? (
        <div className={s.emptyState}>No notes yet.</div>
      ) : (
        <div className={s.itemList} style={{ marginBottom: 8 }}>
          {notes.map((n) => (
            <div key={n.id} className={s.item}>
              <div className={s.itemHead}>
                <div>
                  <div className={s.itemAuthor}>{n.createdByName}</div>
                  <div className={s.itemMeta}>{fmt(n.updatedAt ?? n.createdAt)}</div>
                </div>
                <div className={s.itemActions}>
                  {editing?.id === n.id ? (
                    <button type="button" className={s.itemActionBtn} title="Save" onClick={handleSaveEdit}>
                      <Check size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={s.itemActionBtn}
                      title="Edit"
                      onClick={() => setEditing({ id: n.id, text: n.text })}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${s.itemActionBtn} ${s.itemActionBtnDanger}`}
                    title="Delete"
                    onClick={() => dispatch(deleteNote({ fieldId, noteId: n.id, ...me }))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {editing?.id === n.id ? (
                <textarea
                  className={s.textArea}
                  rows={2}
                  value={editing.text}
                  onChange={(e) => setEditing((p) => ({ ...p, text: e.target.value }))}
                />
              ) : (
                <div className={s.itemBody}>{n.text}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <textarea
        className={s.textArea}
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Quick note…"
      />
    </Popover>
  );
}
