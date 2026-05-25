import { useState, useEffect } from 'react';
import {
  Info, MessageSquare, Clock, AlertTriangle,
  CheckCircle, RotateCcw, Download, Paperclip,
  User, ArrowUp,
} from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorQueryClient, PRIORITY_SLA_DAYS } from '@/features/sponsor/api/sponsorQueryClient';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import styles from './QueryDetailsModal.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_META = {
  High:   { color: '#dc2626', bg: '#fef2f2' },
  Medium: { color: '#f59e0b', bg: '#fffbeb' },
  Low:    { color: '#3b82f6', bg: '#eff6ff' },
};
const STATUS_META = {
  Open:        { color: '#2563eb', bg: '#eff6ff' },
  'In Progress':{ color: '#f59e0b', bg: '#fffbeb' },
  Resolved:    { color: '#7c3aed', bg: '#f5f3ff' },
  Closed:      { color: '#10b981', bg: '#ecfdf5' },
  Overdue:     { color: '#dc2626', bg: '#fef2f2' },
};

const fmtDate      = (iso) => formatDateTime(iso) || '—';
const fmtDateShort = (iso) => formatDate(iso)     || '—';

const TABS = [
  { key: 'info',     label: 'Query Info',      icon: Info           },
  { key: 'thread',   label: 'Response Thread', icon: MessageSquare  },
  { key: 'audit',    label: 'Audit Trail',     icon: Clock          },
];

const AUDIT_ICONS = {
  'query raised':    <AlertTriangle size={13} style={{ color: '#f59e0b' }} />,
  'response added':  <MessageSquare size={13} style={{ color: '#2563eb' }} />,
  'status changed':  <ArrowUp       size={13} style={{ color: '#7c3aed' }} />,
  'query closed':    <CheckCircle   size={13} style={{ color: '#10b981' }} />,
  'query reopened':  <RotateCcw     size={13} style={{ color: '#f59e0b' }} />,
  'query escalated': <AlertTriangle size={13} style={{ color: '#dc2626' }} />,
};

