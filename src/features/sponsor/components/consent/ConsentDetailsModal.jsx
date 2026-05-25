import { useState, useEffect } from 'react';
import {
  User, FileText, Database, FileIcon, PenLine,
  Clock, AlertCircle, CheckCircle, XCircle, Download,
  ChevronRight,
} from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorConsentReviewClient } from '@/features/sponsor/api/sponsorConsentReviewClient';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import styles from './ConsentDetailsModal.module.css';

const STATUS_META = {
  Pending:  { color: '#f59e0b', bg: '#fffbeb', label: 'Pending'  },
  Approved: { color: '#10b981', bg: '#ecfdf5', label: 'Approved' },
  Rejected: { color: '#dc2626', bg: '#fef2f2', label: 'Rejected' },
  Expired:  { color: '#94a3b8', bg: '#f8fafc', label: 'Expired'  },
};

const TABS = [
  { key: 'overview',   label: 'Overview',        icon: User      },
  { key: 'sections',   label: 'Consent Sections', icon: FileText  },
  { key: 'data',       label: 'Submitted Data',  icon: Database  },
  { key: 'documents',  label: 'Documents',       icon: FileIcon  },
  { key: 'audit',      label: 'Audit Trail',     icon: Clock     },
];

const fmtDate      = (iso) => formatDateTime(iso) || '—';
const fmtDateShort = (iso) => formatDate(iso)     || '—';
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const AUDIT_ICONS = {
  submitted:   <Clock    size={14} />,
  approved:    <CheckCircle size={14} style={{ color: '#10b981' }} />,
  rejected:    <XCircle  size={14} style={{ color: '#dc2626' }} />,
  resubmitted: <ChevronRight size={14} />,
  downloaded:  <Download size={14} />,
};

