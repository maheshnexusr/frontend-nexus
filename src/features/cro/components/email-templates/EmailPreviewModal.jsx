/**
 * EmailPreviewModal — renders an email template with sample placeholder data.
 * Replaces {PlaceholderName} tokens in both subject and body with demo values.
 */

import { X, Mail } from 'lucide-react';
import styles from './EmailPreviewModal.module.css';

// ── Sample replacement data ───────────────────────────────────────────────────
const SAMPLE_DATA = {
  '{FullName}':    'Jane Doe',
  '{Email}':       'jane.doe@example.com',
  '{StudyName}':   'TRIAL-X Phase II',
  '{SponsorName}': 'Pfizer Clinical Research',
  '{SiteName}':    'City Medical Center',
  '{RoleName}':    'Principal Investigator',
  '{Link}':        'https://app.example.com/action/abc123',
  '{OTP}':         '847291',
  '{ExpiryDate}':  'March 28, 2026 at 11:59 PM',
  '{SystemName}':  'SclinNexus EDC',
  '{Date}':        new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
};

function replacePlaceholders(text = '') {
  return Object.entries(SAMPLE_DATA).reduce(
    (acc, [key, val]) => acc.replaceAll(key, `<mark class="ph-highlight">${val}</mark>`),
    text,
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmailPreviewModal({ template, onClose }) {
  const subject = replacePlaceholders(template.subjectLine);
  const body    = replacePlaceholders(template.emailBody);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Mail size={16} className={styles.headerIcon} />
            <div>
              <h2 className={styles.title}>Email Preview</h2>
              <p className={styles.sub}>
                Highlighted values are sample data replacing placeholders.
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Email frame */}
        <div className={styles.body}>
          {/* Meta */}
          <div className={styles.meta}>
            {template.fromName && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>From</span>
                <span className={styles.metaVal}>
                  {template.fromName}
                  {template.fromEmail && ` <${template.fromEmail}>`}
                </span>
              </div>
            )}
            {template.cc && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>CC</span>
                <span className={styles.metaVal}>{template.cc}</span>
              </div>
            )}
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Subject</span>
              <span
                className={`${styles.metaVal} ${styles.subjectVal}`}
                dangerouslySetInnerHTML={{ __html: subject || '<em>No subject</em>' }}
              />
            </div>
          </div>

          {/* Body */}
          <div className={styles.emailBody}>
            {body
              ? <div dangerouslySetInnerHTML={{ __html: body }} />
              : <p className={styles.emptyBody}>No email body content.</p>
            }
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerMeta}>
            {template.emailCategory && (
              <span className={styles.chip}>{template.emailCategory}</span>
            )}
            {template.templateType && (
              <span className={styles.chip}>{template.templateType}</span>
            )}
            <span className={`${styles.chip} ${template.status === 'Active' ? styles.chipActive : styles.chipInactive}`}>
              {template.status}
            </span>
          </div>
          <button className={styles.btnClose} onClick={onClose}>
            Close Preview
          </button>
        </div>
      </div>

      {/* Inject highlight style */}
      <style>{`
        .ph-highlight {
          background: #fef9c3;
          color: #854d0e;
          border-radius: 3px;
          padding: 0 2px;
          font-style: normal;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
