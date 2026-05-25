/**
 * SnapshotButton — capture the current page (or a specific element) as a PNG.
 *
 *   <SnapshotButton
 *     leaf="query_manager"        // permission leaf to gate against
 *     filename="queries"          // file stem; gets a timestamp suffix
 *     className={css.btnSecondary}
 *     targetRef={someRef}         // optional — defaults to <main> / document.body
 *   />
 *
 * The button renders only when the active role has the `snapshot` action on
 * the given leaf. Capture uses html2canvas; the resulting PNG is downloaded
 * via an anchor click (no upload, no server round-trip).
 *
 * Why a permission-gated button rather than just a print stylesheet:
 *   • the spec lists Snapshot as a discrete role action (migration 027) —
 *     a role can be allowed to view a screen but not export a snapshot of it.
 *   • PNG capture preserves the on-screen state (filters applied, scroll
 *     position) better than `window.print()`, which is the spec intent.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { Camera, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { usePermissions } from '@/features/auth/usePermissions';
import { formatDate } from '@/utils/formatDate';
import s from './SnapshotButton.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/** Build a filename stem like "queries_2026-05-12_143025.png". */
function buildFilename(stem) {
  const safe = String(stem || 'snapshot').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  const date = formatDate(new Date()) || 'snapshot';
  const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `${safe}_${date}_${time}.png`;
}

export default function SnapshotButton({
  leaf, filename, label, targetRef, className, title,
}) {
  const { has } = usePermissions();
  const [busy, setBusy] = useState(false);

  if (!has(leaf, 'snapshot')) return null;

  const handleClick = async () => {
    if (busy) return;
    // Prefer the explicit target, then the closest <main>, then the body.
    const node = targetRef?.current
      ?? document.querySelector('main')
      ?? document.body;
    setBusy(true);
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        // Higher pixel ratio so the captured PNG matches modern display
        // density. Capped at 2 to keep file size reasonable for big tables.
        scale: Math.min(2, window.devicePixelRatio || 1),
        // Skip elements explicitly opted out — used by modals / overlays that
        // shouldn't appear in the snapshot.
        ignoreElements: (el) => el.dataset?.snapshotIgnore === 'true',
        useCORS: true,
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = buildFilename(filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[snapshot] capture failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={clx(s.btn, className)}
      onClick={handleClick}
      disabled={busy}
      title={title || 'Capture a snapshot of this page'}
      data-snapshot-ignore="true"
    >
      {busy
        ? <><Loader2 size={13} className={s.spin} /> Capturing…</>
        : <><Camera  size={13} /> {label || 'Snapshot'}</>
      }
    </button>
  );
}

SnapshotButton.propTypes = {
  /** Permission leaf to gate the button on (must have `snapshot` action). */
  leaf:      PropTypes.string.isRequired,
  /** File stem for the downloaded PNG — date + time suffix appended automatically. */
  filename:  PropTypes.string,
  /** Visible label. Defaults to "Snapshot". */
  label:     PropTypes.string,
  /** Optional ref to a specific element to capture (defaults to the page <main>). */
  targetRef: PropTypes.shape({ current: PropTypes.any }),
  /** Pass-through for visual integration with the host page's toolbar. */
  className: PropTypes.string,
  /** Hover tooltip override. */
  title:     PropTypes.string,
};

SnapshotButton.defaultProps = {
  filename:  'snapshot',
  label:     'Snapshot',
  targetRef: null,
  className: '',
  title:     '',
};
