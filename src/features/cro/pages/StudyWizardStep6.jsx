/**
 * StudyWizardStep6 — Publish Study
 *
 * Final wizard step. Lets the user choose environment (UAT/LIVE), status,
 * description, then confirms and publishes — creating a versioned release.
 * Shows existing version history for this study protocol.
 */

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate }              from 'react-router-dom';
import {
  Globe, Database, Link2, Send, CheckCircle2,
  ArrowLeft, X, ChevronDown, Eye, RotateCcw, Copy,
} from 'lucide-react';
import {
  setStep6, selectStep1, selectStep2, selectStep3,
  selectStep4, selectStep5, selectStep6, resetWizard,
} from '@/features/cro/store/studyWizardSlice';
import { studiesClient }    from '@/features/cro/api/studiesClient';
import { addToast }         from '@/features/notifications/notificationSlice';
import styles from './StudyWizardStep6.module.css';

const STATUSES = ['Published', 'Active', 'Inactive', 'Locked'];

export default function StudyWizardStep6({ onPrevious, onCancel }) {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();

  const step1 = useSelector(selectStep1);
  const step2 = useSelector(selectStep2);
  const step3 = useSelector(selectStep3);
  const step4 = useSelector(selectStep4);
  const step5 = useSelector(selectStep5);
  const step6 = useSelector(selectStep6);

  const [env,         setEnv]         = useState(step6.environment  ?? '');
  const [status,      setStatus]      = useState(step6.status       ?? 'Published');
  const [description, setDescription] = useState(step6.description  ?? '');
  const [releases,    setReleases]     = useState([]);
  const [loadingRel,  setLoadingRel]  = useState(true);
  const [publishing,  setPublishing]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [published,   setPublished]   = useState(null); // latest release after publish

  // ── Load existing releases for this study protocol ────────────────────
  useEffect(() => {
    if (!step1.studyId) { setLoadingRel(false); return; }
    setLoadingRel(true);
    studiesClient.getReleasesByProtocolId(step1.studyId).then((list) => {
      setReleases(list);
      setLoadingRel(false);
    });
  }, [step1.studyId]);

  // ── Persist form to Redux ─────────────────────────────────────────────
  const persistForm = (patch = {}) => {
    dispatch(setStep6({ environment: env, status, description, ...patch }));
  };

  // ── Validation ────────────────────────────────────────────────────────
  const validate = () => {
    if (!env) {
      dispatch(addToast({ type: 'error', message: 'Please select a Target Environment (UAT or LIVE).', duration: 4000 }));
      return false;
    }
    if (!step1.studyId || !step1.studyTitle) {
      dispatch(addToast({ type: 'error', message: 'Please complete all previous steps before publishing.', duration: 4000 }));
      return false;
    }
    return true;
  };

  const handlePublishClick = () => {
    persistForm();
    if (!validate()) return;
    setShowConfirm(true);
  };

  // ── Confirm publish ───────────────────────────────────────────────────
  const handleConfirmedPublish = async () => {
    setShowConfirm(false);
    setPublishing(true);

    const wizardData = {
      studyId:         step1.studyId,
      studyTitle:      step1.studyTitle,
      studyPhaseId:    step1.studyPhaseId,
      studyPhaseName:  step1.studyPhaseName,
      scope:           step1.scope,
      therapeuticArea: step1.therapeuticArea,
      description:     step1.studyDescription,
      sponsorId:       step1.sponsorId,
      sponsorName:     step1.sponsorName,
      timeline:        step2,
      configuration:   step3,
      formId:          step4.formId,
      formTitle:       step4.formTitle,
      team:            step5.assignments ?? [],
    };

    try {
      const { release } = await studiesClient.publish(wizardData, { environment: env, status, description });

      // refresh version history
      const updated = await studiesClient.getReleasesByProtocolId(step1.studyId);
      setReleases(updated);
      setPublished(release);

      const dbName = release.databaseName;
      dispatch(addToast({
        type:     'success',
        message:  env === 'UAT'
          ? `Study published to UAT successfully. Database '${dbName}' created. Version ${release.version} released.`
          : `Study published to LIVE successfully. Database '${dbName}' created. Version ${release.version} released.`,
        duration: 6000,
      }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to create study database. Please contact system administrator.', duration: 5000 }));
    } finally {
      setPublishing(false);
    }
  };

  const handleSendInvitations = () => {
    dispatch(addToast({ type: 'success', message: 'Invitation emails sent successfully.', duration: 3000 }));
  };

  const handleDone = () => {
    dispatch(resetWizard());
    navigate('/cro/studies');
  };

  const copyLink = (link) => {
    navigator.clipboard?.writeText(link).then(() =>
      dispatch(addToast({ type: 'success', message: 'Link copied to clipboard.', duration: 2000 })),
    );
  };

  // ── Latest links ──────────────────────────────────────────────────────
  const latestUAT  = releases.find((r) => r.environment === 'UAT');
  const latestLIVE = releases.find((r) => r.environment === 'LIVE');

  return (
    <div className={styles.step}>
      <h2 className={styles.heading}>Publish Study</h2>
      <p className={styles.sub}>
        Configure and publish this study to a UAT or LIVE environment. Each publish creates a new versioned release.
      </p>

      {/* ── Publish configuration ────────────────────────────────────── */}
      <div className={styles.configGrid}>

        {/* Environment */}
        <div className={styles.configSection}>
          <p className={styles.sectionTitle}>Target Environment <span className={styles.required}>*</span></p>
          <div className={styles.envCards}>
            {['UAT', 'LIVE'].map((e) => (
              <label key={e} className={`${styles.envCard} ${env === e ? styles.envCardActive : ''}`}>
                <input
                  type="radio"
                  name="environment"
                  value={e}
                  checked={env === e}
                  onChange={() => setEnv(e)}
                  className={styles.hiddenRadio}
                />
                <div className={styles.envIcon}>
                  {e === 'UAT'
                    ? <Database size={22} />
                    : <Globe size={22} />}
                </div>
                <div className={styles.envInfo}>
                  <span className={styles.envLabel}>{e}</span>
                  <span className={styles.envDesc}>
                    {e === 'UAT' ? 'User Acceptance Testing — safe sandbox' : 'Production — live data collection'}
                  </span>
                </div>
                {env === e && <CheckCircle2 size={18} className={styles.envCheck} />}
              </label>
            ))}
          </div>

          {/* Database info pill */}
          {env && step1.studyId && (
            <div className={styles.dbInfo}>
              <Database size={13} />
              Database: <strong>{env === 'UAT' ? `UAT_${step1.studyId.toUpperCase().replace(/[^A-Z0-9_]/g,'_')}` : step1.studyId.toUpperCase().replace(/[^A-Z0-9_]/g,'_')}</strong>
              &nbsp;·&nbsp; Table prefix: <strong>{env === 'UAT' ? 'usp_' : 'sp_'}</strong>
            </div>
          )}
        </div>

        {/* Status + Description */}
        <div className={styles.configSection}>
          <p className={styles.sectionTitle}>Publication Details</p>

          <div className={styles.formGroup}>
            <label className={styles.label}>Status</label>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className={styles.selectIcon} />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description <span className={styles.optional}>(optional)</span></label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this release…"
            />
          </div>
        </div>
      </div>

      {/* ── Access links (shown if releases exist) ────────────────────── */}
      {(latestUAT || latestLIVE || published) && (
        <div className={styles.linksSection}>
          <p className={styles.sectionTitle}>Access Links</p>
          <div className={styles.linkCards}>
            {[latestUAT, latestLIVE].filter(Boolean).map((rel) => (
              <div key={rel.id} className={styles.linkCard}>
                <span className={`${styles.envTag} ${rel.environment === 'UAT' ? styles.envTagUAT : styles.envTagLIVE}`}>
                  {rel.environment}
                </span>
                <span className={styles.linkUrl}>{rel.accessLink}</span>
                <button className={styles.copyBtn} onClick={() => copyLink(rel.accessLink)} title="Copy link">
                  <Copy size={13} />
                </button>
                <button className={styles.inviteBtn} onClick={handleSendInvitations}>
                  <Send size={13} /> Send Invitations
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Version history ───────────────────────────────────────────── */}
      <div className={styles.historySection}>
        <p className={styles.sectionTitle}>Version History</p>
        {loadingRel ? (
          <p className={styles.historyEmpty}>Loading releases…</p>
        ) : releases.length === 0 ? (
          <p className={styles.historyEmpty}>No releases yet. Publish to create the first version.</p>
        ) : (
          <div className={styles.historyTable}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Environment</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Published Date</th>
                  <th>Published By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((rel, idx) => (
                  <tr key={rel.id} className={idx === 0 ? styles.latestRow : ''}>
                    <td>
                      <span className={styles.versionBadge}>{rel.version}</span>
                      {idx === 0 && <span className={styles.latestTag}>Latest</span>}
                    </td>
                    <td>
                      <span className={`${styles.envTag} ${rel.environment === 'UAT' ? styles.envTagUAT : styles.envTagLIVE}`}>
                        {rel.environment}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[`status${rel.status}`]}`}>
                        {rel.status}
                      </span>
                    </td>
                    <td className={styles.descCell}>{rel.description || '—'}</td>
                    <td className={styles.dateCell}>
                      {new Date(rel.publishedAt).toLocaleString('en-US', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className={styles.byCell}>{rel.publishedBy}</td>
                    <td>
                      <div className={styles.relActions}>
                        <button
                          className={styles.relBtn}
                          title="Copy access link"
                          onClick={() => copyLink(rel.accessLink)}
                        >
                          <Link2 size={12} />
                        </button>
                        <button
                          className={styles.relBtn}
                          title="View"
                          onClick={() => dispatch(addToast({ type: 'info', message: `Version ${rel.version} — ${rel.databaseName}`, duration: 3000 }))}
                        >
                          <Eye size={12} />
                        </button>
                        {idx > 0 && (
                          <button
                            className={`${styles.relBtn} ${styles.relBtnWarn}`}
                            title="Rollback to this version"
                            onClick={() => dispatch(addToast({ type: 'info', message: `Rollback to ${rel.version} is available in Study Management.`, duration: 4000 }))}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button type="button" className={styles.btnPrev} onClick={onPrevious}>
          <ArrowLeft size={14} /> Previous
        </button>
        <div className={styles.footerRight}>
          {published && (
            <button type="button" className={styles.btnDone} onClick={handleDone}>
              Done — Go to Studies
            </button>
          )}
          <button
            type="button"
            className={styles.btnPublish}
            onClick={handlePublishClick}
            disabled={publishing}
          >
            {publishing ? (
              <><span className={styles.spinner} /> Publishing…</>
            ) : (
              <><Globe size={14} /> Publish to {env || '…'}</>
            )}
          </button>
        </div>
      </div>

      {/* ── Confirmation modal ────────────────────────────────────────── */}
      {showConfirm && (
        <ConfirmModal
          env={env}
          studyId={step1.studyId}
          studyTitle={step1.studyTitle}
          onConfirm={handleConfirmedPublish}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

/* ── Confirmation Modal ─────────────────────────────────────────────────── */
function ConfirmModal({ env, studyId, studyTitle, onConfirm, onCancel }) {
  return (
    <div className={styles.modalBackdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Confirm Publication</span>
          <button className={styles.modalClose} onClick={onCancel}><X size={16} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={`${styles.confirmEnvBadge} ${env === 'UAT' ? styles.confirmEnvBadgeUAT : styles.confirmEnvBadgeLIVE}`}>
            {env === 'UAT' ? <Database size={20} /> : <Globe size={20} />}
            {env}
          </div>
          <p className={styles.confirmMsg}>
            Are you sure you want to publish <strong>{studyTitle || studyId}</strong> to <strong>{env}</strong>?
          </p>
          <p className={styles.confirmSub}>
            This action will create a new version and {env === 'UAT'
              ? `provision a dedicated UAT database (UAT_${studyId?.toUpperCase()?.replace(/[^A-Z0-9_]/g,'_')}).`
              : `provision a LIVE production database (${studyId?.toUpperCase()?.replace(/[^A-Z0-9_]/g,'_')}).`}
          </p>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnModalCancel} onClick={onCancel}>Cancel</button>
          <button
            className={`${styles.btnModalConfirm} ${env === 'LIVE' ? styles.btnModalConfirmLive : ''}`}
            onClick={onConfirm}
          >
            {env === 'UAT' ? <Database size={14} /> : <Globe size={14} />}
            Yes, Publish to {env}
          </button>
        </div>
      </div>
    </div>
  );
}
