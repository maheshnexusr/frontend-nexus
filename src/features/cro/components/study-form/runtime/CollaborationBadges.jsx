import { useSelector } from 'react-redux';
import { MessageSquare, AlertCircle, Paperclip, StickyNote, CheckCircle2, Clock } from 'lucide-react';
import { selectFieldBucket } from '@/features/cro/store/formRuntimeSlice';
import s from './runtime.module.css';

/**
 * CollaborationBadges — small inline pills for a field showing counts of
 * annotations, queries, attachments, notes and verification state.
 *
 * Queries get one pill per active status (Raised / Answered / Resolved),
 * each in its requirement-defined color so the count is read at a glance.
 * Hovering a query pill shows a short summary of the latest queries in
 * that bucket (native title tooltip).
 */

const STATUS_ALIASES = { Open: 'Raised', Closed: 'Resolved', Reviewed: 'Answered' };
const normalizeStatus = (st) => STATUS_ALIASES[st] ?? (['Raised', 'Answered', 'Resolved'].includes(st) ? st : 'Raised');

function summarize(list, max = 3) {
  if (!list.length) return '';
  const head = list.slice(0, max).map((q) => `• ${q.title || (q.description || '').slice(0, 60) || 'Query'}`).join('\n');
  const more = list.length > max ? `\n…and ${list.length - max} more` : '';
  return head + more;
}

export default function CollaborationBadges({ fieldId, onOpen }) {
  const bucket = useSelector(selectFieldBucket(fieldId));
  if (!bucket) return null;

  const annotationCount = bucket.annotations.filter((a) => !a.resolved).length;
  const attachmentCount = bucket.attachments.length;
  const noteCount       = bucket.notes.length;
  const verified        = !!bucket.verification?.verified;

  const byStatus = { Raised: [], Answered: [], Resolved: [] };
  for (const q of bucket.queries) byStatus[normalizeStatus(q.status)].push(q);

  const totalActiveQueries = byStatus.Raised.length + byStatus.Answered.length;
  const has = annotationCount + totalActiveQueries + attachmentCount + noteCount + byStatus.Resolved.length > 0 || verified;
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

      {byStatus.Raised.length > 0 && (
        <button
          type="button"
          className={`${s.badge} ${s.badgeQueryRaised}`}
          title={`Raised queries\n${summarize(byStatus.Raised)}`}
          onClick={handle('queries')}
        >
          <AlertCircle size={11} /> {byStatus.Raised.length}
        </button>
      )}
      {byStatus.Answered.length > 0 && (
        <button
          type="button"
          className={`${s.badge} ${s.badgeQueryAnswered}`}
          title={`Answered queries\n${summarize(byStatus.Answered)}`}
          onClick={handle('queries')}
        >
          <AlertCircle size={11} /> {byStatus.Answered.length}
        </button>
      )}
      {byStatus.Resolved.length > 0 && (
        <button
          type="button"
          className={`${s.badge} ${s.badgeQueryResolved}`}
          title={`Resolved queries\n${summarize(byStatus.Resolved)}`}
          onClick={handle('queries')}
        >
          <AlertCircle size={11} /> {byStatus.Resolved.length}
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
      {verified && (
        <button type="button" className={`${s.badge} ${s.badgeVerified}`} title="Verified" onClick={handle('verification')}>
          <CheckCircle2 size={11} /> Verified
        </button>
      )}
      {!verified && (annotationCount > 0 || totalActiveQueries > 0) && (
        <span className={`${s.badge} ${s.badgePending}`} title="Pending verification">
          <Clock size={11} /> Pending
        </span>
      )}
    </div>
  );
}
