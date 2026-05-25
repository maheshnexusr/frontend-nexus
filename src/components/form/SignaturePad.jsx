/**
 * SignaturePad — lightweight canvas-based signature capture.
 *
 *   <SignaturePad
 *     value={signatureDataUrl}
 *     onChange={(dataUrl) => …}
 *     disabled={false}
 *   />
 *
 * Stores the signature as a base64 PNG data URL on the parent. Includes
 * Clear and Undo controls. Touch- and mouse-friendly; redraws on resize so
 * the captured image always matches the canvas's CSS dimensions.
 */

import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Eraser, Undo2 } from 'lucide-react';
import s from './SignaturePad.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

export default function SignaturePad({ value, onChange, disabled, height }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  // Stack of completed strokes — each stroke is an array of {x, y} points in
  // canvas-local logical coordinates. Used for Undo without losing the rest.
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef([]);
  const [hasInk, setHasInk] = useState(Boolean(value));

  // Match the canvas's backing-store size to its CSS box × devicePixelRatio
  // so lines stay crisp on HiDPI displays. Redraws every stroke at the new
  // resolution after a resize.
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width  * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    redrawAll();
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value reset — when the parent clears the signature, wipe ours too.
  useEffect(() => {
    if (!value) {
      strokesRef.current = [];
      currentStrokeRef.current = [];
      setHasInk(false);
      redrawAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = strokesRef.current.length ? canvas.toDataURL('image/png') : '';
    onChange?.(dataUrl);
  };

  const localPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    return { x, y };
  };

  const handleDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    const pt = localPoint(e);
    currentStrokeRef.current = [pt];
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handleMove = (e) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const pt = localPoint(e);
    currentStrokeRef.current.push(pt);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handleUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentStrokeRef.current.length > 1) {
      strokesRef.current.push(currentStrokeRef.current);
      setHasInk(true);
      emit();
    }
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    redrawAll();
    setHasInk(false);
    onChange?.('');
  };

  const handleUndo = () => {
    if (!strokesRef.current.length) return;
    strokesRef.current.pop();
    redrawAll();
    const next = strokesRef.current.length > 0;
    setHasInk(next);
    if (!next) onChange?.('');
    else emit();
  };

  return (
    <div className={clx(s.wrap, disabled && s.disabled)}>
      <canvas
        ref={canvasRef}
        className={s.canvas}
        style={{ height: `${height}px` }}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
      />
      {!hasInk && !disabled && (
        <span className={s.placeholder}>Sign here</span>
      )}
      <div className={s.actions}>
        <button type="button" className={s.actionBtn} onClick={handleUndo} disabled={!hasInk || disabled}>
          <Undo2 size={12} /> Undo
        </button>
        <button type="button" className={s.actionBtn} onClick={handleClear} disabled={!hasInk || disabled}>
          <Eraser size={12} /> Clear
        </button>
      </div>
    </div>
  );
}

SignaturePad.propTypes = {
  value:    PropTypes.string,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  height:   PropTypes.number,
};

SignaturePad.defaultProps = {
  value:    '',
  onChange: null,
  disabled: false,
  height:   140,
};
