import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Check, Trash2 } from 'lucide-react';
import {
  selectFieldBucket, addAnnotation, resolveAnnotation, deleteAnnotation,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import Popover from './Popover';
import s from './runtime.module.css';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AnnotationModal({ fieldId, fieldLabel, anchorRect, onClose }) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const bucket   = useSelector(selectFieldBucket(fieldId));

  const [comment, setComment] = useState('');

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const handleAdd = () => {
    const text = comment.trim();
    if (!text) return;
    dispatch(addAnnotation({ fieldId, comment: text, ...me }));
    setComment('');
  };

  const annotations = bucket?.annotations ?? [];

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Annotations · ${fieldLabel}`}
      onClose={onClose}
      width={400}
      footer={
        <>
          <button type="button" className={s.btnSecondary} onClick={onClose}>Close</button>
          <button type="button" className={s.btnPrimary} onClick={handleAdd} disabled={!comment.trim()}>
            Add
          </button>
        </>
      }
    >
      {annotations.length === 0 ? (
        <div className={s.emptyState}>No annotations yet — be the first to comment.</div>
      ) : (
        <div className={s.itemList}>
          {annotations.map((a) => (
            <div key={a.id} className={s.item}>
              <div className={s.itemHead}>
                <div>
                  <div className={s.itemAuthor}>
                    {a.createdByName}
                    {a.resolved && <span style={{ marginLeft: 6 }} className={`${s.pill} ${s.pillResolved}`}>Resolved</span>}
                  </div>
                  <div className={s.itemMeta}>{fmtDate(a.createdAt)}</div>
                </div>
                <div className={s.itemActions}>
                  {!a.resolved && (
                    <button
                      type="button"
                      className={s.itemActionBtn}
                      title="Mark resolved"
                      onClick={() => dispatch(resolveAnnotation({ fieldId, annotationId: a.id, ...me }))}
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${s.itemActionBtn} ${s.itemActionBtnDanger}`}
                    title="Delete"
                    onClick={() => dispatch(deleteAnnotation({ fieldId, annotationId: a.id, ...me }))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className={s.itemBody}>{a.comment}</div>
            </div>
          ))}
        </div>
      )}

      <div className={s.formField} style={{ marginTop: 10, marginBottom: 0 }}>
        <label className={s.fieldLabel}>Add a comment</label>
        <textarea
          className={s.textArea}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a note for reviewers…"
        />
      </div>
    </Popover>
  );
}
