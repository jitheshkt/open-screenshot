/**
 * The rendering engine.
 *
 * `renderScene` composites the whole document onto a canvas at the image's
 * true pixel size (plus padding). The same function drives the on-screen
 * preview and the exported PNG, so what you see is exactly what you get.
 *
 * Draw order: background → shadow → padded image (rounded) → annotations.
 */

import type { Annotation, BoxAnnotation, EditorState, LineAnnotation, TextAnnotation } from './state';

export interface RenderOpts {
  /** Override the committed annotations (used for live drawing/moving). */
  annotations?: Annotation[];
  /** Draw a selection outline around this annotation. */
  selectedId?: string | null;
}

export function renderScene(
  canvas: HTMLCanvasElement,
  state: EditorState,
  image: HTMLImageElement | null,
  opts: RenderOpts = {},
): void {
  const iw = image?.naturalWidth ?? 800;
  const ih = image?.naturalHeight ?? 500;
  const pad = state.padding;

  const w = iw + pad * 2;
  const h = ih + pad * 2;

  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  paintBackground(ctx, state, w, h);
  if (image) drawImage(ctx, state, image, pad, iw, ih);

  const anns = opts.annotations ?? state.annotations;
  const selectedId =
    opts.selectedId !== undefined ? opts.selectedId : state.selectedId;
  for (const a of anns) drawAnnotation(ctx, a, image, state);
  if (selectedId) {
    const sel = anns.find((a) => a.id === selectedId);
    if (sel) drawSelection(ctx, sel);
  }
}

// --- Background -------------------------------------------------------------

function paintBackground(
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  w: number,
  h: number,
): void {
  if (state.background === 'solid') {
    ctx.fillStyle = state.colorStart;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  let grad: CanvasGradient;
  if (state.gradientStyle === 'radial') {
    const r = Math.hypot(w, h) / 2;
    grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
  } else {
    const { x0, y0, x1, y1 } = angleToLine(state.angle, w, h);
    grad = ctx.createLinearGradient(x0, y0, x1, y1);
  }
  grad.addColorStop(0, state.colorStart);
  grad.addColorStop(1, state.colorEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function angleToLine(
  angle: number,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2;
  const cy = h / 2;
  return {
    x0: cx - (dx * len) / 2,
    y0: cy - (dy * len) / 2,
    x1: cx + (dx * len) / 2,
    y1: cy + (dy * len) / 2,
  };
}

// --- Image ------------------------------------------------------------------

function drawImage(
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  image: HTMLImageElement,
  pad: number,
  iw: number,
  ih: number,
): void {
  const radius = Math.min(state.radius, iw / 2, ih / 2);

  if (state.shadow > 0) {
    ctx.save();
    const strength = state.shadow / 100;
    ctx.shadowColor = `rgba(0, 0, 0, ${0.45 * strength})`;
    ctx.shadowBlur = 60 * strength;
    ctx.shadowOffsetY = 24 * strength;
    roundRect(ctx, pad, pad, iw, ih, radius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundRect(ctx, pad, pad, iw, ih, radius);
  ctx.clip();
  ctx.drawImage(image, pad, pad, iw, ih);
  ctx.restore();
}

// --- Annotations ------------------------------------------------------------

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  image: HTMLImageElement | null,
  state: EditorState,
): void {
  switch (a.type) {
    case 'arrow':
    case 'line':
      drawLine(ctx, a);
      break;
    case 'circle':
      drawCircle(ctx, a);
      break;
    case 'highlight':
      drawHighlight(ctx, a);
      break;
    case 'redact':
      drawRedact(ctx, a, image, state);
      break;
    case 'text':
      drawText(ctx, a);
      break;
  }
}

function drawLine(ctx: CanvasRenderingContext2D, a: LineAnnotation): void {
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.lineWidth = a.strokeWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x1, a.y1);
  ctx.lineTo(a.x2, a.y2);
  ctx.stroke();

  if (a.type === 'arrow') {
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const head = Math.max(12, a.strokeWidth * 3.5);
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(
      a.x2 - head * Math.cos(angle - Math.PI / 7),
      a.y2 - head * Math.sin(angle - Math.PI / 7),
    );
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(
      a.x2 - head * Math.cos(angle + Math.PI / 7),
      a.y2 - head * Math.sin(angle + Math.PI / 7),
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, a: BoxAnnotation): void {
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.lineWidth = a.strokeWidth;
  ctx.beginPath();
  ctx.ellipse(
    a.x + a.w / 2,
    a.y + a.h / 2,
    Math.abs(a.w / 2),
    Math.abs(a.h / 2),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function drawHighlight(ctx: CanvasRenderingContext2D, a: BoxAnnotation): void {
  const { x, y, w, h } = normRect(a);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = a.color;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawRedact(
  ctx: CanvasRenderingContext2D,
  a: BoxAnnotation,
  image: HTMLImageElement | null,
  state: EditorState,
): void {
  const { x, y, w, h } = normRect(a);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (image) {
    // Blur the underlying image, clipped to the rect → pixels are obscured.
    const pad = state.padding;
    ctx.filter = 'blur(10px)';
    ctx.drawImage(image, pad, pad, image.naturalWidth, image.naturalHeight);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, a: TextAnnotation): void {
  ctx.save();
  ctx.fillStyle = a.color;
  ctx.font = `600 ${a.fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'top';
  const lineHeight = a.fontSize * 1.25;
  a.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, a.x, a.y + i * lineHeight);
  });
  ctx.restore();
}

// --- Selection outline ------------------------------------------------------

function drawSelection(ctx: CanvasRenderingContext2D, a: Annotation): void {
  const b = annotationBounds(a);
  ctx.save();
  ctx.strokeStyle = '#5b8cff';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  ctx.restore();
}

// --- Geometry helpers -------------------------------------------------------

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function normRect(a: BoxAnnotation): Bounds {
  return {
    x: a.w < 0 ? a.x + a.w : a.x,
    y: a.h < 0 ? a.y + a.h : a.y,
    w: Math.abs(a.w),
    h: Math.abs(a.h),
  };
}

/** Axis-aligned bounds for any annotation (used for hit-testing + selection). */
export function annotationBounds(a: Annotation): Bounds {
  switch (a.type) {
    case 'line':
    case 'arrow':
      return {
        x: Math.min(a.x1, a.x2),
        y: Math.min(a.y1, a.y2),
        w: Math.abs(a.x2 - a.x1),
        h: Math.abs(a.y2 - a.y1),
      };
    case 'text': {
      // Approximate: width ~ chars * 0.6 * fontSize, height ~ lines.
      const lines = a.text.split('\n');
      const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
      return {
        x: a.x,
        y: a.y,
        w: longest * a.fontSize * 0.6,
        h: lines.length * a.fontSize * 1.25,
      };
    }
    default:
      return normRect(a);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Render the current scene to a PNG blob for copy/download. */
export function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
      'image/png',
    );
  });
}
