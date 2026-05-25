import { useState, useEffect } from 'react';
import {
  MapPin, User, Mail, Phone, Building2, Users,
  FileText, MessageSquare, Shield, Clock, ChevronRight,
} from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorSitesClient } from '../../api/sponsorSitesClient';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import css from './SiteDetailsModal.module.css';

/**
 * SiteDetailsModal — comprehensive view of a site.
 *
 * Props:
 *   studyId  string
 *   site     { id, siteCode, siteName, ... }  (summary row)
 *   onClose  () => void
 */

const TABS = [
  { key: 'info',       label: 'Site Info' },
  { key: 'enrollment', label: 'Enrollment' },
  { key: 'personnel',  label: 'Personnel' },
  { key: 'data',       label: 'Data Summary' },
  { key: 'audit',      label: 'Activity Log' },
];

const fmtDate     = (str) => formatDate(str)     || '—';
const fmtDateTime = (str) => formatDateTime(str) || '—';

function progressColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function SiteDetailsModal({ studyId, site, onClose }) {
  const [tab,     setTab]     = useState('info');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await sponsorSitesClient.getById(studyId, site.id ?? site.siteCode);
        if (!cancelled) setDetails(d);
      } catch {
        if (!cancelled) setDetails({ ...site, personnel: [], crfStats: {}, queryStats: {}, consentStats: {}, auditTrail: [], enrollmentTrend: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studyId, site]);

  const d = details ?? site;
  const enrollPct = d.expectedEnrollments
    ? Math.min(100, Math.round(((d.actualEnrollments ?? 0) / d.expectedEnrollments) * 100))
    : 0;
  const atTarget = (d.actualEnrollments ?? 0) >= (d.expectedEnrollments ?? 0) && (d.expectedEnrollments ?? 0) > 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${d.siteName} — ${d.siteCode}`}
      size="lg"
      footer={
        <button className={css.btnClose} onClick={onClose}>Close</button>
      }
    >
      <div className={css.wrapper}>
        {/* Status badges */}
        <div className={css.statusRow}>
          <span
            className={css.statusBadge}
            style={d.status === 'Active'
              ? { color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }
              : { color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
          >
            {d.status}
          </span>
          {d.isLocked && (
            <span className={css.lockedBadge}>Locked</span>
          )}
          {atTarget && (
            <span className={css.targetBadge}>Enrollment Target Reached</span>
          )}
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

        {/* Tab content */}
        <div className={css.tabContent}>
          {loading && tab !== 'info' ? (
            <div className={css.loading}>
              <div className={css.spinner} />
              Loading…
            </div>
          ) : (
            <>
              {/* ── Site Info ─────────────────────────────────────────────── */}
              {tab === 'info' && (
                <div className={css.infoGrid}>
                  <InfoRow icon={Building2} label="Site Code"     value={d.siteCode} />
                  <InfoRow icon={Building2} label="Site Name"     value={d.siteName} />
                  <InfoRow icon={User}      label="Contact"       value={d.contactPerson} />
                  <InfoRow icon={Mail}      label="Email"         value={d.email} />
                  <InfoRow icon={Phone}     label="Phone"         value={d.contactNumber} />
                  <InfoRow icon={MapPin}    label="Address"
                    value={[d.addressLine1, d.addressLine2, d.city, d.state, d.country].filter(Boolean).join(', ')}
                  />
                  <InfoRow icon={MapPin}    label="City"          value={d.city} />
                  <InfoRow icon={MapPin}    label="Country"       value={d.country} />
                  <InfoRow icon={Clock}     label="Created"       value={fmtDate(d.createdAt)} />
                  <InfoRow icon={Clock}     label="Last Updated"  value={fmtDate(d.updatedAt)} />
                  {d.isLocked && d.lockReason && (
                    <InfoRow icon={Shield}  label="Lock Reason"   value={d.lockReason} />
                  )}
                </div>
              )}

              {/* ── Enrollment ────────────────────────────────────────────── */}
              {tab === 'enrollment' && (
                <div className={css.enrollSection}>
                  <div className={css.enrollKpis}>
                    <div className={css.kpiCard}>
                      <span className={css.kpiValue} style={{ color: '#2563eb' }}>{d.expectedEnrollments ?? 0}</span>
                      <span className={css.kpiLabel}>Expected</span>
                    </div>
                    <div className={css.kpiCard}>
                      <span className={css.kpiValue} style={{ color: '#059669' }}>{d.actualEnrollments ?? 0}</span>
                      <span className={css.kpiLabel}>Actual</span>
                    </div>
                    <div className={css.kpiCard}>
                      <span className={css.kpiValue} style={{ color: progressColor(enrollPct) }}>{enrollPct}%</span>
                      <span className={css.kpiLabel}>Progress</span>
                    </div>
                  </div>
                  <div>
                    <div className={css.progressLabel}>
                      {d.actualEnrollments ?? 0} / {d.expectedEnrollments ?? 0} enrolled
                    </div>
                    <div className={css.progressBar}>
                      <div
                        className={css.progressFill}
                        style={{ width: `${enrollPct}%`, background: progressColor(enrollPct) }}
                      />
                    </div>
                  </div>
                  {atTarget && (
                    <div className={css.targetAlert}>
                      Enrollment target reached! Current: {d.actualEnrollments} / {d.expectedEnrollments}
                    </div>
                  )}
                  {details?.enrollmentTrend?.length > 0 && (
                    <div className={css.trendNote}>
                      <p className={css.trendTitle}>Monthly Trend</p>
                      <div className={css.trendBars}>
                        {details.enrollmentTrend.map((t, i) => (
                          <div key={i} className={css.trendBar}>
                            <div
                              className={css.trendFill}
                              style={{ height: `${Math.max(4, Math.min(100, (t.count / (d.expectedEnrollments || 1)) * 100))}%` }}
                            />
                            <span className={css.trendMonth}>{t.month}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Personnel ─────────────────────────────────────────────── */}
              {tab === 'personnel' && (
                <div>
                  {details?.personnel?.length ? (
                    <table className={css.miniTable}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.personnel.map((p) => (
                          <tr key={p.id}>
                            <td><span className={css.personName}>{p.name}</span></td>
                            <td><span className={css.roleBadge}>{p.role}</span></td>
                            <td>{p.email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className={css.empty}>No personnel assigned to this site.</p>
                  )}
                </div>
              )}

              {/* ── Data Summary ──────────────────────────────────────────── */}
              {tab === 'data' && (
                <div className={css.dataSummary}>
                  <div className={css.dataCard}>
                    <FileText size={20} className={css.dataIcon} />
                    <div className={css.dataLabel}>CRF Status</div>
                    <div className={css.dataStats}>
                      <span className={css.dataStat} style={{ color: '#059669' }}>
                        {details?.crfStats?.complete ?? 0} Complete
                      </span>
                      <span className={css.dataStat} style={{ color: '#f59e0b' }}>
                        {details?.crfStats?.pending ?? 0} Pending
                      </span>
                      <span className={css.dataStat} style={{ color: '#64748b' }}>
                        {details?.crfStats?.total ?? 0} Total
                      </span>
                    </div>
                  </div>
                  <div className={css.dataCard}>
                    <MessageSquare size={20} className={css.dataIcon} />
                    <div className={css.dataLabel}>Queries</div>
                    <div className={css.dataStats}>
                      <span className={css.dataStat} style={{ color: '#dc2626' }}>
                        {details?.queryStats?.open ?? 0} Open
                      </span>
                      <span className={css.dataStat} style={{ color: '#059669' }}>
                        {details?.queryStats?.closed ?? 0} Closed
                      </span>
                    </div>
                  </div>
                  <div className={css.dataCard}>
                    <Users size={20} className={css.dataIcon} />
                    <div className={css.dataLabel}>Consents</div>
                    <div className={css.dataStats}>
                      <span className={css.dataStat} style={{ color: '#059669' }}>
                        {details?.consentStats?.consented ?? 0} Consented
                      </span>
                      <span className={css.dataStat} style={{ color: '#f59e0b' }}>
                        {details?.consentStats?.pending ?? 0} Pending
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Audit Trail ───────────────────────────────────────────── */}
              {tab === 'audit' && (
                <div className={css.timeline}>
                  {details?.auditTrail?.length ? (
                    details.auditTrail.map((e) => (
                      <div key={e.id} className={css.timelineItem}>
                        <div className={css.timelineDot}>
                          <ChevronRight size={12} />
                        </div>
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
