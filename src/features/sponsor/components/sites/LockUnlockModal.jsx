import { useState } from 'react';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import css from './LockUnlockModal.module.css';

/**
 * LockUnlockModal — confirm locking or unlocking a site.
 *
 * Props:
 *   mode     'lock' | 'unlock'
 *   site     { siteCode, siteName, openQueries?, pendingEntries? }
 *   onConfirm (reason: string) => Promise<void>
 *   onClose  () => void
 */

export default function LockUnlockModal({ mode, site, onConfirm, onClose }) {
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const isLock = mode === 'lock';

  async function handleSubmit() {
    if (isLock && !reason.trim()) {
      setError('Please provide a reason for locking.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(e?.message ?? 'Action failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isLock ? 'Lock Site' : 'Unlock Site'}
      size="sm"
      footer={
        <div className={css.footer}>
          <button className={css.btnCancel} onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className={isLock ? css.btnLock : css.btnUnlock}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? (isLock ? 'Locking…' : 'Unlocking…')
              : (isLock ? 'Lock Site' : 'Unlock Site')}
          </button>
        </div>
      }
    >
      <div className={css.body}>
        {/* Icon banner */}
        <div className={isLock ? css.bannerLock : css.bannerUnlock}>
          {isLock ? <Lock size={20} /> : <Unlock size={20} />}
          <div>
            <div className={css.bannerTitle}>{site.siteName}</div>
            <div className={css.bannerCode}>{site.siteCode}</div>
          </div>
        </div>

        {/* Warnings (lock only) */}
        {isLock && (site.openQueries > 0 || site.pendingEntries > 0) && (
          <div className={css.warnings}>
            {site.openQueries > 0 && (
              <div className={css.warningItem}>
                <AlertTriangle size={13} />
                This site has <strong>{site.openQueries}</strong> open quer{site.openQueries !== 1 ? 'ies' : 'y'}. Consider resolving before locking.
              </div>
            )}
            {site.pendingEntries > 0 && (
              <div className={css.warningItem}>
                <AlertTriangle size={13} />
                This site has <strong>{site.pendingEntries}</strong> pending data entr{site.pendingEntries !== 1 ? 'ies' : 'y'}. Consider completing before locking.
              </div>
            )}
          </div>
        )}

        {/* Impact note */}
        {isLock ? (
          <div className={css.impactBox}>
            <p className={css.impactTitle}>Locking this site will prevent:</p>
            <ul className={css.impactList}>
              <li>Enrollment of new subjects</li>
              <li>Entry of new data</li>
              <li>Modification of existing data</li>
              <li>Submission of consents</li>
              <li>Responding to queries</li>
            </ul>
          </div>
        ) : (
          <p className={css.unlockNote}>
            Unlocking will resume normal site operations including data entry, enrollment, and consent submission.
          </p>
        )}

        {/* Reason */}
        <div className={css.field}>
          <label className={css.label}>
            {isLock ? <>Reason for Locking <span className={css.req}>*</span></> : 'Reason for Unlocking (optional)'}
          </label>
          <textarea
            className={css.textarea}
            placeholder={isLock ? 'Describe why this site is being locked…' : 'Describe why this site is being unlocked…'}
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
          />
        </div>

        {error && <p className={css.errorMsg}>{error}</p>}
      </div>
    </Modal>
  );
}
