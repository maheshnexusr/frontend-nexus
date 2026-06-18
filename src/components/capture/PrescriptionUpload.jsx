/**
 * PrescriptionUpload — compact trigger button that opens a dialog for managing
 * the subject's prescription attachments (doctor/PI uploads), shown in the
 * top bar of the data-capture form (CaptureFormPage / SiteCaptureFormPage).
 *
 * The trigger is a small button with a count badge so it takes almost no room
 * on the form. Clicking it opens a modal that lists the uploaded prescriptions
 * and lets the doctor upload more — images or PDFs.
 *
 * Each file is uploaded to disk via the shared /api/v1/form-files uploader,
 * then its reference is persisted on the subject immediately (independent of
 * the form's Save/Submit). The panel is scope-aware: it auto-detects site vs
 * sponsor from the URL so both capture pages share one component.
 *
 *   <PrescriptionUpload subjectId={subjectId} canUpload={canEdit} />
 */

import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  FileText, Image as ImageIcon, UploadCloud, Trash2, Loader2,
  ExternalLink, Paperclip,
} from 'lucide-react';
import Modal from '@/components/feedback/Modal';
import { uploadFormFile } from '@/api/formFileClient';
import { resolveFileUrl } from '@/api/fileUrl';
import { listPrescriptions, addPrescription, removePrescription } from '@/api/prescriptionClient';
import { addToast } from '@/app/notificationSlice';
import { formatDateTime } from '@/utils/formatDate';

const ACCEPT = 'image/*,application/pdf';
const MAX_MB = 15;

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const isImage = (p) => (p.type || '').startsWith('image/')
  || /\.(png|jpe?g|gif|webp|bmp)$/i.test(p.name || p.url || '');

