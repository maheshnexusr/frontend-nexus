/**
 * SignatureInput — capture a signature by DRAWING on a canvas OR UPLOADING an
 * image. The drawn/selected image is UPLOADED to the backend (stored on disk
 * under /var/www/uploads/<env>/<study_id>/) and the field value becomes the
 * stored URL string ("/uploads/<env>/<study_id>/<file>").
 *
 * Canvas uploads are debounced (~500ms after the last stroke) so a normal
 * signing session persists as a single file, not one per stroke.
 *
 * Legacy records may hold an inline "data:image/..." base64 value — those still
 * render (back-compat) via the data:/url check below.
 *
 *   <SignatureInput value={url} onChange={setUrl} disabled={...} />
 */
import { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Pen, Upload, Eraser, UploadCloud, Loader2, CheckCircle2, FileSignature } from 'lucide-react';
import { uploadFormFile } from '@/api/formFileClient';
import { resolveFileUrl } from '@/api/fileUrl';

// A renderable image value: inline base64 (legacy), a stored upload path, or an
// absolute URL.
const isImageVal = (v) =>
  typeof v === 'string' &&
  (v.startsWith('data:image') || v.startsWith('/uploads') || /^https?:/i.test(v));

// Convert a canvas data-URL into a File so it can go through the upload client.
function dataUrlToFile(dataUrl, filename) {
  const [meta, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

export default function SignatureInput({ value, onChange, disabled }) {
  const [mode, setMode] = useState('draw'); // 'draw' | 'upload'
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const fileRef = useRef(null);
  const uploadTimer = useRef(null);

  // Paint an existing value back onto the canvas when (re)entering draw mode.
  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isImageVal(value)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = resolveFileUrl(value);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel any pending debounced upload on unmount.
  useEffect(() => () => clearTimeout(uploadTimer.current), []);

  const doUpload = async (file) => {
    setUploading(true);
    setError('');
    try {
      const res = await uploadFormFile(file, 'images'); // signatures live with images
      onChange(res.url);
    } catch (err) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches?.[0];
    const cx = (t ? t.clientX : e.clientX) - rect.left;
    const cy = (t ? t.clientY : e.clientY) - rect.top;
    return { x: cx * (canvas.width / rect.width), y: cy * (canvas.height / rect.height) };
  };

  const start = (e) => {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    // Debounce: upload once the user pauses, so a multi-stroke signature
    // becomes a single stored file instead of one per stroke.
    const dataUrl = canvasRef.current.toDataURL('image/png');
    clearTimeout(uploadTimer.current);
    uploadTimer.current = setTimeout(() => {
      doUpload(dataUrlToFile(dataUrl, 'signature.png'));
    }, 500);
  };

  const clear = () => {
    clearTimeout(uploadTimer.current);
    const canvas = canvasRef.current;
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setError('');
    onChange('');
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await doUpload(file);
  };

  const isUploaded = mode === 'upload';
  const saved = isImageVal(value) && !uploading;

  return (
    <div style={S.card}>
      {/* Header — title + segmented Draw/Upload toggle + status. */}
      <div style={S.header}>
        <span style={S.headTitle}>
          <FileSignature size={14} style={{ color: '#475569' }} /> Signature
        </span>
        <div style={S.segment}>
          <button type="button" onClick={() => setMode('draw')} disabled={disabled} style={seg(mode === 'draw')}>
            <Pen size={12} /> Draw
          </button>
          <button type="button" onClick={() => setMode('upload')} disabled={disabled} style={seg(mode === 'upload')}>
            <Upload size={12} /> Upload
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {uploading ? (
          <span style={S.statusMuted}><Loader2 size={13} style={S.spin} /> Saving…</span>
        ) : saved ? (
          <span style={S.statusOk}><CheckCircle2 size={13} /> Saved</span>
        ) : null}
        {(value || mode === 'draw') && (
          <button type="button" onClick={clear} disabled={disabled} style={clearBtn}>
            <Eraser size={12} /> Clear
          </button>
        )}
      </div>

      {!isUploaded ? (
        <div style={S.canvasWrap}>
          <canvas
            ref={canvasRef}
            width={760}
            height={240}
            style={{ ...S.canvas, cursor: disabled ? 'not-allowed' : 'crosshair' }}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          />
          {/* Signature baseline + label — DOM overlay (pointerEvents:none) so it
              is NOT captured into the uploaded signature image. */}
          <div style={S.baseline} />
          <span style={S.baselineX}>✕</span>
          <span style={S.baselineLabel}>Sign here</span>
        </div>
      ) : (
        <div>
          {isImageVal(value) ? (
            <div style={S.preview}>
              <img src={resolveFileUrl(value)} alt="Signature" style={S.previewImg} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled || uploading} style={S.replaceBtn}>
                <Upload size={12} /> Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || uploading}
              style={S.dropzone}
            >
              <UploadCloud size={22} style={{ color: '#94a3b8' }} />
              <span style={S.dropzoneTitle}>Choose a signature image</span>
              <span style={S.dropzoneSub}>PNG or JPG — a clear scan or photo of the signature</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onUpload} />
        </div>
      )}

      {error && <div style={S.error}>{error}</div>}
      {!isUploaded && !error && (
        <div style={S.hint}>Sign on the panel above — your signature is saved automatically as an image.</div>
      )}
    </div>
  );
}

SignatureInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

// Segmented-control button (Draw / Upload) — the active half is filled.
const seg = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600,
  borderRadius: 6, cursor: 'pointer', border: 'none',
  background: active ? '#fff' : 'transparent',
  color: active ? '#1d4ed8' : '#64748b',
  boxShadow: active ? '0 1px 2px rgba(15,23,42,0.12)' : 'none',
  transition: 'all 0.12s ease',
});
const clearBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, fontWeight: 600,
  borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer',
};

