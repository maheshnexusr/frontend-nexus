/**
 * VisitTimeline — subject-centric visit + forms outline.
 *
 * Props:
 *   visits        — array of `{ id, name, order, scheduledDate, status,
 *                                forms: [{ id, name, status, lastUpdated }] }`
 *   loading       — when true, shows skeletons
 *   onSelectForm  — (visit, form) => void   (typically navigates to the runner)
 *
 * Status colors are intentionally lined up with the form-status palette
 * from `formRuntimeSlice` so the same statuses look consistent across
 * the timeline and the runner top bar.
 */

import { CalendarDays, Check, AlertCircle, Lock, Snowflake, PenLine, Eye, FileText } from 'lucide-react';

const VISIT_STATUS_META = {
  'Completed':   { color: '#16a34a', bg: '#dcfce7', Icon: Check       },
  'In Progress': { color: '#2563eb', bg: '#dbeafe', Icon: Eye         },
  'Overdue':     { color: '#dc2626', bg: '#fef2f2', Icon: AlertCircle },
  'Pending':     { color: '#475569', bg: '#f1f5f9', Icon: CalendarDays },
};

const FORM_STATUS_ICON = {
  'Signed':      PenLine,
  'Locked':      Lock,
  'Frozen':      Snowflake,
  'Verified':    Check,
  'Reviewed':    Eye,
  'Completed':   Check,
  'In Progress': FileText,
  'Not Started': FileText,
};

const FORM_STATUS_COLOR = {
  'Signed':      '#6d28d9',
  'Locked':      '#92400e',
  'Frozen':      '#1e40af',
  'Verified':    '#15803d',
  'Reviewed':    '#0e7490',
  'Completed':   '#1d4ed8',
  'In Progress': '#475569',
  'Not Started': '#94a3b8',
};

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VisitTimeline({ visits = [], loading = false, onSelectForm }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{ height: 70, background: '#f1f5f9', borderRadius: 10, animation: 'pulse 1.4s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #e2e8f0', borderRadius: 10 }}>
        <CalendarDays size={32} strokeWidth={1.25} style={{ marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 13 }}>No visits configured for this subject yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {visits.map((visit) => {
        const meta = VISIT_STATUS_META[visit.status] ?? VISIT_STATUS_META.Pending;
        const StatusIcon = meta.Icon;
        const sched = fmtDate(visit.scheduledDate);
        const done  = fmtDate(visit.completedDate);
        return (
          <div
            key={visit.id}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
            }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 8,
                  background: meta.bg, color: meta.color,
                }}
              >
                <StatusIcon size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{visit.name || `Visit ${visit.order}`}</span>
                  <span
                    style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 999, background: meta.bg, color: meta.color,
                    }}
                  >
                    {visit.status}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {sched && <>Scheduled {sched}</>}
                  {sched && done && <span style={{ margin: '0 8px' }}>·</span>}
                  {done && <>Completed {done}</>}
                  {visit.windowDays && <>{(sched || done) && <span style={{ margin: '0 8px' }}>·</span>}±{visit.windowDays} day window</>}
                </div>
              </div>
            </header>

            {visit.forms.length === 0 ? (
              <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                No forms in this visit.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 8,
                }}
              >
                {visit.forms.map((form) => {
                  const FIcon = FORM_STATUS_ICON[form.status] ?? FileText;
                  const color = FORM_STATUS_COLOR[form.status] ?? '#94a3b8';
                  return (
                    <button
                      key={form.id}
                      type="button"
                      onClick={() => onSelectForm?.(visit, form)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 10, textAlign: 'left',
                        background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: 8, cursor: 'pointer',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(37,99,235,.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <FIcon size={14} style={{ color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {form.name}
                        </div>
                        <div style={{ fontSize: 10.5, color, fontWeight: 600 }}>
                          {form.status}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
