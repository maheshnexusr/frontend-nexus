/**
 * PersonnelImportModal — bulk-import site personnel from an Excel/CSV file.
 *
 * Flow (per spec):
 *   1. Download template  → "Site Personnels.csv" with the documented columns
 *   2. User fills it and selects the file
 *   3. Confirm — importing SENDS invitation emails to every valid row, so the
 *      user explicitly confirms before we upload
 *   4. Server validates each row (mandatory fields, valid email, Role/Status/
 *      Site Name must match the study) and returns
 *      { imported, failed, errors, emailFailures }
 *
 * Columns (all mandatory): Full Name, Email Address, Role, Status, Site Name.
 */
import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { X, Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Mail, Send } from 'lucide-react';
import { sponsorPersonnelClient } from '@/features/sponsor/api/sponsorPersonnelClient';

const TEMPLATE_COLUMNS = ['Full Name', 'Email Address', 'Role', 'Status', 'Site Name'];

const REASON_LABELS = {
  missing_required_field: 'Missing a mandatory field (Full Name / Email / Role / Status / Site Name)',
  invalid_email:          'Email address is not valid',
  invalid_status:         'Status must be Active or Inactive',
  role_not_matched:       'Role name does not match any site role in this study',
  site_not_matched:       'Site Name does not match any site in this study',
  invite_failed:          'Could not be invited',
};

function downloadTemplate() {
  const header = TEMPLATE_COLUMNS.map((c) => `"${c}"`).join(',');
  const sample = ['Dr. Jane Smith', 'jane.smith@hospital.com', 'PI', 'Active', 'City Hospital']
    .map((c) => `"${c}"`).join(',');
  const csv = `${header}\n${sample}\n`;
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Site Personnels.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PersonnelImportModal({ studyId, onClose, onImported }) {
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null); // File awaiting confirmation
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { imported, failed, errors, emailFailures }
  const [error, setError] = useState(null);

  function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const name = file.name.toLowerCase();
    const ok = name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
    if (!ok) {
      setError('Unsupported file. Upload the filled "Site Personnels" CSV or Excel file.');
      return;
    }
    setError(null);
    setResult(null);
    setPending(file); // hold for confirmation — invitations are sent on import
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await sponsorPersonnelClient.import(studyId, pending);
      setResult(res);
      setPending(null);
      if (res.imported > 0) onImported?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  const emailFailures = Array.isArray(result?.emailFailures) ? result.emailFailures : [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16 }}>
            <FileSpreadsheet size={18} /> Import Personnel
          </span>
          <button style={iconBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569' }}>
            Download the template, fill in your personnel, then upload it. All columns are
            mandatory: <strong>Full Name, Email Address, Role, Status, Site Name</strong>.
            <strong> Role</strong>, <strong>Status</strong> and <strong>Site Name</strong> must
            match this study. Importing sends each valid person an invitation email.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button style={btnSecondary} onClick={downloadTemplate}>
              <Download size={14} /> Download Template
            </button>
            <button style={btnPrimary} onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload size={14} /> Select File
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={pickFile}
            />
          </div>

          {/* Confirmation gate — importing sends invitation emails. */}
          {pending && (
            <div style={confirmBox}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Mail size={16} style={{ flexShrink: 0, marginTop: 1, color: '#b45309' }} />
                <div style={{ fontSize: 13, color: '#92400e' }}>
                  <strong>{pending.name}</strong> is ready. Importing will <strong>send invitation
                  emails</strong> to every valid person in the file. Continue?
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button style={btnPrimary} onClick={confirmImport} disabled={busy}>
                  <Send size={14} /> {busy ? 'Importing…' : 'Confirm & Send Invitations'}
                </button>
                <button style={btnSecondary} onClick={() => setPending(null)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={alertErr}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
            </div>
          )}

          {result && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ ...pill, background: '#ecfdf5', color: '#15803d', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 size={14} /> Invited: {result.imported}
                </span>
                {result.failed > 0 && (
                  <span style={{ ...pill, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                    <AlertCircle size={14} /> Failed: {result.failed}
                  </span>
                )}
                {emailFailures.length > 0 && (
                  <span style={{ ...pill, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                    <Mail size={14} /> Email not sent: {emailFailures.length}
                  </span>
                )}
              </div>

              {emailFailures.length > 0 && (
                <div style={{ ...alertWarn, marginBottom: 10 }}>
                  <Mail size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {emailFailures.length} personnel were created but their invitation email
                    could not be sent. Use “Resend Invitation” on those rows:{' '}
                    {emailFailures.map((f) => f.email).filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

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

PersonnelImportModal.propTypes = {
  studyId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onImported: PropTypes.func,
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
const alertWarn = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 12.5 };
const confirmBox = { padding: '12px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 14 };
const errBox = { maxHeight: 220, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 };