const S = {
  card: {
    border: '1px solid #e2e8f0', borderRadius: 12, padding: 12,
    background: 'linear-gradient(180deg,#fbfdff 0%,#fff 60%)',
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  headTitle: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#334155' },
  segment: { display: 'inline-flex', gap: 2, padding: 2, background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0' },
  statusMuted: { display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'center', fontSize: 12, color: '#64748b' },
  statusOk: { display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'center', fontSize: 12, fontWeight: 600, color: '#15803d' },

  canvasWrap: { position: 'relative' },
  canvas: {
    width: '100%', height: 240, display: 'block', borderRadius: 12, background: '#fff',
    border: '1.5px dashed #cbd5e1', touchAction: 'none',
    boxShadow: 'inset 0 1px 4px rgba(15,23,42,0.05)',
  },
  baseline: { position: 'absolute', left: 28, right: 28, bottom: 46, borderTop: '2px solid #cbd5e1', pointerEvents: 'none' },
  baselineX: { position: 'absolute', left: 24, bottom: 50, fontSize: 18, lineHeight: 1, color: '#cbd5e1', pointerEvents: 'none' },
  baselineLabel: {
    position: 'absolute', left: 28, bottom: 24, fontSize: 10.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: '#cbd5e1', fontWeight: 600, pointerEvents: 'none',
  },

  dropzone: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    width: '100%', padding: '26px 16px', borderRadius: 12, cursor: 'pointer',
    border: '1.5px dashed #cbd5e1', background: '#f8fafc',
  },
  dropzoneTitle: { fontSize: 13, fontWeight: 600, color: '#334155' },
  dropzoneSub: { fontSize: 11.5, color: '#94a3b8' },

  preview: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  previewImg: {
    maxHeight: 120, maxWidth: '100%', padding: 8, border: '1px solid #e2e8f0',
    borderRadius: 10, background: '#fff', boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.05)',
  },
  replaceBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600,
    borderRadius: 8, cursor: 'pointer', border: '1px solid #cbd5e1', background: '#fff', color: '#475569',
  },

  error: { marginTop: 8, fontSize: 12, color: '#b91c1c' },
  hint: { marginTop: 8, fontSize: 11.5, color: '#94a3b8' },
  spin: { animation: 'spin 0.8s linear infinite' },
};
