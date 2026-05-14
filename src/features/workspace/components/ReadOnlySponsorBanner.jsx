/**
 * ReadOnlySponsorBanner — sticky banner shown at the top of every sponsor
 * workspace page while a CRO user is inside a sponsor workspace via /enter.
 *
 * CRO viewers have full write access now, so the banner is purely
 * informational: it tells the user which sponsor they're viewing as and
 * gives them a one-click way back to the CRO dashboard. File name kept for
 * backwards-compat with existing imports.
 */

import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowLeftCircle } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import {
  exitSponsorView,
  selectIsViewingSponsor,
  selectSponsorViewSponsor,
} from '@/features/workspace/store/sponsorViewSlice';
import styles from './ReadOnlySponsorBanner.module.css';

export default function ReadOnlySponsorBanner() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const isViewing = useAppSelector(selectIsViewingSponsor);
  const sponsor   = useAppSelector(selectSponsorViewSponsor);

  if (!isViewing) return null;

  const orgName = sponsor?.organizationName || sponsor?.fullName || 'this sponsor';

  const handleExit = () => {
    dispatch(exitSponsorView());
    navigate('/cro/dashboard');
  };

  return (
    <div className={styles.banner} role="status">
      <div className={styles.left}>
        <Building2 size={16} className={styles.icon} aria-hidden="true" />
        <span className={styles.text}>
          You&apos;re inside <strong>{orgName}</strong>&apos;s workspace as a CRO admin.
        </span>
      </div>
      <button
        type="button"
        className={styles.exitBtn}
        onClick={handleExit}
        aria-label="Return to CRO dashboard"
      >
        <ArrowLeftCircle size={14} />
        Return to CRO Workspace
      </button>
    </div>
  );
}