export default function QueryDetailsModal({ studyId, query, onClose, onAction }) {
  const [activeTab, setActiveTab] = useState('info');
  const [details,   setDetails]   = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    sponsorQueryClient.getById(studyId, query.id)
      .then(setDetails)
      .catch(() => setDetails({ ...query, responses: [], auditTrail: [] }))
      .finally(() => setLoading(false));
  }, [studyId, query]);

  const d = details ?? query;
  const pm = PRIORITY_META[d?.priority] ?? PRIORITY_META.Medium;
  const sm = STATUS_META[d?.status]     ?? STATUS_META.Open;
  const sla = PRIORITY_SLA_DAYS[d?.priority] ?? 7;

  function renderInfo() {
    return (
      <div className={styles.section}>
        {/* Header grid */}
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Query ID</span><span className={styles.infoValue}><code className={styles.qid}>{d.id}</code></span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Site</span><span className={styles.infoValue}>{d.siteName ? `${d.siteName}${d.siteCode ? ` (${d.siteCode})` : ''}` : '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Subject ID</span><span className={styles.infoValue}>{d.subjectId || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Form / CRF</span><span className={styles.infoValue}>{d.formName || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Field Name</span><span className={styles.infoValue}>{d.fieldName || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Current Value</span><span className={styles.infoValue}>{d.currentFieldValue || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Raised By</span><span className={styles.infoValue}>{d.raisedBy || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Raised Date</span><span className={styles.infoValue}>{fmtDate(d.raisedDate)}</span></div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Priority</span>
            <span className={styles.badge} style={{ color: pm.color, background: pm.bg }}>{d.priority}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Status</span>
            <span className={styles.badge} style={{ color: sm.color, background: sm.bg }}>{d.status}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Days Open</span>
            <span className={styles.infoValue}>{d.daysOpen ?? 0} day{d.daysOpen !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>SLA ({sla}d)</span>
            <span className={styles.infoValue} style={{ color: (d.slaRemaining ?? 0) < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
              {(d.slaRemaining ?? 0) >= 0 ? `${d.slaRemaining}d remaining` : `${Math.abs(d.slaRemaining ?? 0)}d overdue`}
            </span>
          </div>
        </div>

        {/* Query details card */}
        <div className={styles.detailCard}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Query Text</span>
            <p className={styles.detailValue}>{d.queryText || '—'}</p>
          </div>
          {d.queryReason && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Query Reason</span>
              <span className={styles.reasonPill}>{d.queryReason}</span>
            </div>
          )}
          {d.expectedValue && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Expected Value</span>
              <span className={styles.detailValue}>{d.expectedValue}</span>
            </div>
          )}
          {d.referenceSource && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Reference Source</span>
              <span className={styles.detailValue}>{d.referenceSource}</span>
            </div>
          )}
          {d.assignedTo && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Assigned To</span>
              <span className={styles.detailValue}>{d.assignedTo}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderThread() {
    const responses = details?.responses ?? [];
    if (!responses.length) {
      return (
        <div className={styles.emptyThread}>
          <MessageSquare size={32} strokeWidth={1.25} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No responses yet.</p>
        </div>
      );
    }
    return (
      <div className={styles.thread}>
        {/* Original query as first bubble */}
        <div className={styles.bubble}>
          <div className={styles.bubbleAvatar}><User size={13} /></div>
          <div className={styles.bubbleBody}>
            <div className={styles.bubbleMeta}>
              <span className={styles.bubbleName}>{d.raisedBy}</span>
              <span className={styles.bubbleRole}>Query Raiser</span>
              <span className={styles.bubbleTime}>{fmtDate(d.raisedDate)}</span>
            </div>
            <div className={styles.bubbleText}>{d.queryText}</div>
            <div className={styles.bubbleOriginalTag}>Original Query</div>
          </div>
        </div>

        {responses.map((r, i) => (
          r.isSystem ? (
            <div key={r.id || i} className={styles.systemMsg}>
              <span className={styles.systemMsgText}>{r.responseText}</span>
              <span className={styles.systemMsgTime}>{fmtDate(r.timestamp)}</span>
            </div>
          ) : (
            <div key={r.id || i} className={styles.bubble}>
              <div className={styles.bubbleAvatar}><User size={13} /></div>
              <div className={styles.bubbleBody}>
                <div className={styles.bubbleMeta}>
                  <span className={styles.bubbleName}>{r.responderName}</span>
                  {r.responderRole && <span className={styles.bubbleRole}>{r.responderRole}</span>}
                  <span className={styles.bubbleTime}>{fmtDate(r.timestamp)}</span>
                </div>
                <div className={styles.bubbleText}>{r.responseText}</div>
                {r.statusChange && (
                  <div className={styles.statusChange}>
                    Status → <strong>{r.statusChange}</strong>
                  </div>
                )}
                {r.updatedFieldValue && (
                  <div className={styles.fieldUpdate}>
                    Field updated to: <strong>{r.updatedFieldValue}</strong>
                  </div>
                )}
                {r.attachments?.length > 0 && (
                  <div className={styles.attachments}>
                    <Paperclip size={12} />
                    {r.attachments.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className={styles.attachLink}>
                        {a.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    );
  }

  function renderAudit() {
    const trail = details?.auditTrail ?? [];
    if (!trail.length) return <p className={styles.emptyText}>No audit entries found.</p>;
    return (
      <div className={styles.timeline}>
        {trail.map((entry, i) => (
          <div key={entry.id || i} className={styles.timelineItem}>
            <div className={styles.timelineDot}>
              {AUDIT_ICONS[entry.action?.toLowerCase()] ?? <Clock size={12} />}
            </div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineAction}>{entry.action}</div>
              <div className={styles.timelineMeta}>
                {entry.performedBy && <span>by <strong>{entry.performedBy}</strong></span>}
                <span>{fmtDate(entry.timestamp)}</span>
              </div>
              {entry.details && <p className={styles.timelineDetails}>{entry.details}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isPending = d?.status === 'Open' || d?.status === 'In Progress' || d?.status === 'Overdue';
  const isClosed  = d?.status === 'Closed';

  return (
    <Modal
      open
      onClose={onClose}
      title="Query Details"
      size="lg"
      footer={
        <div className={styles.footer}>
          <div className={styles.footerActions}>
            {isPending && (
              <>
                <button className={styles.btnRespond} onClick={() => onAction('respond', d)} type="button">
                  <MessageSquare size={13} /> Respond
                </button>
                <button className={styles.btnClose_}  onClick={() => onAction('close',   d)} type="button">
                  <CheckCircle  size={13} /> Close Query
                </button>
                <button className={styles.btnEscalate} onClick={() => onAction('escalate', d)} type="button">
                  <AlertTriangle size={13} /> Escalate
                </button>
              </>
            )}
            {isClosed && (
              <button className={styles.btnReopen} onClick={() => onAction('reopen', d)} type="button">
                <RotateCcw size={13} /> Reopen
              </button>
            )}
          </div>
          <button className={styles.btnDismiss} onClick={onClose} type="button">Close</button>
        </div>
      }
    >
      <div className={styles.wrapper}>
        {/* Status strip */}
        <div className={styles.strip} style={{ background: sm.bg, borderColor: sm.color }}>
          <div className={styles.stripLeft}>
            <code className={styles.stripId}>{d?.id}</code>
            <span className={styles.stripField}>{d?.fieldName && `${d?.formName} → ${d?.fieldName}`}</span>
          </div>
          <div className={styles.stripRight}>
            <span className={styles.badge} style={{ color: pm.color, background: pm.bg, marginRight: 6 }}>{d?.priority}</span>
            <span className={styles.badge} style={{ color: sm.color, background: sm.bg }}>{d?.status}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={13} /> {label}
              {key === 'thread' && details?.responses?.length > 0 && (
                <span className={styles.tabBadge}>{details.responses.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={styles.tabContent}>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /> Loading…</div>
          ) : (
            <>
              {activeTab === 'info'   && renderInfo()}
              {activeTab === 'thread' && renderThread()}
              {activeTab === 'audit'  && renderAudit()}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
