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
import { Pen, Upload, Eraser } from 'lucide-react';
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
      const res = await uploadFormFile(file);
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
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
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

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={() => setMode('draw')} disabled={disabled}
          style={tab(mode === 'draw')}><Pen size={12} /> Draw</button>
        <button type="button" onClick={() => setMode('upload')} disabled={disabled}
          style={tab(mode === 'upload')}><Upload size={12} /> Upload</button>
        <div style={{ flex: 1 }} />
        {uploading && <span style={{ alignSelf: 'center', fontSize: 12, color: '#64748b' }}>Uploading…</span>}
        {(value || mode === 'draw') && (
          <button type="button" onClick={clear} disabled={disabled} style={clearBtn}>
            <Eraser size={12} /> Clear
          </button>
        )}
      </div>

      {!isUploaded ? (
        <canvas
          ref={canvasRef}
          width={520}
          height={160}
          style={{ width: '100%', height: 160, border: '1px dashed #cbd5e1', borderRadius: 6, background: '#f8fafc', cursor: disabled ? 'not-allowed' : 'crosshair', touchAction: 'none' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      ) : (
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled || uploading}
            style={{ ...tab(false), width: '100%', justifyContent: 'center', padding: '10px' }}>
            <Upload size={14} /> Choose signature image
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onUpload} />
          {isImageVal(value) && (
            <img src={resolveFileUrl(value)} alt="Signature" style={{ marginTop: 8, maxHeight: 120, maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }} />
          )}
        </div>
      )}

      {error && <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>}
    </div>
  );
}

SignatureInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

const tab = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600,
  borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${active ? '#2563eb' : '#cbd5e1'}`,
  background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#475569',
});
const clearBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer' };
