/**
 * ImageUpload — click or drag-and-drop image field
 *
 * react-hook-form  Controller pattern (recommended):
 *   <Controller
 *     name="photograph"
 *     control={control}
 *     render={({ field: { value, onChange } }) => (
 *       <FormField label="Profile Photo" error={errors.photograph?.message}>
 *         <ImageUpload value={value} onChange={onChange} circular />
 *       </FormField>
 *     )}
 *   />
 *
 * Uncontrolled (register):
 *   The internal <input type="file"> accepts ref forwarding but for RHF the
 *   Controller pattern above is the idiomatic choice for file inputs.
 */

import { useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Camera, Trash2, Lock, UploadCloud, AlertCircle } from 'lucide-react';
import styles from './ImageUpload.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';
const DEFAULT_MAX_MB = 2;

function formatBytes(bytes) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${(bytes / 1_000).toFixed(0)} KB`;
}

export default function ImageUpload({
  value,
  onChange,
  accept,
  maxSize,
  circular,
  disabled,
  error,
  encrypted,
}) {
  const inputRef = useRef(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [fileError, setFileError] = useState('');

  const maxBytes = maxSize * 1_000_000;

  /* ── Validate + read file ──────────────────────────────────────────────── */
  const processFile = useCallback((file) => {
    if (!file) return;
    setFileError('');

    // Type check
    const allowed = accept.split(',').map((t) => t.trim());
    if (!allowed.some((t) => file.type === t || file.type.startsWith(t.replace('*', '')))) {
      setFileError(`Unsupported file type. Allowed: ${accept}`);
      return;
    }

    // Size check
    if (file.size > maxBytes) {
      setFileError(`File too large. Maximum size is ${formatBytes(maxBytes)}.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => onChange?.(e.target.result);
    reader.readAsDataURL(file);
  }, [accept, maxBytes, onChange]);

  /* ── Events ────────────────────────────────────────────────────────────── */
  const handleInputChange = (e) => processFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e) => { e.preventDefault(); if (!disabled) setDragOver(true); };
  const handleDragLeave = ()  => setDragOver(false);

  const openPicker = () => { if (!disabled) inputRef.current?.click(); };

  const remove = (e) => {
    e.stopPropagation();
    setFileError('');
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  /* ── Render ────────────────────────────────────────────────────────────── */
  const hasImage = Boolean(value);

  return (
    <div className={styles.root}>
      {/* hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.hiddenInput}
        onChange={handleInputChange}
        disabled={disabled}
        aria-label="Upload image"
        tabIndex={-1}
      />

      {circular ? (
        /* ── Circular (profile photo) mode ── */
        <div
          className={clx(
            styles.circle,
            error    && styles.circleError,
            disabled && styles.circleDisabled,
          )}
          onClick={openPicker}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker(); }}
          aria-label="Upload profile photo"
        >
          {hasImage ? (
            <>
              <img src={value} alt="Profile" className={styles.circleImg} />
              <div className={styles.circleOverlay}>
                <Camera size={18} />
              </div>
            </>
          ) : (
            <div className={styles.circlePlaceholder}>
              <Camera size={22} className={styles.cameraIcon} />
            </div>
          )}

          {encrypted && (
            <span className={styles.lockBadge} aria-label="Encrypted">
              <Lock size={10} />
            </span>
          )}

          {hasImage && !disabled && (
            <button
              type="button"
              className={styles.circleRemove}
              onClick={remove}
              aria-label="Remove photo"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ) : (
        /* ── Rectangle drag-and-drop mode ── */
        <div
          className={clx(
            styles.dropzone,
            dragOver  && styles.dropzoneActive,
            hasImage  && styles.dropzoneHasImage,
            error     && styles.dropzoneError,
            disabled  && styles.dropzoneDisabled,
          )}
          onClick={openPicker}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker(); }}
          aria-label="Upload image"
        >
          {hasImage ? (
            <div className={styles.preview}>
              <img src={value} alt="Preview" className={styles.previewImg} />
              {encrypted && (
                <span className={styles.previewLock} aria-label="Encrypted">
                  <Lock size={12} />
                  Encrypted
                </span>
              )}
              {!disabled && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={remove}
                  aria-label="Remove image"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className={styles.dropzoneInner}>
              <UploadCloud size={28} className={styles.uploadIcon} />
              <p className={styles.dropzoneTitle}>
                {dragOver ? 'Drop to upload' : 'Click or drag to upload'}
              </p>
              <p className={styles.dropzoneHint}>
                {accept.replace(/image\//g, '').toUpperCase().replace(/,/g, ', ')}
                {' '}· max {formatBytes(maxBytes)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* File validation error */}
      {fileError && (
        <p className={styles.fileError}>
          <AlertCircle size={13} />
          {fileError}
        </p>
      )}
    </div>
  );
}

ImageUpload.propTypes = {
  /** Base-64 data URL of the current image, or null */
  value:     PropTypes.string,
  onChange:  PropTypes.func,
  /** Comma-separated MIME types */
  accept:    PropTypes.string,
  /** Maximum allowed file size in MB */
  maxSize:   PropTypes.number,
  /** Render as a circular avatar picker instead of a rectangle dropzone */
  circular:  PropTypes.bool,
  disabled:  PropTypes.bool,
  /** Applies error border styling */
  error:     PropTypes.bool,
  /** Shows a lock badge overlay on the preview */
  encrypted: PropTypes.bool,
};

ImageUpload.defaultProps = {
  value:     null,
  onChange:  null,
  accept:    DEFAULT_ACCEPT,
  maxSize:   DEFAULT_MAX_MB,
  circular:  false,
  disabled:  false,
  error:     false,
  encrypted: false,
};
