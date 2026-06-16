import { useState, useEffect } from 'react';
import {
  User, FileText, FileIcon, PenLine,
  CheckCircle, XCircle, Download,
} from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorConsentReviewClient } from '@/features/sponsor/api/sponsorConsentReviewClient';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { resolveFileUrl } from '@/api/fileUrl';
import { useProtectedFileUrl, isProtectedUrl, downloadProtectedFile } from '@/api/protectedFile';
import ConsentFormFill from '@/features/sponsor/components/consent/ConsentFormFill';
import { normalizeConsentBlocks } from '@/utils/consentContent';
import styles from './ConsentDetailsModal.module.css';

const isImageDoc = (doc) =>
  /^image\//i.test(doc.type || '') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(doc.name || doc.url || '');

const STATUS_META = {
  Pending:  { color: '#f59e0b', bg: '#fffbeb', label: 'Pending'  },
  Approved: { color: '#10b981', bg: '#ecfdf5', label: 'Approved' },
  Rejected: { color: '#dc2626', bg: '#fef2f2', label: 'Rejected' },
  Expired:  { color: '#94a3b8', bg: '#f8fafc', label: 'Expired'  },
};

// "Submitted Data" tab intentionally removed — the filled values are already
// shown in the "Consent Form" tab (the consent form rendered with the user's
// answers), so a separate raw key/value dump is redundant.
const TABS = [
  { key: 'overview',   label: 'Overview',     icon: User      },
  { key: 'sections',   label: 'Consent Form', icon: FileText  },
  { key: 'documents',  label: 'Documents',    icon: FileIcon  },
];

const fmtDate      = (iso) => formatDateTime(iso) || '—';
const fmtDateShort = (iso) => formatDate(iso)     || '—';
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Electronic signature image — a private uploaded file (new) or a legacy
// inline data URL. Streams protected refs through the authenticated route.
function SigImage({ url }) {
  const prot = useProtectedFileUrl(isProtectedUrl(url) ? url : null);
  if (!url) return <div className={styles.sigPlaceholder}><PenLine size={20} /> Signature on file</div>;
  let src;
  if (isProtectedUrl(url)) { if (prot.loading) return <div className={styles.sigPlaceholder}>Loading…</div>; src = prot.src; }
  else if (/^data:/.test(url)) src = url;
  else src = resolveFileUrl(url);
  if (!src) return <div className={styles.sigPlaceholder}><PenLine size={20} /> Signature on file</div>;
  return <img src={src} alt="Signature" className={styles.sigImage} />;
}

// One uploaded consent document. Consent files are private (served only via the
// authenticated route), so the thumbnail + "View" link resolve through the
// protected loader; download goes through the parent's protected download.
function DocRow({ doc, onDownload }) {
  const prot   = useProtectedFileUrl(doc.url);
  const isProt = isProtectedUrl(doc.url);
  const href   = isProt ? prot.src : resolveFileUrl(doc.url);
  const ready  = !isProt || (!prot.loading && href);

  return (
    <div className={styles.docRow} style={{ alignItems: 'center' }}>
      {isImageDoc(doc) && href
        ? <a href={href} target="_blank" rel="noreferrer">
            <img src={href} alt={doc.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
          </a>
        : <FileIcon size={15} className={styles.docIcon} />}
      <div className={styles.docInfo}>
        <span className={styles.docName}>{doc.name}</span>
        {doc.size > 0 && <span className={styles.docSize}>{fmtSize(doc.size)}</span>}
      </div>
      {ready ? (
        <>
          <a href={href} target="_blank" rel="noreferrer" className={styles.docDownload}>View</a>
          <button type="button" onClick={onDownload} className={styles.docDownload}
            style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>
            <Download size={13} /> Download
          </button>
        </>
      ) : (
        <span className={styles.docSize}>{prot.error ? 'Unavailable' : 'Loading…'}</span>
      )}
    </div>
  );
}


export default function ConsentDetailsModal({ studyId, submission, onClose, onApprove, onReject }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [details,   setDetails]   = useState(null);
  const [loading,   setLoading]   = useState(true);

  // Force a real download. A cross-origin <a download> is ignored by browsers
  // (it just opens the file), so fetch the bytes and save via a same-origin
  // blob URL. Falls back to opening in a new tab if the fetch is blocked.
  const downloadDoc = async (doc) => {
    // Consent docs are private → stream via the authenticated route.
    if (isProtectedUrl(doc.url)) {
      try { await downloadProtectedFile(doc.url, doc.name); } catch { /* surfaced below */ }
      return;
    }
    const url = resolveFileUrl(doc.url);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.name || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

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
            <SigImage url={d.signature.imageUrl} />
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
    // Preferred: re-render the EXACT consent form the site user saw, filled with
    // their answers, read-only — so the reviewer reviews the same thing.
    const blocks = normalizeConsentBlocks(details?.formStructure?.blocks);
    if (Array.isArray(blocks) && blocks.length) {
      return (
        <div className={styles.section}>
          <ConsentFormFill blocks={blocks} values={details?.responses ?? {}} onChange={() => {}} disabled />
        </div>
      );
    }
    // Fallback (legacy section-based templates).
    const sections = details?.sections ?? [];
    if (!sections.length) return <p className={styles.empty}>No consent form available.</p>;
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

  function renderDocuments() {
    const docs = details?.documents ?? [];
    if (!docs.length) return <p className={styles.empty}>No documents uploaded.</p>;
    return (
      <div className={styles.section}>
        <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 12px' }}>
          Review the files the site user uploaded. Open or download each to verify before approving;
          reject if there’s an issue and the user will be asked to resubmit.
        </p>
        <div className={styles.docList}>
          {docs.map((doc) => (
            <DocRow key={doc.id} doc={doc} onDownload={() => downloadDoc(doc)} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 10 }}>
          <button className={styles.btnClose} onClick={onClose} type="button">Close</button>
          {d?.status === 'Pending' && (onApprove || onReject) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {onReject && (
                <button type="button" onClick={() => onReject(d)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
                    border: '1px solid #dc2626', background: '#fff', color: '#dc2626', fontWeight: 600, cursor: 'pointer' }}>
                  <XCircle size={15} /> Reject
                </button>
              )}
              {onApprove && (
                <button type="button" onClick={() => onApprove(d)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
                    border: '1px solid #059669', background: '#059669', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  <CheckCircle size={15} /> Approve
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className={styles.wrapper}>
        {/* Pinned header — status strip + tabs stay put while content scrolls. */}
        <div className={styles.stickyHead}>
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
              {activeTab === 'documents' && renderDocuments()}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
