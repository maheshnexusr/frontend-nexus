import { useSelector } from 'react-redux';
import { MessageSquare, AlertCircle, Paperclip, StickyNote, CheckCircle2, Clock } from 'lucide-react';
import { selectFieldBucket } from '@/features/cro/store/formRuntimeSlice';
import s from './runtime.module.css';

/**
 * CollaborationBadges — small inline pills for a field showing counts of
 * annotations, queries, attachments, notes and verification state.
 *
 * Each badge is clickable; the parent decides what to open.
 */
export default function CollaborationBadges({ fieldId, onOpen }) {
  const bucket = useSelector(selectFieldBucket(fieldId));
  if (!bucket) return null;

  const annotationCount = bucket.annotations.filter((a) => !a.resolved).length;
  const queryCount      = bucket.queries.filter((q) => q.status !== 'Closed').length;
  const attachmentCount = bucket.attachments.length;
  const noteCount       = bucket.notes.length;
  const verified        = !!bucket.verification?.verified;

  const has = annotationCount + queryCount + attachmentCount + noteCount > 0 || verified;
  if (!has) return null;

  const handle = (kind) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpen?.(kind, rect);
  };

  return (
    <div className={s.badges}>
      {annotationCount > 0 && (
        <button type="button" className={`${s.badge} ${s.badgeAnnotation}`} title="Annotations" onClick={handle('annotations')}>
          <MessageSquare size={11} /> {annotationCount}
        </button>
      )}
      {queryCount > 0 && (
        <button type="button" className={`${s.badge} ${s.badgeQuery}`} title="Open queries" onClick={handle('queries')}>
          <AlertCircle size={11} /> {queryCount}
        </button>
      )}
      {attachmentCount > 0 && (
        <button type="button" className={`${s.badge} ${s.badgeAttachment}`} title="Attachments" onClick={handle('attachments')}>
          <Paperclip size={11} /> {attachmentCount}
        </button>
      )}
      {noteCount > 0 && (
        <button type="button" className={`${s.badge} ${s.badgeNote}`} title="Notes" onClick={handle('notes')}>
          <StickyNote size={11} /> {noteCount}
        </button>
      )}
      {verified ? (
        <button type="button" className={`${s.badge} ${s.badgeVerified}`} title="Verified" onClick={handle('verification')}>
          <CheckCircle2 size={11} /> Verified
        </button>
      ) : null}
      {!verified && bucket.verification && bucket.verification.verifiedAt === null && annotationCount === 0 && queryCount === 0 ? null : null}
      {/* "Pending" surface only when there is at least one query/annotation but no verification yet */}
      {!verified && (annotationCount > 0 || queryCount > 0) && (
        <span className={`${s.badge} ${s.badgePending}`} title="Pending verification">
          <Clock size={11} /> Pending
        </span>
      )}
    </div>
  );
}
