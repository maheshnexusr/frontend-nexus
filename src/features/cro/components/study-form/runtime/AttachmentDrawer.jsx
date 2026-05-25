import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2, Download, UploadCloud, FileText } from 'lucide-react';
import {
  selectFieldBucket, addAttachment, removeAttachment,
} from '@/features/cro/store/formRuntimeSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
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

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => {
      const fileUrl = URL.createObjectURL(f);
      dispatch(addAttachment({
        fieldId,
        fileName: f.name,
        fileUrl,
        fileSize: f.size,
        fileType: f.type,
        ...me,
      }));
    });
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
        <div>Click or drag files to upload</div>
        <div className={s.attachmentSize}>PDF, images, DOCX — multiple allowed</div>
      </div>
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
                      href={a.fileUrl}
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
                      onClick={() => dispatch(removeAttachment({ fieldId, attachmentId: a.id, ...me }))}
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
