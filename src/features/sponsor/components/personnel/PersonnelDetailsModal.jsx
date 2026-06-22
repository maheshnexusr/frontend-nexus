import { useState, useEffect } from 'react';
import {
  User, Mail, Building2, Shield, Clock,
  CreditCard, ChevronRight,
} from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorPersonnelClient } from '../../api/sponsorPersonnelClient';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { personnelStatusStyle } from '@/utils/personnelStatus';
import css from './PersonnelDetailsModal.module.css';

/**
 * PersonnelDetailsModal — full view of a personnel record.
 *
 * Props:
 *   studyId    string
 *   personnel  { id, fullName, ... }  (summary row)
 *   onClose    () => void
 */

// Consent tab removed per spec — consent management lives in the dedicated
// Consent Builder / Submission / Review pages, not the personnel record.
const TABS = [
  { key: 'info',         label: 'Personnel Info' },
  { key: 'compensation', label: 'Compensation' },
  { key: 'audit',        label: 'Activity Log' },
];

const PAYMENT_STATUS_COLORS = {
  Pending:   { color: '#d97706', bg: '#fffbeb' },
  Approved:  { color: '#2563eb', bg: '#eff6ff' },
  Processed: { color: '#059669', bg: '#ecfdf5' },
  Paid:      { color: '#059669', bg: '#ecfdf5' },
  Failed:    { color: '#dc2626', bg: '#fef2f2' },
};

const fmtDate = (str) => formatDate(str) || '—';

const fmtDateTime = (str) => formatDateTime(str) || '—';

function fmtCurrency(amount, currency = 'USD') {
  if (!amount) return '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount}`; }
}

