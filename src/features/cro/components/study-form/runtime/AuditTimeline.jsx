import { useSelector } from 'react-redux';
import { selectAuditForField } from '@/features/cro/store/formRuntimeSlice';
import { formatDateTime } from '@/utils/formatDate';
import Popover from './Popover';
import s from './runtime.module.css';

const ACTION_LABELS = {
  'value.changed':           'Value changed',
  'value.cleared':           'Value cleared',
  'annotation.added':        'Annotation added',
  'annotation.resolved':     'Annotation resolved',
  'annotation.deleted':      'Annotation deleted',
  'note.added':              'Note added',
  'note.updated':            'Note updated',
  'note.deleted':            'Note deleted',
  'query.raised':            'Query raised',
  'query.statusChanged':     'Query status changed',
  'query.deleted':           'Query deleted',
  'attachment.added':        'Attachment uploaded',
  'attachment.removed':      'Attachment removed',
  'verification.verified':   'Field verified',
  'verification.unverified': 'Verification removed',
  // Phase 1 — form status workflow
  'form.statusChanged':      'Form status changed',
  'field.locked':            'Field locked',
  'field.unlocked':          'Field unlocked',
  'field.frozen':            'Field frozen',
  'field.unfrozen':          'Field unfrozen',
  // Phase 3 — signature + approval
  'form.signed':             'Form signed',
  'form.signatureRevoked':   'Signature revoked',
  'form.approved':           'Form approved',
  'form.approvalRevoked':    'Approval revoked',
};

const fmt = (iso) => formatDateTime(iso);

function detailFor(entry) {
  const m = entry.meta ?? {};
  switch (entry.action) {
    case 'value.changed':       return `${JSON.stringify(m.oldValue)} → ${JSON.stringify(m.newValue)}`;
    case 'value.cleared':       return `was ${JSON.stringify(m.oldValue)}`;
    case 'query.raised': {
      const parts = [];
      if (m.priority)   parts.push(`Priority: ${m.priority}`);
      if (m.assignedTo) parts.push(`Assigned: ${m.assignedTo}`);
      if (m.status)     parts.push(`Status: ${m.status}`);
      return parts.length ? parts.join(' · ') : (m.title ?? null);
    }
    case 'query.statusChanged': return `${m.from} → ${m.to}${m.response ? ` · "${m.response}"` : ''}`;
    case 'annotation.added':    return m.comment;
    case 'attachment.added':
    case 'attachment.removed':  return m.fileName;
    case 'form.statusChanged':  return `${m.from} → ${m.to}${m.reason ? ` · "${m.reason}"` : ''}`;
    case 'field.locked':
    case 'field.unlocked':
    case 'field.frozen':
    case 'field.unfrozen':      return m.reason ?? null;
    default:                    return null;
  }
}

export default function AuditTimeline({ fieldId, fieldLabel, anchorRect, onClose }) {
  const entries = useSelector(selectAuditForField(fieldId));

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Audit Trail · ${fieldLabel}`}
      width={420}
      maxHeight={500}
      onClose={onClose}
      footer={<button type="button" className={s.btnSecondary} onClick={onClose}>Close</button>}
    >
      {entries.length === 0 ? (
        <div className={s.emptyState}>No activity recorded for this field yet.</div>
      ) : (
        <div className={s.timeline}>
          {entries.map((e) => {
            const detail = detailFor(e);
            return (
              <div key={e.id} className={s.timelineEntry}>
                <div className={s.timelineDot} />
                <div className={s.timelineContent}>
                  <div className={s.timelineAction}>
                    {ACTION_LABELS[e.action] ?? e.action}
                  </div>
                  <div className={s.timelineMeta}>
                    {e.byName ?? 'system'} · {fmt(e.at)}
                  </div>
                  {detail != null && detail !== '' && (
                    <div className={s.timelineDetail}>{detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
