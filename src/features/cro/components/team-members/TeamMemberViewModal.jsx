/**
 * TeamMemberViewModal — read-only detail view for a team member.
 * Props: { member, onClose, onEdit }
 */

import { useEffect } from 'react';
import { X, Pencil, Mail, Phone, Shield, BookOpen } from 'lucide-react';
import styles from './TeamMemberViewModal.module.css';

export default function TeamMemberViewModal({ member, onClose, onEdit }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!member) return null;

  const initials = (member.fullName ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const studies = Array.isArray(member.assignedStudies) ? member.assignedStudies : [];

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>Team Member Details</span>
          <div className={styles.headerActions}>
            <button className={styles.editBtn} onClick={onEdit} title="Edit">
              <Pencil size={14} />
              Edit
            </button>
            <button className={styles.closeBtn} onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Profile section */}
        <div className={styles.profile}>
          <div className={styles.avatarWrap}>
            {member.photograph
              ? <img src={member.photograph} alt={member.fullName} className={styles.avatarImg} />
              : <div className={styles.avatarInitials}>{initials}</div>
            }
          </div>
          <div className={styles.profileInfo}>
            <h2 className={styles.name}>{member.fullName}</h2>
            {member.roleName && (
              <span className={styles.roleBadge}>
                <Shield size={11} />
                {member.roleName}
              </span>
            )}
          </div>
        </div>

        {/* Detail rows */}
        <div className={styles.details}>
          <DetailRow
            icon={<Mail size={14} />}
            label="Email Address"
            value={member.email || '—'}
          />
          <DetailRow
            icon={<Phone size={14} />}
            label="Contact Number"
            value={member.contactNumber || '—'}
          />
          <DetailRow
            icon={<Shield size={14} />}
            label="Assigned Role"
            value={member.roleName || '—'}
          />
        </div>

        {/* Assigned studies */}
        <div className={styles.studySection}>
          <div className={styles.studySectionHeader}>
            <BookOpen size={14} />
            <span>Assigned Studies</span>
            {studies.length > 0 && (
              <span className={styles.studyCount}>{studies.length}</span>
            )}
          </div>
          {studies.length === 0 ? (
            <p className={styles.noStudies}>No studies assigned.</p>
          ) : (
            <div className={styles.studyList}>
              {studies.map((s) => (
                <div key={s.studyId} className={styles.studyItem}>
                  <span className={styles.studyId}>{s.studyId}</span>
                  {s.studyTitle && (
                    <span className={styles.studyTitle}>{s.studyTitle}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.createdAt}>
            {member.createdAt
              ? `Added ${new Date(member.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
              : ''}
          </span>
          <button className={styles.btnClose} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailIcon}>{icon}</span>
      <div className={styles.detailContent}>
        <span className={styles.detailLabel}>{label}</span>
        <span className={styles.detailValue}>{value}</span>
      </div>
    </div>
  );
}
