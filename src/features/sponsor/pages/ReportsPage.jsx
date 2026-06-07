/**
 * ReportsPage — /sponsor/:studyId/reports
 *
 * Per spec the Sponsor workspace exposes a single report: the Enrollment
 * Report, downloaded as Excel (.xlsx) only. Visibility + download are gated on
 * the `reports` permission leaf (download_enrollment, or the blanket export).
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Users, Download, Loader2 } from 'lucide-react';
import axiosClient from '@/api/sponsorAxiosClient';
import { addToast } from '@/app/notificationSlice';
import PlatformDatePicker from '@/components/form/PlatformDatePicker';
import { usePermissions } from '@/features/auth/usePermissions';
import { sponsorStudyContextStore } from '@/services/sponsorAuthService';
import css from './ReportsPage.module.css';

const todayISO   = () => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export default function ReportsPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const { has }     = usePermissions();
  const canDownload = has('reports', 'download_enrollment') || has('reports', 'export');

  const [dateFrom, setDateFrom] = useState(isoDaysAgo(90));
  const [dateTo,   setDateTo]   = useState(todayISO());
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const ctx = sponsorStudyContextStore.get();
      const params = { study_id: studyId, environment: ctx?.environment };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const blob = await axiosClient.get('/api/v1/sponsor/workspace/reports/enrollment/download', {
        params, responseType: 'blob',
      });
      const data = blob instanceof Blob ? blob : new Blob([blob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Enrollment_Report_${todayISO()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      dispatch(addToast({ type: 'success', message: 'Enrollment report downloaded.' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'Failed to download report.' }));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={css.page}>
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Reports</h1>
          <p className={css.sub}>Download the study Enrollment Report as an Excel file.</p>
        </div>
      </div>

      <div className={css.catalogue}>
        <div className={css.reportCard}>
          <div className={css.cardIconWrap} style={{ background: '#eff6ff' }}>
            <Users size={20} style={{ color: '#2563eb' }} />
          </div>
          <div className={css.cardBody}>
            <p className={css.cardTitle}>Enrollment Report</p>
            <p className={css.cardDesc}>
              Subject enrollment across all sites — site, subject, enrollment status,
              eligibility and enrolled date. Exported as Excel (.xlsx).
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <div>
                <label className={css.dlabel ?? ''} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Date From</label>
                <PlatformDatePicker value={dateFrom} max={dateTo} onChange={setDateFrom} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Date To</label>
                <PlatformDatePicker value={dateTo} min={dateFrom} max={todayISO()} onChange={setDateTo} />
              </div>
            </div>
          </div>

          {canDownload ? (
            <button className={css.btnGenerate} onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 size={14} className={css.spin} /> : <Download size={14} />}
              {downloading ? 'Preparing…' : 'Download Excel'}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>No download permission</span>
          )}
        </div>
      </div>
    </div>
  );
}
