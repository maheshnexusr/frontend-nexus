/**
 * PublishSettingsModal — opened from a Studies-table row. Shows two history
 * tables (UAT + Production) and is the canonical place to publish a new
 * release per environment. Replaces the old Design-page Publish button.
 */
import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { Loader2, Rocket, CircleStop } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { studiesClient } from '@/features/cro/api/studiesClient';
import { usePermissions } from '@/features/auth/usePermissions';
import { addToast } from '@/app/notificationSlice';
import { formatDateTime } from '@/utils/formatDate';
import styles from './PublishSettingsModal.module.css';

const fmtDateTime = (iso) => formatDateTime(iso) || '—';

const ENV_LABEL = { UAT: 'UAT', LIVE: 'Production' };

function HistoryTable({ rows }) {
  if (!rows.length) {
    return <p className={styles.empty}>No publishes yet for this environment.</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Version</th>
            <th>Published</th>
            <th>By</th>
            <th>Status</th>
            <th>Database</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className={v.isCurrent ? styles.currentRow : ''}>
              <td>
                v{v.versionNumber}
                {v.isCurrent && <span className={styles.currentTag}>current</span>}
              </td>
              <td>{fmtDateTime(v.publishedAt)}</td>
              <td>{v.publishedByName || v.publishedBy || '—'}</td>
              <td>{v.status || '—'}</td>
              <td><code className={styles.dbName}>{v.databaseName || '—'}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

HistoryTable.propTypes = { rows: PropTypes.array.isRequired };

function EnvironmentSection({ env, rows, onPublish, onStop, publishing, stopping, canPublish, canStop }) {
  const hasActive = rows.some((v) => v.isCurrent);
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <h3 className={styles.sectionTitle}>{ENV_LABEL[env]}</h3>
          <span className={hasActive ? styles.statusActive : styles.statusStopped}>
            {hasActive ? 'Active' : 'Stopped'}
          </span>
        </div>
        <div className={styles.sectionActions}>
          <span className={styles.sectionMeta}>
            {rows.length ? `${rows.length} release${rows.length === 1 ? '' : 's'}` : 'No releases yet'}
          </span>
          {canStop && hasActive && (
            <button
              type="button"
              className={styles.stopBtn}
              onClick={() => onStop(env)}
              disabled={publishing || stopping}
              title={`Unpublish ${ENV_LABEL[env]} — env disappears from sponsor/site pickers, tenant DB is kept.`}
            >
              {stopping
                ? <><Loader2 size={14} className={styles.spin} /> Stopping…</>
                : <><CircleStop size={14} /> Stop {ENV_LABEL[env]}</>
              }
            </button>
          )}
          {canPublish && (
            <button
              type="button"
              className={env === 'LIVE' ? styles.publishLive : styles.publishUat}
              onClick={() => onPublish(env)}
              disabled={publishing || stopping}
            >
              {publishing
                ? <><Loader2 size={14} className={styles.spin} /> Publishing…</>
                : <><Rocket size={14} /> Publish to {ENV_LABEL[env]}</>
              }
            </button>
          )}
        </div>
      </header>
      <HistoryTable rows={rows} />
    </section>
  );
}

EnvironmentSection.propTypes = {
  env:        PropTypes.oneOf(['UAT', 'LIVE']).isRequired,
  rows:       PropTypes.array.isRequired,
  onPublish:  PropTypes.func.isRequired,
  onStop:     PropTypes.func.isRequired,
  publishing: PropTypes.bool.isRequired,
  stopping:   PropTypes.bool.isRequired,
  canPublish: PropTypes.bool.isRequired,
  canStop:    PropTypes.bool.isRequired,
};

export default function PublishSettingsModal({ open, study, onClose, onPublished }) {
  const dispatch = useDispatch();
  const { has } = usePermissions();
  const canPublish     = has('studies', 'publish');
  // Stop UAT / Stop Production are discrete permissions (separate from publish).
  // A role can be allowed to publish but not stop, or vice versa.
  const canStopUat     = has('studies', 'stop_uat');
  const canStopLive    = has('studies', 'stop_production');

  const [loading, setLoading]   = useState(false);
  const [uat,     setUat]       = useState([]);
  const [live,    setLive]      = useState([]);
  const [publishingEnv, setPublishingEnv] = useState(null);
  const [stoppingEnv,   setStoppingEnv]   = useState(null);

  const load = useCallback(async () => {
    if (!study?.id) return;
    setLoading(true);
    try {
      const groups = await studiesClient.versions(study.id);
      setUat(groups.uat);
      setLive(groups.live);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to load publish history.' }));
    } finally {
      setLoading(false);
    }
  }, [study?.id, dispatch]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handlePublish = async (environment) => {
    if (!study?.id) return;
    setPublishingEnv(environment);
    try {
      await studiesClient.publish(study.id, { environment });
      dispatch(addToast({
        type: 'success',
        message: `Study published to ${ENV_LABEL[environment]} successfully.`,
      }));
      await load();
      onPublished?.();
    } catch (e) {
      dispatch(addToast({
        type: 'error',
        message: e?.message ?? `Failed to publish to ${ENV_LABEL[environment]}.`,
      }));
    } finally {
      setPublishingEnv(null);
    }
  };

  const handleStop = async (environment) => {
    if (!study?.id) return;
    const ok = window.confirm(
      `Stop the ${ENV_LABEL[environment]} environment?\n\n`
      + `Sponsor and site users will no longer see this study in ${ENV_LABEL[environment]}. `
      + `Captured data and the tenant database are kept — you can re-publish anytime to bring it back.`
    );
    if (!ok) return;
    setStoppingEnv(environment);
    try {
      await studiesClient.stop(study.id, { environment });
      dispatch(addToast({
        type: 'success',
        message: `${ENV_LABEL[environment]} environment stopped.`,
      }));
      await load();
      onPublished?.();
    } catch (e) {
      dispatch(addToast({
        type: 'error',
        message: e?.message ?? `Failed to stop ${ENV_LABEL[environment]}.`,
      }));
    } finally {
      setStoppingEnv(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={study ? `Publish Settings — ${study.studyId || study.protocolNumber}` : 'Publish Settings'}
    >
      {!study ? null : loading ? (
        <div className={styles.loading}>
          <Loader2 size={20} className={styles.spin} /> Loading publish history…
        </div>
      ) : (
        <>
          <EnvironmentSection
            env="UAT"
            rows={uat}
            onPublish={handlePublish}
            onStop={handleStop}
            publishing={publishingEnv === 'UAT'}
            stopping={stoppingEnv === 'UAT'}
            canPublish={canPublish}
            canStop={canStopUat}
          />
          <EnvironmentSection
            env="LIVE"
            rows={live}
            onPublish={handlePublish}
            onStop={handleStop}
            publishing={publishingEnv === 'LIVE'}
            stopping={stoppingEnv === 'LIVE'}
            canPublish={canPublish}
            canStop={canStopLive}
          />
        </>
      )}
    </Modal>
  );
}

PublishSettingsModal.propTypes = {
  open:        PropTypes.bool.isRequired,
  study:       PropTypes.object,
  onClose:     PropTypes.func.isRequired,
  onPublished: PropTypes.func,
};

PublishSettingsModal.defaultProps = {
  study:       null,
  onPublished: null,
};
