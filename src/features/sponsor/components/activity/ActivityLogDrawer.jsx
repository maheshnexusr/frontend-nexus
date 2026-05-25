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

const TYPE_LABELS = {
  subject: 'Subject',
  form:    'Form',
};

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
                      {(item.actor_name ?? item.user_name) && (
                        <span>by <strong>{item.actor_name ?? item.user_name}</strong></span>
                      )}
                      {item.resource_type && <span>· {item.resource_type}</span>}
                    </div>
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <pre className={s.entryMetadata}>{JSON.stringify(item.metadata, null, 2)}</pre>
                    )}
                    {item.action_description && (
                      <p className={s.entryDesc}>{item.action_description}</p>
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
  resourceType:  PropTypes.oneOf(['subject', 'form']).isRequired,
  resourceId:    PropTypes.string,
  resourceLabel: PropTypes.string,
  onClose:       PropTypes.func.isRequired,
};

ActivityLogDrawer.defaultProps = {
  resourceId:    '',
  resourceLabel: '',
};
