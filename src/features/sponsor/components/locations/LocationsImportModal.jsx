/**
 * LocationsImportModal — bulk-import locations from an Excel/CSV file.
 *
 * Flow (per spec):
 *   1. Download template  → "Locations.csv" with the documented columns
 *   2. User fills it and selects the file
 *   3. Upload — the server validates each row and returns
 *      { imported, skipped, errors }
 *
 * Columns (all mandatory): Country Name, State, District, City, Postal Code,
 * Status. Rows are unique on State + District + City + Postal Code, and the
 * Country Name must match a country in the study's Countries master.
 */
import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { X, Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { sponsorLocationsClient } from '@/features/sponsor/api/sponsorLocationsClient';

const TEMPLATE_COLUMNS = ['Country Name', 'State', 'District', 'City', 'Postal Code', 'Status'];

const REASON_LABELS = {
  missing_country:        'Country Name is missing',
  missing_required_field: 'A mandatory field is missing (Country / State / District / City / Postal Code / Status)',
  invalid_status:         'Status must be Active or Inactive',
  unknown_country:        'Country Name does not match any country in this study',
  duplicate:              'Duplicate of an existing location (State + District + City + Postal Code)',
  insert_failed:          'Could not be saved',
};

function downloadTemplate(countryNames = []) {
  const c0 = countryNames[0] || '<add country from Countries master>';
  const c1 = countryNames[1] || c0;
  const rows = [
    TEMPLATE_COLUMNS,
    [c0, 'Karnataka',   'Bangalore Urban', 'Bengaluru', '560001', 'Active'],
    [c1, 'Maharashtra', 'Mumbai City',     'Mumbai',    '400001', 'Active'],
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Locations.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function LocationsImportModal({ studyId, countryNames, onClose, onImported }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { imported, skipped, errors }
  const [error, setError] = useState(null);

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const name = file.name.toLowerCase();
    const ok = name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
    if (!ok) {
      setError('Unsupported file. Upload the filled "Locations" CSV or Excel file.');
      return;
    }
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await sponsorLocationsClient.bulkImport(studyId, file);
      setResult(res);
      if (res.imported > 0) onImported?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  const errors = Array.isArray(result?.errors) ? result.errors : [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>
            <FileSpreadsheet size={18} /> Import Locations
          </span>
          <button style={iconBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569' }}>
            Download the template, fill in your locations, then upload it. All columns are
            mandatory: <strong>Country Name, State, District, City, Postal Code, Status</strong>.
            Each row must be unique on <strong>State + District + City + Postal Code</strong>, and
            the <strong>Country Name</strong> must match a country in this study&apos;s Countries master.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button style={btnSecondary} onClick={() => downloadTemplate(countryNames)}>
              <Download size={14} /> Download Template
            </button>
            <button style={btnPrimary} onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload size={14} /> {busy ? 'Importing…' : 'Select File'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={pickFile}
            />
          </div>

          {error && (
            <div style={alertErr}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
            </div>
          )}

          {result && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ ...pill, background: '#ecfdf5', color: '#15803d', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 size={14} /> Imported: {result.imported}
                </span>
                {result.skipped > 0 && (
                  <span style={{ ...pill, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                    <AlertCircle size={14} /> Skipped: {result.skipped}
                  </span>
                )}
              </div>

              {errors.length > 0 && (
                <div style={errBox}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '4px 8px', width: 60 }}>Row</th>
                        <th style={{ padding: '4px 8px' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((er, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '4px 8px', fontWeight: 600 }}>{er.row ?? '—'}</td>
                          <td style={{ padding: '4px 8px', color: '#b91c1c' }}>
                            {REASON_LABELS[er.reason] || er.reason || 'Invalid row'}
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

LocationsImportModal.propTypes = {
  studyId:      PropTypes.string,
  countryNames: PropTypes.arrayOf(PropTypes.string),
  onClose:      PropTypes.func.isRequired,
  onImported:   PropTypes.func,
};

LocationsImportModal.defaultProps = {
  countryNames: [],
};

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { width: 'min(640px, 94vw)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' };
const head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' };
const foot = { display: 'flex', justifyContent: 'flex-end', padding: '12px 18px', borderTop: '1px solid #e2e8f0' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 };
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer' };
const btnSecondary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' };
const pill = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 700 };
const alertErr = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600 };
const errBox = { maxHeight: 220, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 };
