/**
 * ReadOnlySponsorBanner — sticky banner shown at the top of every sponsor
 * workspace page while the CRO user is in read-only viewer mode.
 *
 * Mount once near the top of the sponsor layout. It auto-hides when not in
 * read-only mode, so it's safe to leave in place.
 */

import { Eye, ArrowLeftCircle } from 'lucide-react';
import { useReadOnlyView } from '@/features/workspace/hooks/useReadOnlyView';
import styles from './ReadOnlySponsorBanner.module.css';

export default function ReadOnlySponsorBanner() {
  const { isReadOnly, sponsor, exit } = useReadOnlyView();

  if (!isReadOnly) return null;

  const orgName = sponsor?.organizationName || sponsor?.fullName || 'this sponsor';

  return (
    <div className={styles.banner} role="status">
      <div className={styles.left}>
        <Eye size={16} className={styles.icon} aria-hidden="true" />
        <span className={styles.text}>
          Viewing <strong>{orgName}</strong> as read-only.
        </span>
      </div>
      <button
        type="button"
        className={styles.exitBtn}
        onClick={exit}
        aria-label="Return to CRO dashboard"
      >
        <ArrowLeftCircle size={14} />
        Return to CRO dashboard
      </button>
    </div>
  );
}