export default function PersonnelDetailsModal({ studyId, personnel, onClose, client }) {
  const dataClient = client ?? sponsorPersonnelClient;
  const [tab,     setTab]     = useState('info');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await dataClient.getById(studyId, personnel.id);
        if (!cancelled) setDetails(d);
      } catch {
        if (!cancelled) setDetails({ ...personnel, auditTrail: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studyId, personnel]);

  const d = details ?? personnel;
  const comp = d.compensation ?? {};

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={d.fullName}
      size="lg"
      footer={<button className={css.btnClose} onClick={onClose}>Close</button>}
    >
      <div className={css.wrapper}>
        {/* Badges */}
        <div className={css.badgeRow}>
          <span
            className={css.statusBadge}
            style={personnelStatusStyle(d.displayStatus ?? d.status)}
            title={(d.displayStatus ?? d.status) === 'Invitation Link Expired' && d.invitationExpiresAt
              ? `Activation link expired on ${formatDate(d.invitationExpiresAt)}`
              : undefined}
          >
            {d.displayStatus ?? d.status}
          </span>
          <span className={css.roleBadge}>{d.role}</span>
        </div>

        {/* Tabs */}
        <div className={css.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`${css.tab} ${tab === t.key ? css.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={css.tabContent}>
          {loading && tab !== 'info' ? (
            <div className={css.loading}><div className={css.spinner} />Loading…</div>
          ) : (
            <>
              {/* ── Personnel Info ────────────────────────────────────── */}
              {tab === 'info' && (
                <div className={css.infoGrid}>
                  <InfoRow icon={User}      label="Full Name"      value={d.fullName} />
                  <InfoRow icon={Mail}      label="Email"          value={d.email} />
                  <InfoRow icon={Shield}    label="Role"           value={d.role} />
                  <InfoRow icon={Building2} label="Site"           value={d.siteName} />
                  <InfoRow icon={Clock}     label="Invited On"     value={fmtDate(d.createdAt)} />
                  <InfoRow icon={Clock}     label="Last Updated"   value={fmtDate(d.updatedAt)} />
                  <div className={css.infoRow}>
                    <Mail size={13} className={css.infoIcon} />
                    <span className={css.infoLabel}>Invitation</span>
                    <span className={css.infoValue}>
                      {d.invitationSent ? (
                        <>
                          <span style={{ color: '#059669' }}>Sent</span>
                          {d.invitationOpenedAt && <span style={{ color: '#64748b' }}> · Opened {fmtDate(d.invitationOpenedAt)}</span>}
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Not sent</span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Compensation ──────────────────────────────────────── */}
              {tab === 'compensation' && (
                <div className={css.compSection}>
                  {comp.type === 'None' || !comp.type ? (
                    <p className={css.empty}>No compensation configured for this personnel.</p>
                  ) : (
                    <>
                      <div className={css.compKpis}>
                        <div className={css.kpiCard}>
                          <span className={css.kpiValue}>{fmtCurrency(comp.totalEligible, comp.currency)}</span>
                          <span className={css.kpiLabel}>Total Eligible</span>
                        </div>
                        <div className={css.kpiCard}>
                          <span className={css.kpiValue} style={{ color: '#059669' }}>{fmtCurrency(comp.amountPaid, comp.currency)}</span>
                          <span className={css.kpiLabel}>Paid</span>
                        </div>
                        <div className={css.kpiCard}>
                          <span className={css.kpiValue} style={{ color: '#d97706' }}>{fmtCurrency(comp.amountPending, comp.currency)}</span>
                          <span className={css.kpiLabel}>Pending</span>
                        </div>
                      </div>

                      <div className={css.compMeta}>
                        <div className={css.compMetaRow}>
                          <CreditCard size={13} className={css.compMetaIcon} />
                          <span className={css.compMetaLabel}>Type</span>
                          <span className={css.compMetaValue}>{comp.type}</span>
                        </div>
                        <div className={css.compMetaRow}>
                          <CreditCard size={13} className={css.compMetaIcon} />
                          <span className={css.compMetaLabel}>Amount</span>
                          <span className={css.compMetaValue}>{fmtCurrency(comp.amount, comp.currency)}</span>
                        </div>
                        <div className={css.compMetaRow}>
                          <Clock size={13} className={css.compMetaIcon} />
                          <span className={css.compMetaLabel}>Schedule</span>
                          <span className={css.compMetaValue}>{comp.paymentSchedule || '—'}</span>
                        </div>
                        <div className={css.compMetaRow}>
                          <CreditCard size={13} className={css.compMetaIcon} />
                          <span className={css.compMetaLabel}>Method</span>
                          <span className={css.compMetaValue}>{comp.paymentMethod || '—'}</span>
                        </div>
                      </div>

                      {comp.paymentHistory?.length > 0 && (
                        <div className={css.payHistory}>
                          <h4 className={css.payHistoryTitle}>Payment History</h4>
                          <table className={css.payTable}>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Reference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comp.paymentHistory.map((p) => {
                                const pm = PAYMENT_STATUS_COLORS[p.status] ?? {};
                                return (
                                  <tr key={p.id}>
                                    <td>{fmtDate(p.date)}</td>
                                    <td>{fmtCurrency(p.amount, p.currency)}</td>
                                    <td>
                                      <span
                                        className={css.payStatus}
                                        style={{ color: pm.color, background: pm.bg }}
                                      >
                                        {p.status}
                                      </span>
                                    </td>
                                    <td>{p.reference || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Audit Trail ───────────────────────────────────────── */}
              {tab === 'audit' && (
                <div className={css.timeline}>
                  {details?.auditTrail?.length ? (
                    details.auditTrail.map((e) => (
                      <div key={e.id} className={css.timelineItem}>
                        <div className={css.timelineDot}><ChevronRight size={12} /></div>
                        <div className={css.timelineContent}>
                          <div className={css.timelineAction}>{e.action}</div>
                          <div className={css.timelineMeta}>
                            <span>{e.performedBy}</span>
                            <span>{fmtDateTime(e.timestamp)}</span>
                          </div>
                          {e.details && <div className={css.timelineDetails}>{e.details}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={css.empty}>No activity recorded yet.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className={css.infoRow}>
      <Icon size={13} className={css.infoIcon} />
      <span className={css.infoLabel}>{label}</span>
      <span className={css.infoValue}>{value}</span>
    </div>
  );
}