export default function PrescriptionUpload({ subjectId, canUpload, triggerStyle }) {
  const location = useLocation();
  const scope = location.pathname.startsWith('/site/') ? 'site' : 'sponsor';
  const dispatch = useDispatch();
  const inputRef = useRef(null);

  const [open, setOpen]       = useState(false);
  const [hover, setHover]     = useState(false);
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  // Load once on mount so the trigger can show the count without opening.
  useEffect(() => {
    if (!subjectId) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    listPrescriptions(scope, subjectId)
      .then((rows) => { if (!cancelled) setItems(Array.isArray(rows) ? rows : []); })
      .catch(() => { /* silent — the dialog still opens, just empty */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope, subjectId]);

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file
    if (!files.length || !subjectId) return;

    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > MAX_MB * 1024 * 1024) {
          dispatch(addToast({ type: 'error', message: `${file.name} is larger than ${MAX_MB} MB.` }));
          continue;
        }
        try {
          const ref = await uploadFormFile(file, 'prescriptions');
          const next = await addPrescription(scope, subjectId, ref);
          setItems(Array.isArray(next) ? next : []);
        } catch (err) {
          dispatch(addToast({
            type: 'error',
            message: err?.response?.data?.message || err?.message || `Failed to upload ${file.name}.`,
          }));
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (presc) => {
    if (!window.confirm(`Remove attachment "${presc.name}"?`)) return;
    setRemovingId(presc.id);
    try {
      const next = await removePrescription(scope, subjectId, presc.id);
      setItems(Array.isArray(next) ? next : []);
    } catch (err) {
      dispatch(addToast({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to remove attachment.',
      }));
    } finally {
      setRemovingId(null);
    }
  };

  const count = items.length;
  // Hide the trigger entirely for a read-only viewer with nothing on file.
  if (!canUpload && !loading && count === 0) return null;

  return (
    <>
      <button
        type="button"
        style={{ ...S.trigger, ...(hover ? S.triggerHover : null), ...triggerStyle }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setOpen(true)}
        title="Attachments"
      >
        <span style={S.triggerIcon}><Paperclip size={13} /></span>
        Attachments
        <span style={count > 0 ? S.countBadge : S.countBadgeZero}>{count}</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Attachments"
        size="md"
        footer={
          <button type="button" style={S.closeBtn} onClick={() => setOpen(false)}>
            Close
          </button>
        }
      >
        <div style={S.modalHead}>
          <p style={S.modalSub}>
            The subject&apos;s attachments — images or PDF, up to {MAX_MB} MB each.
          </p>
          {canUpload && (
            <button type="button" style={S.uploadBtn} onClick={handlePick} disabled={uploading}>
              {uploading ? <Loader2 size={14} style={S.spin} /> : <UploadCloud size={14} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={handleFiles}
            style={{ display: 'none' }}
          />
        </div>

        {loading ? (
          <div style={S.empty}><Loader2 size={16} style={S.spin} /> Loading…</div>
        ) : count === 0 ? (
          <div style={S.emptyBox}>
            <FileText size={26} strokeWidth={1.25} style={{ color: '#cbd5e1' }} />
            <span style={S.emptyText}>No attachments uploaded yet.</span>
            {canUpload && (
              <button type="button" style={S.uploadGhost} onClick={handlePick} disabled={uploading}>
                <UploadCloud size={14} /> Upload the first one
              </button>
            )}
          </div>
        ) : (
          <ul style={S.list}>
            {items.map((p) => (
              <li key={p.id} style={S.item}>
                <span style={S.fileIcon}>
                  {isImage(p) ? <ImageIcon size={16} /> : <FileText size={16} />}
                </span>
                <div style={S.fileMeta}>
                  <a href={resolveFileUrl(p.url)} target="_blank" rel="noreferrer" style={S.fileName}>
                    {p.name} <ExternalLink size={11} style={{ opacity: 0.6 }} />
                  </a>
                  <div style={S.fileSub}>
                    {[
                      humanSize(p.size),
                      p.uploaded_by_name || null,
                      p.uploaded_at ? formatDateTime(p.uploaded_at) : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {canUpload && (
                  <button
                    type="button"
                    style={S.removeBtn}
                    onClick={() => handleRemove(p)}
                    disabled={removingId === p.id}
                    title="Remove attachment"
                    aria-label="Remove attachment"
                  >
                    {removingId === p.id ? <Loader2 size={14} style={S.spin} /> : <Trash2 size={14} />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

PrescriptionUpload.propTypes = {
  subjectId: PropTypes.string,
  canUpload: PropTypes.bool,
  triggerStyle: PropTypes.object,
};

const S = {
  trigger: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 6px',
    borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
    boxShadow: '0 1px 2px rgba(37,99,235,0.10)', transition: 'all 0.12s ease',
  },
  triggerHover: { background: '#dbeafe', borderColor: '#93c5fd' },
  triggerIcon: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: 999, background: '#fff', color: '#2563eb',
    boxShadow: 'inset 0 0 0 1px #dbeafe',
  },
  countBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: '#2563eb', color: '#fff',
  },
  countBadgeZero: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8',
  },

  modalHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  modalSub: { margin: 0, flex: '1 1 auto', fontSize: 12.5, color: '#64748b', lineHeight: 1.5 },
  uploadBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid #2563eb', background: '#2563eb', color: '#fff', flexShrink: 0,
  },
  uploadGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '7px 14px',
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid #cbd5e1', background: '#fff', color: '#1d4ed8',
  },
  closeBtn: {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
  },

  empty: { fontSize: 12.5, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' },
  emptyBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '26px 16px', borderRadius: 10, border: '1px dashed #e2e8f0', background: '#f8fafc',
  },
  emptyText: { fontSize: 13, color: '#94a3b8' },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  item: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
    borderRadius: 8, border: '1px solid #eef2f7', background: '#f8fafc',
  },
  fileIcon: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0',
    color: '#475569', flexShrink: 0,
  },
  fileMeta: { flex: '1 1 auto', minWidth: 0 },
  fileName: {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600,
    color: '#1d4ed8', textDecoration: 'none', maxWidth: '100%',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  fileSub: { fontSize: 11.5, color: '#94a3b8', marginTop: 1 },
  removeBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 7, cursor: 'pointer',
    border: '1px solid #fecaca', background: '#fff', color: '#dc2626', flexShrink: 0,
  },
  spin: { animation: 'spin 0.8s linear infinite' },
};
