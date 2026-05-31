import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, User, ShieldCheck, FileText } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { sponsorVerificationClient } from '@/features/sponsor/api/sponsorVerificationClient';
import { formatDateTime } from '@/utils/formatDate';
import styles from './SubjectVerificationModal.module.css';

const LAYOUT_TYPES = ['h2', 'paragraph', 'divider'];

const PAGE_STATUS_META = {
  'Verified':           { color: '#15803d', bg: '#dcfce7' },
  'Partially Verified': { color: '#1d4ed8', bg: '#dbeafe' },
  'Not Verified':       { color: '#475569', bg: '#f1f5f9' },
};

/**
 * SubjectVerificationModal — read-only verification detail for a subject's form.
 *
 * Driven by the real per-page verification data (`GET .../page-status`) plus the
 * form schema (for field labels / page titles). For the selected VM row's form
 * it lists every page → its fields, each showing the persisted verification
 * status, the verifier's name and the date. Actual verifying happens in the
 * form runner (Verify Page / per-field) — opened via the row's "Open Form".
 */
export default function SubjectVerificationModal({ subject, onClose }) {
  const [loading, setLoading] = useState(true);
  const [pages,   setPages]   = useState([]);   // [{ id, title, status, verifiedByName, verifiedAt, completedByName, completedAt, fields:[{id,label,status,verifiedByName,verifiedAt}] }]

  useEffect(() => {
    if (!subject?.id || !subject?.formId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      sponsorVerificationClient.getPageStatuses(subject.id, subject.formId),
      sponsorVerificationClient.getForm(subject.formId).catch(() => null),
    ])
      .then(([rows, form]) => {
        if (cancelled) return;
        // Build a field id → label map and the ordered page list from the schema.
        const labelByField = {};
        const pageOrder = []; // [{ id, title, fieldIds:[] }]
        const struct = form?.structure ?? form?.form_structure ?? {};
        for (const blk of struct.blocks ?? []) {
          for (const pg of blk.pages ?? []) {
            const fieldIds = [];
            for (const f of pg.fields ?? []) {
              if (!f || LAYOUT_TYPES.includes(f.type)) continue;
              labelByField[f.id] = f.label || f.id;
              fieldIds.push(f.id);
            }
            pageOrder.push({ id: pg.id, title: pg.title || pg.id, fieldIds });
          }
        }

        // Index the verification rows: page rows (field_name empty) + field rows.
        const pageRowById  = new Map();
        const fieldRowById = new Map();
        for (const r of rows) {
          if (!r.field_name) pageRowById.set(r.page_id, r);
          else fieldRowById.set(r.field_name, r);
        }

        // Prefer the schema's page order; fall back to whatever pages the
        // verification rows reference (in case the schema couldn't be loaded).
        const pageIds = pageOrder.length
          ? pageOrder.map((p) => p.id)
          : [...new Set(rows.map((r) => r.page_id).filter(Boolean))];

        const built = pageIds.map((pid) => {
          const meta  = pageOrder.find((p) => p.id === pid);
          const prow  = pageRowById.get(pid) ?? {};
          const fids  = meta?.fieldIds?.length
            ? meta.fieldIds
            : rows.filter((r) => r.page_id === pid && r.field_name).map((r) => r.field_name);
          const fields = fids.map((fid) => {
            const fr = fieldRowById.get(fid) ?? {};
            return {
              id:             fid,
              label:          labelByField[fid] ?? fid,
              status:         fr.status ?? 'Not Verified',
              verifiedByName: fr.verified_by_name ?? null,
              verifiedAt:     fr.verified_at ?? null,
            };
          });
          return {
            id:              pid,
            title:           prow.page_title ?? meta?.title ?? pid,
            status:          prow.status ?? 'Not Verified',
            verifiedByName:  prow.verified_by_name ?? null,
            verifiedAt:      prow.verified_at ?? null,
            completedByName: prow.completed_by_name ?? null,
            completedAt:     prow.completed_at ?? null,
            fields,
          };
        });
        setPages(built);
      })
      .catch(() => { if (!cancelled) setPages([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [subject]);

  const totalFields    = pages.reduce((n, p) => n + p.fields.length, 0);
  const verifiedFields = pages.reduce((n, p) => n + p.fields.filter((f) => f.status === 'Verified').length, 0);
  const pct = totalFields ? Math.round((verifiedFields / totalFields) * 100) : 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="Page Verification Details"
      size="lg"
      footer={<button className={styles.btnClose} onClick={onClose} type="button">Close</button>}
    >
      <div className={styles.wrapper}>
        {/* Subject header */}
        <div className={styles.subjectHeader}>
          <div className={styles.subjectInfo}>
            <div className={styles.subjectInfoRow}>
              <User size={14} className={styles.subjectIcon} />
              <span className={styles.subjectId}>{subject?.subjectNumber || subject?.id}</span>
              {subject?.initials && <span className={styles.subjectMeta}>{subject.initials}</span>}
              <span className={styles.subjectSite}>{subject?.siteName || subject?.siteCode}</span>
            </div>
            <div className={styles.subjectMetrics}>
              {subject?.blockPage && (
                <span className={styles.metricChip}><FileText size={12} /> {subject.blockPage}</span>
              )}
              <span className={styles.metricChip} style={{ color: pct < 100 ? '#1d4ed8' : '#15803d' }}>
                Verified: <strong>{verifiedFields}/{totalFields}</strong> ({pct}%)
              </span>
            </div>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${pct}%`, background: pct < 50 ? '#dc2626' : pct < 100 ? '#1d4ed8' : '#10b981' }}
            />
          </div>
        </div>

        {/* Body */}
        <div className={styles.tabContent}>
          {loading ? (
            <div className={styles.loading}><div className={styles.spinner} /> Loading verification details…</div>
          ) : pages.length === 0 ? (
            <p className={styles.empty}>No verification data for this subject yet.</p>
          ) : (
            pages.map((pg) => {
              const meta = PAGE_STATUS_META[pg.status] ?? PAGE_STATUS_META['Not Verified'];
              const vCount = pg.fields.filter((f) => f.status === 'Verified').length;
              return (
                <div key={pg.id} className={styles.formSection}>
                  <div className={styles.formHeader}>
                    <div className={styles.formHeaderLeft}>
                      <ShieldCheck size={14} />
                      <span className={styles.formName}>{pg.title}</span>
                      <span className={styles.formStatusBadge} style={{ color: meta.color, background: meta.bg }}>
                        {pg.status}
                      </span>
                    </div>
                    <span className={styles.formProgress}>{vCount}/{pg.fields.length} verified</span>
                  </div>

                  {pg.fields.length === 0 ? (
                    <p className={styles.noFields}>No data fields on this page.</p>
                  ) : (
                    <div className={styles.fieldList}>
                      {pg.fields.map((f) => {
                        const ok = f.status === 'Verified';
                        return (
                          <div key={f.id} className={styles.fieldRow}>
                            <div className={styles.fieldMain}>
                              <span className={styles.fieldLabel}>{f.label}</span>
                              {ok && f.verifiedByName && (
                                <span className={styles.fieldComment}>
                                  by {f.verifiedByName}{f.verifiedAt ? ` · ${formatDateTime(f.verifiedAt)}` : ''}
                                </span>
                              )}
                            </div>
                            <span
                              className={styles.fieldStatus}
                              style={{ color: ok ? '#15803d' : '#94a3b8' }}
                            >
                              {ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                              {ok ? 'Verified' : 'Not Verified'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
