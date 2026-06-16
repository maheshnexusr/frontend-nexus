/**
 * PersonnelDeleteModal — hard-delete confirmation for a site person.
 *
 * Deleting a site person removes ALL of their data (subjects they own + every
 * record hanging off those subjects + their authored/submitted records). This
 * modal fetches a pre-delete impact summary so the user sees exactly what will
 * be removed before confirming. The deletion is recorded in the activity log.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorPersonnelClient } from '@/features/sponsor/api/sponsorPersonnelClient';

// Count label → friendly text, in display order.
const ROWS = [
  ['subjects',            'Subjects owned'],
  ['subjectFormRecords',  'Form records'],
  ['subjectVisits',       'Subject visits'],
  ['queries',             'Queries'],
  ['queryComments',       'Query comments'],
  ['verifications',       'Verifications'],
  ['adverseEvents',       'Adverse events'],
  ['protocolDeviations',  'Protocol deviations'],
  ['consentSubmissions',  'Consent submissions'],
  ['consentAcceptances',  'Consent acceptances'],
];

export default function PersonnelDeleteModal({ studyId, target, onClose, onConfirm }) {
  const [impact, setImpact]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason]   = useState('');
  const [reasonError, setReasonError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    sponsorPersonnelClient.deletionImpact(studyId, target.id)
      .then((res) => { if (alive) setImpact(res); })
      .catch((err) => { if (alive) setError(err?.message ?? 'Failed to load deletion details.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studyId, target.id]);

  const counts = impact?.counts ?? {};
  const total  = impact?.totalRecords ?? 0;
  const nonZero = ROWS.filter(([k]) => (counts[k] ?? 0) > 0);

  const handleConfirm = async () => {
    if (!reason.trim()) { setReasonError(true); return; }
    setDeleting(true);
    try {
      await onConfirm(reason.trim());   // page owns the actual delete + toast + list update
    } finally {
      setDeleting(false);
    }
  };

  const footer = (
    <>
      <button style={btnCancel} onClick={onClose} disabled={deleting} type="button">Cancel</button>
      <button style={btnDanger} onClick={handleConfirm} disabled={deleting || loading || !reason.trim()} type="button">
        {deleting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <AlertTriangle size={15} />}
        {deleting ? 'Deleting…' : 'Delete user & all data'}
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Delete Site Personnel" size="sm" footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={banner}>
          <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ display: 'block', color: '#991b1b', fontSize: 13 }}>
              This permanently deletes {target.fullName || 'this user'} and all of their data.
            </strong>
            <span style={{ fontSize: 12.5, color: '#b91c1c' }}>
              This cannot be undone. The deletion is recorded in the activity log.
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, padding: '8px 0' }}>
            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Checking what will be deleted…
          </div>
        ) : error ? (
          <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>
        ) : total === 0 ? (
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
            This user has no attached data — only their account will be removed.
          </p>
        ) : (
          <div>
            <p style={{ fontSize: 12.5, color: '#475569', margin: '0 0 8px' }}>
              The following records will be permanently removed:
            </p>
            <div style={list}>
              {nonZero.map(([key, label]) => (
                <div key={key} style={row}>
                  <span style={{ color: '#334155' }}>{label}</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{counts[key]}</span>
                </div>
              ))}
              <div style={{ ...row, borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 8 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Total records</span>
                <span style={{ fontWeight: 800, color: '#dc2626' }}>{total}</span>
              </div>
            </div>
          </div>
        )}

        {/* Required reason — recorded in the activity log. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label htmlFor="deleteReason" style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
            Reason for deletion <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            id="deleteReason"
            rows={3}
            value={reason}
            disabled={deleting}
            onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(false); }}
            placeholder="Why is this user and their data being deleted?"
            style={{
              width: '100%', padding: '9px 11px', borderRadius: 9, fontSize: 13,
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              border: `1px solid ${reasonError ? '#dc2626' : '#d1d5db'}`, outline: 'none',
            }}
          />
          {reasonError && <span style={{ fontSize: 12, color: '#dc2626' }}>A reason is required to delete.</span>}
        </div>
      </div>
    </Modal>
  );
}

const banner = {
  display: 'flex', gap: 10, padding: '12px 14px',
  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
};
const list   = { display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' };
const row    = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 };
const btnCancel = { padding: '9px 18px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnDanger = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
