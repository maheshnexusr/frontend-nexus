/**
 * SiteImportModal — bulk-import sites from an Excel/CSV file.
 *
 * Flow (per spec):
 *   1. Download template  → "Site Details.csv" with the documented columns
 *   2. User fills it and uploads
 *   3. Server validates each row (mandatory fields, Postal Code must match an
 *      Active location for the study) and returns { imported, failed, errors }
 *
 * Columns (Site ID*, Site Name*, Postal Code* are mandatory):
 *   Site ID, Site Name, Site Location, Address, Point of Contact, Email Address,
 *   Country Code, Contact Number, Postal Code, City, District, State
 */
import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { X, Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { sponsorSitesClient } from '@/features/sponsor/api/sponsorSitesClient';

const TEMPLATE_COLUMNS = [
  'Site ID', 'Site Name', 'Site Location', 'Address', 'Point of Contact',
  'Email Address', 'Country Code', 'Contact Number', 'Postal Code',
  'City', 'District', 'State',
];

const REASON_LABELS = {
  missing_required_field: 'Missing a mandatory field (Site ID / Site Name / Postal Code)',
  missing_site_id:        'Site ID is required',
  missing_site_name:      'Site Name is required',
  missing_postal_code:    'Postal Code is required',
  duplicate_site_id:      'A site with this Site ID already exists',
  postal_not_matched:     'Postal Code not found in the study locations (or not Active)',
  insert_failed:          'Could not be saved',
};

function downloadTemplate() {
  // CSV with a quoted header row + one illustrative sample row. Opens cleanly
  // in Excel; the user saves/fills and re-uploads.
  const header = TEMPLATE_COLUMNS.map((c) => `"${c}"`).join(',');
  const sample = ['SITE-001', 'City Hospital', 'Block A', '123 Main Rd', 'Dr. Rao',
    'contact@site.com', 'IN', '9876543210', '500032', '', '', ''].map((c) => `"${c}"`).join(',');
  const csv = `${header}\n${sample}\n`;
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Site Details.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SiteImportModal({ studyId, onClose, onImported }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { imported, failed, errors }
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const name = file.name.toLowerCase();
    const ok = name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
    if (!ok) {
      setError('Unsupported file. Upload the filled "Site Details" CSV or Excel file.');
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const res = await sponsorSitesClient.import(studyId, file);
      setResult(res);
      if (res.imported > 0) onImported?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>
            <FileSpreadsheet size={18} /> Import Sites
          </span>
          <button style={iconBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569' }}>
            Download the template, fill in your sites, then upload it. Mandatory columns:
            {' '}<strong>Site ID, Site Name, Postal Code</strong>. The Postal Code must match an
            active location in this study — City / District / State are filled from it automatically.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button style={btnSecondary} onClick={downloadTemplate}>
              <Download size={14} /> Download Template
            </button>
            <button style={btnPrimary} onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload size={14} /> {busy ? 'Uploading…' : 'Upload File'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          {fileName && !error && (
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>File: {fileName}</p>
          )}

          {error && (
            <div style={alertErr}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
            </div>
          )}

          {result && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                <span style={{ ...pill, background: '#ecfdf5', color: '#15803d', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 size={14} /> Imported: {result.imported}
                </span>
                {result.failed > 0 && (
                  <span style={{ ...pill, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                    <AlertCircle size={14} /> Failed: {result.failed}
                  </span>
                )}
              </div>
              {Array.isArray(result.errors) && result.errors.length > 0 && (
                <div style={errBox}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '4px 8px', width: 60 }}>Row</th>
                        <th style={{ padding: '4px 8px' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((er, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '4px 8px', fontWeight: 600 }}>{er.row ?? '—'}</td>
                          <td style={{ padding: '4px 8px', color: '#b91c1c' }}>
                            {REASON_LABELS[er.reason] || er.reason || 'Invalid row'}
                            {er.detail ? ` — ${er.detail}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={foot}>
          <button style={btnSecondary} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

SiteImportModal.propTypes = {
  studyId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
};

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { width: 'min(620px, 94vw)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' };
const head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' };
const foot = { display: 'flex', justifyContent: 'flex-end', padding: '12px 18px', borderTop: '1px solid #e2e8f0' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 };
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer' };
const btnSecondary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' };
const pill = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 700 };
const alertErr = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600 };
const errBox = { maxHeight: 220, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 };
