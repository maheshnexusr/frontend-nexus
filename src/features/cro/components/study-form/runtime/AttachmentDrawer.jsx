import { useRef, useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Trash2, Download, UploadCloud, FileText } from 'lucide-react';
import {
  selectFieldBucket, addAttachment, removeAttachment, setAttachments,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { uploadFormFile } from '@/api/formFileClient';
import { formCollaborationClient } from '@/api/formCollaborationClient';
import { resolveFileUrl } from '@/api/fileUrl';
import { formatDateTime } from '@/utils/formatDate';
import Popover from './Popover';
import s from './runtime.module.css';

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const fmt = (iso) => formatDateTime(iso);

export default function AttachmentDrawer({ fieldId, fieldLabel, anchorRect, onClose }) {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);
  const bucket   = useSelector(selectFieldBucket(fieldId));

  const me = {
    by:     user?.id ?? 'unknown',
    byName: user?.fullName ?? user?.email ?? 'You',
  };

  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Subject from the data-capture URL. When present we persist attachments
  // server-side (keyed by subjectId) so the list survives reloads; in the CRO
  // designer preview (no subjectId) we fall back to Redux-only.
  const [params] = useSearchParams();
  const subjectId = params.get('subjectId') || '';
  const persistable = !!subjectId;

  // Hydrate the persisted list on open / when the target field changes.
  const reload = useCallback(async () => {
    if (!persistable) return;
    try {
      const list = await formCollaborationClient.listAttachments(subjectId, fieldId);
      dispatch(setAttachments({ fieldId, attachments: list }));
    } catch { /* best-effort hydrate */ }
  }, [persistable, subjectId, fieldId, dispatch]);

  useEffect(() => { reload(); }, [reload]);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        // Upload bytes to disk (/var/www/uploads/<env>/<study_id>/) …
        const res = await uploadFormFile(f); // { url, name, type, size }
        if (persistable) {
          // … then persist the reference so it survives reloads.
          await formCollaborationClient.createAttachment(subjectId, fieldId, {
            fileUrl: res.url, fileName: res.name, fileSize: res.size, fileType: res.type,
          });
        } else {
          dispatch(addAttachment({
            fieldId, fileName: res.name, fileUrl: res.url, fileSize: res.size, fileType: res.type, ...me,
          }));
        }
      }
      if (persistable) await reload();
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (attachmentId) => {
    if (persistable) {
      try {
        await formCollaborationClient.deleteAttachment(subjectId, fieldId, attachmentId);
        await reload();
      } catch (err) {
        setError(err?.message || 'Failed to remove attachment.');
      }
    } else {
      dispatch(removeAttachment({ fieldId, attachmentId, ...me }));
    }
  };

  const handlePick = () => fileRef.current?.click();
  const handleChange = (e) => { handleFiles(e.target.files); e.target.value = ''; };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const attachments = bucket?.attachments ?? [];

  return (
    <Popover
      anchorRect={anchorRect}
      title={`Attachments · ${fieldLabel}`}
      width={400}
      maxHeight={500}
      onClose={onClose}
      footer={<button type="button" className={s.btnSecondary} onClick={onClose}>Close</button>}
    >
      <div
        className={`${s.dropZone} ${dragOver ? s.dropZoneActive : ''}`}
        onClick={handlePick}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <UploadCloud size={20} className={s.attachmentIcon} />
        <div>{uploading ? 'Uploading…' : 'Click or drag files to upload'}</div>
        <div className={s.attachmentSize}>PDF, images, DOCX — multiple allowed</div>
      </div>
      {error && <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>}
      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <div style={{ marginTop: 12 }}>
        {attachments.length === 0 ? (
          <div className={s.emptyState}>No files attached yet.</div>
        ) : (
          <div className={s.itemList}>
            {attachments.map((a) => (
              <div key={a.id} className={s.item}>
                <div className={s.itemHead}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <FileText size={14} style={{ flexShrink: 0, color: '#475569' }} />
                    <div style={{ minWidth: 0 }}>
                      <div className={s.itemAuthor} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.fileName}
                      </div>
                      <div className={s.itemMeta}>
                        {fmtSize(a.fileSize)} · {a.uploadedByName} · {fmt(a.uploadedAt)}
                      </div>
                    </div>
                  </div>
                  <div className={s.itemActions}>
                    <a
                      href={resolveFileUrl(a.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      download={a.fileName}
                      className={s.itemActionBtn}
                      title="Download"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download size={13} />
                    </a>
                    <button
                      type="button"
                      className={`${s.itemActionBtn} ${s.itemActionBtnDanger}`}
                      title="Remove"
                      onClick={() => handleRemove(a.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
}
