/**
 * ActivityLogDrawer — slide-in audit panel filtered to a single subject or
 * form. Hits the existing /api/v1/sponsor/workspace/activity-logs endpoint
 * with resource_type + resource_id query params (added on the backend in the
 * same commit that introduced this component).
 *
 *   <ActivityLogDrawer
 *     open
 *     resourceType="subject"
 *     resourceId={subject.id}
 *     resourceLabel={`${subject.subjectCode} — ${subject.siteName}`}
 *     onClose={() => setOpen(false)}
 *   />
 *
 * The host page decides which subjects-leaf or data-capture-leaf permission
 * gates the trigger button; this component renders unconditionally when
 * opened (it's already inside a permitted context).
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { X, Loader2, RefreshCw, FileText } from 'lucide-react';
import sponsorAxiosClient from '@/api/sponsorAxiosClient';
import { formatDateTime } from '@/utils/formatDate';
import s from './ActivityLogDrawer.module.css';

// Uniform audit renderer (spec §Audit): Previous → New value + Reason, plus a
// per-field change list for data updates. Falls back to remaining metadata.
const fmtAuditVal = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
const AUDIT_OMIT = new Set(['actor_name', 'description', 'previous_value', 'new_value', 'reason', 'changes', 'subject_id', 'form_id', 'comment_id', 'snapshot', 'deleted_counts', 'site_id', 'changed']);
function AuditChange({ metadata }) {
  if (!metadata || typeof metadata !== 'object') return null;
  const { previous_value, new_value, reason, changes } = metadata;
  const hasPrevNew = previous_value != null || new_value != null;
  const extras = Object.entries(metadata).filter(([k, v]) => !AUDIT_OMIT.has(k) && v != null && v !== '');
  if (!hasPrevNew && !reason && !(Array.isArray(changes) && changes.length) && !extras.length) return null;
  const pill = { fontSize: 11.5, padding: '1px 7px', borderRadius: 5, fontFamily: 'monospace', whiteSpace: 'pre-line', textAlign: 'left' };
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {hasPrevNew && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ ...pill, background: '#fef2f2', color: '#b91c1c' }}>{fmtAuditVal(previous_value)}</span>
          <span style={{ color: '#94a3b8' }}>→</span>
          <span style={{ ...pill, background: '#ecfdf5', color: '#047857' }}>{fmtAuditVal(new_value)}</span>
        </div>
      )}
      {Array.isArray(changes) && changes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {changes.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#475569' }}>{c.field_label ?? c.field}:</span>
              <span style={{ ...pill, background: '#fef2f2', color: '#b91c1c' }}>{fmtAuditVal(c.previous_value)}</span>
              <span style={{ color: '#94a3b8' }}>→</span>
              <span style={{ ...pill, background: '#ecfdf5', color: '#047857' }}>{fmtAuditVal(c.new_value)}</span>
            </div>
          ))}
        </div>
      )}
      {reason && (
        <div style={{ fontSize: 12, color: '#475569' }}><strong>Reason:</strong> {reason}</div>
      )}
      {extras.length > 0 && (
        <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {extras.map(([k, v]) => <span key={k}>{k}: {fmtAuditVal(v)}</span>)}
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS = {
  subject:   'Subject',
  form:      'Form',
  site_role: 'Site Role',
};

// Friendly labels for the raw resource_type stored on each log row. CRF form
// events are logged under 'subject_form_data' — show them as "CRF" instead of
// the internal table name.
const RESOURCE_LABELS = {
  subject_form_data: 'CRF Form',
  subject:           'Subject',
  site_role:         'Site Role',
  form:              'Form',
};
const resourceLabelOf = (rt) => (rt ? (RESOURCE_LABELS[rt] ?? rt) : null);

export default function ActivityLogDrawer({
  open, resourceType, resourceId, resourceLabel, onClose,
}) {
  const params = useParams();
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Re-fetch whenever the drawer opens for a different resource.
  useEffect(() => {
    if (!open || !resourceType || !resourceId) return undefined;
    let cancelled = false;
    setError(null);
    setLoading(true);
    sponsorAxiosClient.get('/api/v1/sponsor/workspace/activity-logs', {
      params: {
        // sponsorAxiosClient already injects study_id + environment from
        // sponsorStudyContext, so the drill-in just needs the resource keys.
        resource_type: resourceType,
        resource_id:   resourceId,
        limit:         100,
      },
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res?.items ?? res?.data ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load activity log.');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // Re-run on resource change AND on `open` toggling true again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resourceType, resourceId, params.studyId]);

  if (!open) return null;

  return (
    <div className={s.scrim} onClick={onClose} role="presentation">
      <aside
        className={s.drawer}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Activity log"
      >
        <header className={s.head}>
          <div className={s.headTitle}>
            <FileText size={14} />
            <div>
              <h2 className={s.title}>Activity Log</h2>
              <p className={s.subtitle}>
                {TYPE_LABELS[resourceType] ?? 'Resource'} · {resourceLabel || resourceId}
              </p>
            </div>
          </div>
          <div className={s.headActions}>
            <button
              type="button"
              className={s.iconBtn}
              onClick={() => {
                setLoading(true);
                setError(null);
                sponsorAxiosClient.get('/api/v1/sponsor/workspace/activity-logs', {
                  params: { resource_type: resourceType, resource_id: resourceId, limit: 100 },
                })
                  .then((res) => setItems(res?.items ?? res?.data ?? []))
                  .catch((err) => setError(err?.message ?? 'Failed to refresh.'))
                  .finally(() => setLoading(false));
              }}
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? s.spin : ''} />
            </button>
            <button type="button" className={s.iconBtn} onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </header>

        <div className={s.body}>
          {loading && items.length === 0 ? (
            <div className={s.loading}>
              <Loader2 size={16} className={s.spin} /> Loading activity…
            </div>
          ) : error ? (
            <div className={s.empty}>{error}</div>
          ) : items.length === 0 ? (
            <div className={s.empty}>
              No activity recorded for this {TYPE_LABELS[resourceType]?.toLowerCase() ?? 'resource'} yet.
            </div>
          ) : (
            <ul className={s.timeline}>
              {items.map((item) => (
                <li key={item.id ?? item.activity_id ?? item.activityId} className={s.entry}>
                  <span className={s.dot} aria-hidden="true" />
                  <div className={s.entryBody}>
                    <div className={s.entryHead}>
                      <span className={s.action}>{item.action ?? item.actionType}</span>
                      <span className={s.time}>{formatDateTime(item.created_at ?? item.timestamp)}</span>
                    </div>
                    <div className={s.entryMeta}>
                      {(item.actor_name ?? item.user_name ?? item.userName ?? item.metadata?.actor_name) && (
                        <span>by <strong>{item.actor_name ?? item.user_name ?? item.userName ?? item.metadata?.actor_name}</strong></span>
                      )}
                      {resourceLabelOf(item.resource_type ?? item.module) && <span>· {resourceLabelOf(item.resource_type ?? item.module)}</span>}
                      {(item.ipAddress ?? item.ip_address) && <span>· IP {item.ipAddress ?? item.ip_address}</span>}
                    </div>
                    <AuditChange metadata={item.metadata} />
                    {(item.description ?? item.action_description ?? item.metadata?.description) && (
                      <p className={s.entryDesc}>{item.description ?? item.action_description ?? item.metadata?.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

ActivityLogDrawer.propTypes = {
  open:          PropTypes.bool.isRequired,
  resourceType:  PropTypes.oneOf(['subject', 'form', 'site_role']).isRequired,
  resourceId:    PropTypes.string,
  resourceLabel: PropTypes.string,
  onClose:       PropTypes.func.isRequired,
};

ActivityLogDrawer.defaultProps = {
  resourceId:    '',
  resourceLabel: '',
};
