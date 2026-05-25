/**
 * SlaSettingsModal — per-status SLA configuration for Query Manager OR
 * Data Verification.
 *
 *   <SlaSettingsModal
 *     open
 *     kind="query_manager"        // or "data_verification"
 *     canEdit={hasSlaSettingsPerm}
 *     onClose={() => setOpen(false)}
 *     onSaved={(settings) => …}
 *   />
 *
 * Renders a Status × SLA Days × Enable Overdue table per the spec. The
 * status list comes from the backend DTO so this component is feature-
 * agnostic — drop in a new `kind` and the right rows appear.
 *
 * Read access only needs the matching feature's `view` permission; editing
 * is gated on the discrete `<leaf>.sla_settings` action via the `canEdit`
 * prop. View-only renders the same table without Save.
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { addToast } from '@/app/notificationSlice';
import { sponsorSlaClient } from '@/features/sponsor/api/sponsorSlaClient';
import { formatDateTime } from '@/utils/formatDate';
import styles from './SlaSettingsModal.module.css';

const KIND_LABEL = {
  query_manager:     'Query Manager',
  data_verification: 'Data Verification',
};

export default function SlaSettingsModal({ open, kind, canEdit, onClose, onSaved }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [rows,    setRows]    = useState([]);   // [{ status, days, overdueEnabled }]
  const [warn,    setWarn]    = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [meta,    setMeta]    = useState({ updatedBy: null, updatedByName: null, updatedAt: null, isDefault: true });
  const [error,   setError]   = useState(null);

  // Re-fetch on open / kind change so re-opening for a different leaf hydrates
  // the right rows.
  useEffect(() => {
    if (!open || !kind) return undefined;
    let cancelled = false;
    setError(null);
    setLoading(true);
    sponsorSlaClient.get(kind)
      .then((dto) => {
        if (cancelled) return;
        setRows(dto.statuses ?? []);
        setWarn(Number.isFinite(Number(dto.warnDaysBefore)) ? Number(dto.warnDaysBefore) : 1);
        setEnabled(dto.enabled ?? true);
        setMeta({
          updatedBy:     dto.updatedBy     ?? null,
          updatedByName: dto.updatedByName ?? null,
          updatedAt:     dto.updatedAt     ?? null,
          isDefault:     dto.isDefault     ?? false,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load SLA settings.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, kind]);

  const updateRow = (status, patch) => {
    setRows((prev) => prev.map((r) => (r.status === status ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    // Validate all rows.
    for (const r of rows) {
      const days = Number(r.days);
      if (!Number.isInteger(days) || days < 0) {
        setError(`SLA days for "${r.status}" must be a non-negative whole number.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const dto = await sponsorSlaClient.update(kind, {
        statuses: rows.map((r) => ({
          status: r.status,
          days:   Number(r.days),
          overdueEnabled: Boolean(r.overdueEnabled),
        })),
        warnDaysBefore: Number(warn),
        enabled,
      });
      dispatch(addToast({
        type: 'success',
        message: `${KIND_LABEL[kind] ?? 'SLA'} settings saved.`,
      }));
      onSaved?.(dto);
      onClose?.();
    } catch (err) {
      setError(err?.message ?? 'Failed to save SLA settings.');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button className={styles.cancelBtn} type="button" onClick={onClose} disabled={saving}>
        {canEdit ? 'Cancel' : 'Close'}
      </button>
      {canEdit && (
        <button
          className={styles.saveBtn}
          type="button"
          onClick={handleSave}
          disabled={saving || loading || rows.length === 0}
        >
          {saving
            ? (<><Loader2 size={14} className={styles.spin} /> Saving…</>)
            : 'Submit'}
        </button>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`${KIND_LABEL[kind] ?? 'SLA'} — SLA Settings`}
      footer={footer}
    >
      {loading ? (
        <div className={styles.loading}>
          <Loader2 size={20} className={styles.spin} /> Loading SLA settings…
        </div>
      ) : (
        <div className={styles.body}>
          {meta.isDefault && (
            <p className={styles.defaultNotice}>
              <Clock size={13} /> No SLA configured yet — showing platform defaults.
              {canEdit ? ' Adjust below and Submit to make it official.' : ''}
            </p>
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thStatus}>Status</th>
                <th className={styles.thDays}>SLA Days</th>
                <th className={styles.thOverdue}>Enable Overdue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.status}>
                  <td className={styles.tdStatus}>{r.status}</td>
                  <td className={styles.tdDays}>
                    <input
                      type="number"
                      min="0"
                      className={styles.daysInput}
                      value={r.days}
                      onChange={(e) => updateRow(r.status, { days: e.target.value })}
                      disabled={!canEdit || saving}
                    />
                  </td>
                  <td className={styles.tdOverdue}>
                    <label className={styles.overdueLabel}>
                      <input
                        type="checkbox"
                        checked={Boolean(r.overdueEnabled)}
                        onChange={(e) => updateRow(r.status, { overdueEnabled: e.target.checked })}
                        disabled={!canEdit || saving}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.extras}>
            <label className={styles.extraField}>
              <span className={styles.extraLabel}>Warn this many days before due</span>
              <input
                type="number"
                min="0"
                className={styles.daysInput}
                value={warn}
                onChange={(e) => setWarn(e.target.value)}
                disabled={!canEdit || saving}
              />
              <span className={styles.help}>0 disables advance warnings.</span>
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!canEdit || saving}
              />
              <span>SLA enforcement enabled for this workspace</span>
            </label>
          </div>

          {!meta.isDefault && (
            <p className={styles.metaLine}>
              Last updated {formatDateTime(meta.updatedAt) || '—'}
              {/* Prefer the resolved full name; fall back to the raw id only
                  when the user lookup turned up nothing (e.g. deleted user). */}
              {(meta.updatedByName || meta.updatedBy)
                ? ` by ${meta.updatedByName || meta.updatedBy}`
                : ''}.
            </p>
          )}

          {error && (
            <div className={styles.error} role="alert">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

SlaSettingsModal.propTypes = {
  open:    PropTypes.bool.isRequired,
  kind:    PropTypes.oneOf(['query_manager', 'data_verification']).isRequired,
  canEdit: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
};

SlaSettingsModal.defaultProps = {
  canEdit: false,
  onSaved: null,
};
