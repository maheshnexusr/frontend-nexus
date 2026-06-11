/**
 * ReportsPage — /sponsor/:studyId/reports  ("Reports Studio")
 *
 * The Sponsor / CRO workspace exposes the All Subjects report: every subject
 * enrolled in the study, exported as Excel (.xlsx) only. Visibility + download
 * are gated on the `reports` permission leaf (download_enrollment, or the
 * blanket export).
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Users, Download, Loader2 } from 'lucide-react';
import axiosClient from '@/api/sponsorAxiosClient';
import { addToast } from '@/app/notificationSlice';
import { usePermissions } from '@/features/auth/usePermissions';
import { sponsorStudyContextStore } from '@/services/sponsorAuthService';
import css from './ReportsPage.module.css';

const todayISO = () => new Date().toISOString().slice(0, 10);
// "<Study Title> - <Protocol>.xlsx", filesystem-safe.
const safe = (s) => String(s ?? '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

export default function ReportsPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const { has }     = usePermissions();
  // Reports Studio is a single report behind the `reports` gate — if the user
  // can open this page (reports.view) they can download it. The explicit
  // download/export flags still grant it for roles configured with them.
  const canDownload = has('reports', 'view')
    || has('reports', 'download_enrollment')
    || has('reports', 'export');

  const [downloading, setDownloading] = useState(false);
  // Study title + protocol drive the download filename (and the card heading).
  const [study, setStudy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // The forms endpoint returns the study's title + protocol number (used to
    // name the download). Best-effort — the filename falls back if it fails.
    axiosClient.get('/api/v1/sponsor/workspace/forms')
      .then((res) => {
        const items = Array.isArray(res) ? res : (res?.items ?? res?.forms ?? []);
        if (!cancelled && items[0]) setStudy(items[0]);
      })
      .catch(() => { /* filename falls back to a generic name */ });
    return () => { cancelled = true; };
  }, [studyId]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const ctx = sponsorStudyContextStore.get();
      // No date range — export EVERY subject in the study.
      const params = { study_id: studyId, environment: ctx?.environment };
      const blob = await axiosClient.get('/api/v1/sponsor/workspace/reports/enrollment/download', {
        params, responseType: 'blob',
      });
      const data = blob instanceof Blob ? blob : new Blob([blob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const title    = study?.studyTitle ?? study?.study_title ?? study?.title ?? '';
      const protocol = study?.protocolNumber ?? study?.protocol_number ?? '';
      const base = [safe(title), safe(protocol)].filter(Boolean).join(' - ') || `All_Subjects_${todayISO()}`;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      dispatch(addToast({ type: 'success', message: 'All Subjects report downloaded.' }));
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
          <h1 className={css.title}>Reports Studio</h1>
          <p className={css.sub}>Download study reports as Excel (.xlsx) files.</p>
        </div>
      </div>

      <div className={css.catalogue}>
        <div className={css.reportCard}>
          <div className={css.cardIconWrap} style={{ background: '#eff6ff' }}>
            <Users size={20} style={{ color: '#2563eb' }} />
          </div>
          <div className={css.cardBody}>
            <p className={css.cardTitle}>All Subjects</p>
            <p className={css.cardDesc}>
              An Excel workbook with a summary sheet of every subject (protocol, site,
              subject, status, eligibility, dates) plus one sheet per subject containing
              their full data-capture (each form field and the captured value).
            </p>
          </div>

          {canDownload ? (
            <button className={css.btnGenerate} onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 size={14} className={css.spin} /> : <Download size={14} />}
              {downloading ? 'Preparing…' : 'Data Extraction Report'}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>No download permission</span>
          )}
        </div>
      </div>
    </div>
  );
}
