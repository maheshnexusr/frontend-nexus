/**
 * SiteScreeningReportPage — /site/screening-report
 *
 * Inclusion/Exclusion overview for the site user's own site (the backend
 * auto-scopes by the site JWT). Thin wrapper around the shared
 * ScreeningReportView.
 */

import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { addToast } from '@/app/notificationSlice';
import ScreeningReportView from '@/components/screening/ScreeningReportView';

export default function SiteScreeningReportPage() {
  const dispatch = useDispatch();
  const loadReport = useCallback(() => siteWorkspaceClient.screeningReport(), []);
  const onError = useCallback(
    () => dispatch(addToast({ type: 'error', message: 'Failed to load screening report.' })),
    [dispatch],
  );
  return (
    <ScreeningReportView
      loadReport={loadReport}
      subtitle="Inclusion / Exclusion eligibility for your site's subjects, evaluated from captured data."
      onError={onError}
    />
  );
}
