import { useState, useEffect } from 'react';
import {
  CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronRight,
  AlertTriangle, Info, Clock, ShieldCheck, User,
} from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorVerificationClient } from '@/features/sponsor/api/sponsorVerificationClient';
import styles from './SubjectVerificationModal.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const FORM_STATUS_META = {
  'Not Started': { color: '#94a3b8', bg: '#f8fafc', label: 'Not Started' },
  'In Progress': { color: '#f59e0b', bg: '#fffbeb', label: 'In Progress' },
  Completed:     { color: '#2563eb', bg: '#eff6ff', label: 'Completed'   },
  Verified:      { color: '#10b981', bg: '#ecfdf5', label: 'Verified'    },
  Queried:       { color: '#f59e0b', bg: '#fffbeb', label: 'Queried'     },
  Approved:      { color: '#059669', bg: '#d1fae5', label: 'Approved'    },
};

const FIELD_STATUS_META = {
  Pending:  { color: '#f59e0b', bg: '#fffbeb' },
  Verified: { color: '#10b981', bg: '#ecfdf5' },
  Queried:  { color: '#f59e0b', bg: '#fff7ed' },
  Rejected: { color: '#dc2626', bg: '#fef2f2' },
};

const QC_META = {
  error:   { color: '#dc2626', Icon: XCircle      },
  warning: { color: '#f59e0b', Icon: AlertTriangle },
  info:    { color: '#2563eb', Icon: Info          },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

const TABS = [
  { key: 'forms',  label: 'Forms & Fields', icon: ShieldCheck },
  { key: 'audit',  label: 'Audit Trail',    icon: Clock       },
];

export default function SubjectVerificationModal({ studyId, subject, onClose, onRefresh }) {
  const [activeTab,  setActiveTab]  = useState('forms');
  const [details,    setDetails]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState({});  // formId → bool
  const [fieldState, setFieldState] = useState({});  // fieldId → { status, comment }
  const [commenting, setCommenting] = useState(null); // fieldId | null
  const [pendingComment, setPendingComment] = useState('');
  const [saving,     setSaving]     = useState(null); // { formId, fieldId? }

  useEffect(() => {
    if (!subject) return;
    setLoading(true);
    sponsorVerificationClient.getSubject(studyId, subject.id)
      .then((d) => {
        setDetails(d);
        // Auto-expand first form
        if (d.forms?.[0]) setExpanded({ [d.forms[0].id]: true });
        // Seed field state from server data
        const fs = {};
        d.forms?.forEach((f) => f.fields?.forEach((fld) => {
          fs[fld.id] = { status: fld.verificationStatus, comment: fld.comment };
        }));
        setFieldState(fs);
      })
      .catch(() => setDetails({ ...subject, forms: [], qualityChecks: [], auditTrail: [] }))
      .finally(() => setLoading(false));
  }, [studyId, subject]);

  const toggleForm = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  // Optimistic field action
  const applyFieldAction = async (formId, field, action) => {
    const newStatus = action === 'verify' ? 'Verified' : action === 'query' ? 'Queried' : 'Rejected';
    // If action needs a comment — open comment box
    if ((action === 'query' || action === 'reject') && !pendingComment && commenting !== field.id) {
      setCommenting(field.id);
      return;
    }
    const comment = commenting === field.id ? pendingComment : '';
    setSaving({ formId, fieldId: field.id });
    // Optimistic update
    setFieldState((p) => ({ ...p, [field.id]: { status: newStatus, comment } }));
    setCommenting(null);
    setPendingComment('');
    try {
      await sponsorVerificationClient.verifyField(studyId, subject.id, formId, field.id, { action, comment });
    } catch {
      // Revert on error
      setFieldState((p) => ({ ...p, [field.id]: { status: field.verificationStatus, comment: field.comment } }));
    } finally {
      setSaving(null);
    }
  };

  const verifyAllFields = async (form) => {
    setSaving({ formId: form.id });
    const updates = {};
    form.fields.forEach((f) => { updates[f.id] = { status: 'Verified', comment: '' }; });
    setFieldState((p) => ({ ...p, ...updates }));
    try {
      await sponsorVerificationClient.verifyForm(studyId, subject.id, form.id, { action: 'verify' });
      // Reload to get fresh data
      const fresh = await sponsorVerificationClient.getSubject(studyId, subject.id);
      setDetails(fresh);
      const fs = {};
      fresh.forms?.forEach((f) => f.fields?.forEach((fld) => {
        fs[fld.id] = { status: fld.verificationStatus, comment: fld.comment };
      }));
      setFieldState(fs);
    } catch {} finally { setSaving(null); }
  };

  function renderQualityChecks() {
    const checks = details?.qualityChecks ?? [];
    if (!checks.length) return null;
    const errors   = checks.filter((c) => c.type === 'error');
    const warnings = checks.filter((c) => c.type !== 'error');
    return (
      <div className={styles.qcPanel}>
        {errors.length > 0 && (
          <div className={styles.qcGroup}>
            {errors.map((c) => {
              const { color, Icon } = QC_META[c.type] ?? QC_META.warning;
              return (
                <div key={c.id} className={styles.qcItem} style={{ borderColor: color + '40', background: color + '0d' }}>
                  <Icon size={13} style={{ color, flexShrink: 0 }} />
                  <span className={styles.qcMsg}>{c.message}</span>
                  {(c.formName || c.fieldName) && (
                    <span className={styles.qcLoc}>{[c.formName, c.fieldName].filter(Boolean).join(' → ')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {warnings.length > 0 && (
          <div className={styles.qcGroup}>
            {warnings.map((c) => {
              const { color, Icon } = QC_META[c.type] ?? QC_META.warning;
              return (
                <div key={c.id} className={styles.qcItem} style={{ borderColor: color + '40', background: color + '0d' }}>
                  <Icon size={13} style={{ color, flexShrink: 0 }} />
                  <span className={styles.qcMsg}>{c.message}</span>
                  {(c.formName || c.fieldName) && (
                    <span className={styles.qcLoc}>{[c.formName, c.fieldName].filter(Boolean).join(' → ')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderForms() {
    const forms = details?.forms ?? [];
    if (!forms.length) return <p className={styles.empty}>No forms available for this subject.</p>;
    return (
      <div className={styles.formAccordion}>
        {forms.map((form) => {
          const fsm  = FORM_STATUS_META[form.status] ?? FORM_STATUS_META['Not Started'];
          const isOpen = !!expanded[form.id];
          const verifiedCount = form.fields.filter((f) => (fieldState[f.id]?.status ?? f.verificationStatus) === 'Verified').length;
          const isSavingForm = saving?.formId === form.id && !saving?.fieldId;
          return (
            <div key={form.id} className={styles.formSection}>
              <button className={styles.formHeader} onClick={() => toggleForm(form.id)}>
                <div className={styles.formHeaderLeft}>
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className={styles.formName}>{form.name}</span>
                  <span className={styles.formStatusBadge} style={{ color: fsm.color, background: fsm.bg }}>
                    {fsm.label}
                  </span>
                  {form.fields.length > 0 && (
                    <span className={styles.formProgress}>
                      {verifiedCount}/{form.fields.length} verified
                    </span>
                  )}
                </div>
                {isOpen && form.fields.length > 0 && (
                  <button
                    type="button"
                    className={styles.verifyAllBtn}
                    disabled={isSavingForm}
                    onClick={(e) => { e.stopPropagation(); verifyAllFields(form); }}
                  >
                    <CheckCircle size={12} />
                    {isSavingForm ? 'Verifying…' : 'Verify All Fields'}
                  </button>
                )}
              </button>

              {isOpen && (
                <div className={styles.fieldList}>
                  {form.fields.length === 0 && (
                    <p className={styles.noFields}>No fields in this form.</p>
                  )}
                  {form.fields.map((field) => {
                    const fs      = fieldState[field.id] ?? { status: field.verificationStatus, comment: field.comment };
                    const fsm2    = FIELD_STATUS_META[fs.status] ?? FIELD_STATUS_META.Pending;
                    const isSavingField = saving?.fieldId === field.id;
                    const isCommenting  = commenting === field.id;
                    return (
                      <div
                        key={field.id}
                        className={`${styles.fieldRow} ${styles[`field${fs.status}`] ?? ''}`}
                        style={{ borderLeftColor: fsm2.color }}
                      >
                        <div className={styles.fieldMain}>
                          <div className={styles.fieldInfo}>
                            <span className={styles.fieldLabel}>
                              {field.label}
                              {field.isMandatory && <span className={styles.req}>*</span>}
                            </span>
                            <span className={styles.fieldValue}>{field.value || <span className={styles.empty_}>—</span>}</span>
                            {field.sourceDocRef && (
                              <span className={styles.srcRef}>Ref: {field.sourceDocRef}</span>
                            )}
                            {fs.comment && (
                              <span className={styles.fieldComment}>{fs.comment}</span>
                            )}
                          </div>

                          <div className={styles.fieldActions}>
                            <span className={styles.fieldStatus} style={{ color: fsm2.color, background: fsm2.bg }}>
                              {fs.status}
                            </span>
                            {fs.status !== 'Verified' && (
                              <button
                                className={`${styles.fldBtn} ${styles.fldBtnVerify}`}
                                title="Verify"
                                disabled={isSavingField}
                                onClick={() => applyFieldAction(form.id, field, 'verify')}
                              >
                                <CheckCircle size={12} />
                              </button>
                            )}
                            <button
                              className={`${styles.fldBtn} ${styles.fldBtnQuery}`}
                              title="Query"
                              disabled={isSavingField}
                              onClick={() => applyFieldAction(form.id, field, 'query')}
                            >
                              <MessageSquare size={12} />
                            </button>
                            <button
                              className={`${styles.fldBtn} ${styles.fldBtnReject}`}
                              title="Reject"
                              disabled={isSavingField}
                              onClick={() => applyFieldAction(form.id, field, 'reject')}
                            >
                              <XCircle size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Comment box */}
                        {isCommenting && (
                          <div className={styles.commentBox}>
                            <textarea
                              className={styles.commentInput}
                              placeholder="Add comment (required for query/reject)…"
                              value={pendingComment}
                              onChange={(e) => setPendingComment(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                            <div className={styles.commentActions}>
                              <button
                                className={styles.commentCancel}
                                onClick={() => { setCommenting(null); setPendingComment(''); }}
                              >Cancel</button>
                              <button
                                className={styles.commentSubmit}
                                disabled={!pendingComment.trim()}
                                onClick={() => {
                                  const action = commenting === field.id ? (fs.status === 'Queried' ? 'query' : 'reject') : 'query';
                                  applyFieldAction(form.id, field, action);
                                }}
                              >Submit</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderAudit() {
    const trail = details?.auditTrail ?? [];
    if (!trail.length) return <p className={styles.empty}>No audit entries found.</p>;
    return (
      <div className={styles.timeline}>
        {trail.map((e, i) => (
          <div key={e.id || i} className={styles.timelineItem}>
            <div className={styles.timelineDot}><Clock size={12} /></div>
            <div className={styles.timelineContent}>
              <span className={styles.timelineAction}>{e.action}</span>
              <div className={styles.timelineMeta}>
                {e.performedBy && <span>by <strong>{e.performedBy}</strong></span>}
                <span>{e.timestamp ? new Date(e.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
              </div>
              {e.details && <p className={styles.timelineDetails}>{e.details}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const d = details ?? subject;
  const verifiedForms = details?.forms?.filter((f) => f.status === 'Verified' || f.status === 'Approved').length ?? 0;
  const totalForms    = details?.forms?.length ?? 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="Subject Data Verification"
      size="lg"
      footer={<button className={styles.btnClose} onClick={onClose} type="button">Close</button>}
    >
      <div className={styles.wrapper}>
        {/* Subject header */}
        <div className={styles.subjectHeader}>
          <div className={styles.subjectInfo}>
            <div className={styles.subjectInfoRow}>
              <User size={14} className={styles.subjectIcon} />
              <span className={styles.subjectId}>{d?.id}</span>
              <span className={styles.subjectSite}>{d?.siteName || d?.siteCode}</span>
              {d?.enrollmentDate && <span className={styles.subjectMeta}>Enrolled {fmtDate(d.enrollmentDate)}</span>}
              {d?.demographics?.age && <span className={styles.subjectMeta}>{d.demographics.age}y</span>}
              {d?.demographics?.gender && <span className={styles.subjectMeta}>{d.demographics.gender}</span>}
            </div>
            <div className={styles.subjectMetrics}>
              <span className={styles.metricChip}>
                CRFs: <strong>{d?.crfsCompleted}/{d?.crfsTotal}</strong>
              </span>
              <span className={styles.metricChip} style={{ color: (d?.completeness ?? 0) < 100 ? '#f59e0b' : '#059669' }}>
                Completeness: <strong>{d?.completeness ?? 0}%</strong>
              </span>
              {(d?.openQueries ?? 0) > 0 && (
                <span className={styles.metricChip} style={{ color: '#dc2626' }}>
                  Open Queries: <strong>{d.openQueries}</strong>
                </span>
              )}
              {totalForms > 0 && (
                <span className={styles.metricChip} style={{ color: '#059669' }}>
                  Forms Verified: <strong>{verifiedForms}/{totalForms}</strong>
                </span>
              )}
            </div>
          </div>
          {/* Completeness bar */}
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${d?.completeness ?? 0}%`,
                background: (d?.completeness ?? 0) < 50 ? '#dc2626' : (d?.completeness ?? 0) < 80 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
        </div>

        {/* Quality checks */}
        {!loading && (details?.qualityChecks?.length ?? 0) > 0 && renderQualityChecks()}

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.tabContent}>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /> Loading subject data…</div>
          ) : (
            <>
              {activeTab === 'forms' && renderForms()}
              {activeTab === 'audit' && renderAudit()}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