export default function ConsentDetailsModal({ studyId, submission, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [details,   setDetails]   = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!submission) return;
    setLoading(true);
    sponsorConsentReviewClient.getById(studyId, submission.id)
      .then(setDetails)
      .catch(() => setDetails({ ...submission, sections: [], submittedData: {}, documents: [], auditTrail: [] }))
      .finally(() => setLoading(false));
  }, [studyId, submission]);

  const d = details ?? submission;
  const status = STATUS_META[d?.status] ?? STATUS_META.Pending;

  function renderOverview() {
    return (
      <div className={styles.section}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}><span className={styles.infoLabel}>User Name</span><span className={styles.infoValue}>{d.userName || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Email</span><span className={styles.infoValue}>{d.userEmail || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Role</span><span className={styles.infoValue}>{d.role || '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Site</span><span className={styles.infoValue}>{d.siteName ? `${d.siteName} (${d.siteCode})` : '—'}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Submission Date</span><span className={styles.infoValue}>{fmtDate(d.submissionDate)}</span></div>
          <div className={styles.infoItem}><span className={styles.infoLabel}>Consent Version</span><span className={styles.infoValue}>v{d.version}</span></div>
          {d.metadata?.ipAddress && (
            <div className={styles.infoItem}><span className={styles.infoLabel}>IP Address</span><span className={styles.infoValue}>{d.metadata.ipAddress}</span></div>
          )}
        </div>

        {d.approvalDetails && (
          <div className={styles.reviewBox} style={{ borderColor: '#10b981', background: '#f0fdf4' }}>
            <div className={styles.reviewTitle} style={{ color: '#059669' }}>
              <CheckCircle size={14} /> Approved
            </div>
            <div className={styles.reviewMeta}>
              by <strong>{d.approvalDetails.reviewerName || 'Reviewer'}</strong> on {fmtDate(d.approvalDetails.timestamp)}
            </div>
            {d.approvalDetails.customMessage && (
              <p className={styles.reviewMsg}>{d.approvalDetails.customMessage}</p>
            )}
            {d.approvalDetails.effectiveDate && (
              <div className={styles.reviewDates}>
                <span>Effective: <strong>{fmtDateShort(d.approvalDetails.effectiveDate)}</strong></span>
                {d.approvalDetails.expiryDate && (
                  <span>Expires: <strong>{fmtDateShort(d.approvalDetails.expiryDate)}</strong></span>
                )}
              </div>
            )}
          </div>
        )}

        {d.rejectionDetails && (
          <div className={styles.reviewBox} style={{ borderColor: '#dc2626', background: '#fef2f2' }}>
            <div className={styles.reviewTitle} style={{ color: '#dc2626' }}>
              <XCircle size={14} /> Rejected
            </div>
            <div className={styles.reviewMeta}>
              by <strong>{d.rejectionDetails.reviewerName || 'Reviewer'}</strong> on {fmtDate(d.rejectionDetails.timestamp)}
            </div>
            <p className={styles.reviewMsg}><strong>Reason:</strong> {d.rejectionDetails.rejectionReason}</p>
            {d.rejectionDetails.customMessage && (
              <p className={styles.reviewMsg}>{d.rejectionDetails.customMessage}</p>
            )}
          </div>
        )}

        {d.signature && (
          <div className={styles.sigBox}>
            <span className={styles.sigLabel}>Electronic Signature</span>
            {d.signature.imageUrl
              ? <img src={d.signature.imageUrl} alt="Signature" className={styles.sigImage} />
              : <div className={styles.sigPlaceholder}><PenLine size={20} /> Signature on file</div>
            }
            <span className={styles.sigTimestamp}>Signed: {fmtDate(d.signature.timestamp)}</span>
          </div>
        )}

        {d.witness && (
          <div className={styles.witnessBox}>
            <span className={styles.sectionSubTitle}>Witness</span>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}><span className={styles.infoLabel}>Witness Name</span><span className={styles.infoValue}>{d.witness.name}</span></div>
              <div className={styles.infoItem}><span className={styles.infoLabel}>Witness Date</span><span className={styles.infoValue}>{fmtDateShort(d.witness.date)}</span></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderSections() {
    const sections = details?.sections ?? [];
    if (!sections.length) return <p className={styles.empty}>No consent sections available.</p>;
    return (
      <div className={styles.section}>
        {sections.map((s, i) => (
          <div key={s.id || i} className={styles.consentSection}>
            <div className={styles.consentSectionHeader}>
              <span className={styles.paraOrder}>§{i + 1}</span>
              <span className={styles.consentSectionTitle}>{s.sectionTitle}</span>
              {s.isMandatory && (
                <span className={s.acknowledged ? styles.ackBadgeYes : styles.ackBadgeNo}>
                  {s.acknowledged ? '✓ Acknowledged' : '✗ Not acknowledged'}
                </span>
              )}
            </div>
            <p className={styles.consentContent}>{s.content}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderData() {
    const data = details?.submittedData ?? {};
    const entries = Object.entries(data);
    if (!entries.length) return <p className={styles.empty}>No submitted field data available.</p>;
    return (
      <div className={styles.section}>
        <div className={styles.dataGrid}>
          {entries.map(([key, value]) => (
            <div key={key} className={styles.dataItem}>
              <span className={styles.dataLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className={styles.dataValue}>{value?.toString() || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderDocuments() {
    const docs = details?.documents ?? [];
    if (!docs.length) return <p className={styles.empty}>No documents uploaded.</p>;
    return (
      <div className={styles.section}>
        <div className={styles.docList}>
          {docs.map((doc) => (
            <div key={doc.id} className={styles.docRow}>
              <FileIcon size={15} className={styles.docIcon} />
              <div className={styles.docInfo}>
                <span className={styles.docName}>{doc.name}</span>
                {doc.size > 0 && <span className={styles.docSize}>{fmtSize(doc.size)}</span>}
              </div>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noreferrer" className={styles.docDownload}>
                  <Download size={13} /> Download
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderAudit() {
    const trail = details?.auditTrail ?? [];
    if (!trail.length) return <p className={styles.empty}>No audit trail entries found.</p>;
    return (
      <div className={styles.section}>
        <div className={styles.timeline}>
          {trail.map((entry, i) => (
            <div key={entry.id || i} className={styles.timelineItem}>
              <div className={styles.timelineDot}>
                {AUDIT_ICONS[entry.action?.toLowerCase()] ?? <Clock size={13} />}
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineAction}>{entry.action}</div>
                <div className={styles.timelineMeta}>
                  {entry.performedBy && <span>by <strong>{entry.performedBy}</strong></span>}
                  <span>{fmtDate(entry.timestamp)}</span>
                </div>
                {entry.notes && <p className={styles.timelineNotes}>{entry.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Consent Submission Details"
      size="lg"
      footer={
        <button
          className={styles.btnClose}
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      }
    >
      <div className={styles.wrapper}>
        {/* Status strip */}
        <div className={styles.statusStrip} style={{ background: status.bg, borderColor: status.color }}>
          <div className={styles.stripLeft}>
            <span className={styles.stripName}>{d?.userName}</span>
            <span className={styles.stripMeta}>{d?.role} · {d?.siteName || d?.siteCode}</span>
          </div>
          <span className={styles.statusBadge} style={{ color: status.color, background: `${status.color}18`, border: `1px solid ${status.color}40` }}>
            {status.label}
          </span>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={styles.tabContent}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              Loading details…
            </div>
          ) : (
            <>
              {activeTab === 'overview'  && renderOverview()}
              {activeTab === 'sections'  && renderSections()}
              {activeTab === 'data'      && renderData()}
              {activeTab === 'documents' && renderDocuments()}
              {activeTab === 'audit'     && renderAudit()}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
