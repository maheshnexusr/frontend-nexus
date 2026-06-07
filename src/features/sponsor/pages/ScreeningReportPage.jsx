/**
 * ScreeningReportPage — /sponsor/:studyId/screening-report
 *
 * Study-wide Inclusion/Exclusion overview. Thin wrapper around the shared
 * ScreeningReportView; loads from the sponsor workspace endpoint.
 */

import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import axiosClient from '@/api/sponsorAxiosClient';
import { addToast } from '@/app/notificationSlice';
import ScreeningReportView from '@/components/screening/ScreeningReportView';

export default function ScreeningReportPage() {
  const dispatch = useDispatch();
  const loadReport = useCallback(
    () => axiosClient.get('/api/v1/sponsor/workspace/screening-report'),
    [],
  );
  const onError = useCallback(
    () => dispatch(addToast({ type: 'error', message: 'Failed to load screening report.' })),
    [dispatch],
  );
  return <ScreeningReportView loadReport={loadReport} onError={onError} />;
}
