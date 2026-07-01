/**
 * Annotation interaction controller.
 *
 * Attaches pointer/keyboard handlers to the canvas and turns gestures into
 * annotations in the store:
 *   - a drawing tool active  → drag to create a shape/line (click to place text)
 *   - the None tool active   → click to select, drag to move, Delete to remove
 *
 * Live drawing/moving is previewed by calling the renderer directly with an
 * override list; only the final result is committed to the store (one undo
 * step, and no per-frame panel churn).
 */

import {
  addAnnotation,
  getState,
  newId,
  patch,
  removeAnnotation,
  updateAnnotation,
} from './state';
import type { Annotation, BoxAnnotation } from './state';
import { annotationBounds, renderScene } from './render';

type GetImage = () => HTMLImageElement | null;

const MIN_SIZE = 4; // canvas px; smaller gestures are treated as a click

export function initAnnotations(
  canvas: HTMLCanvasElement,
  getImage: GetImage,
): void {
  let draft: Annotation | null = null;
  let moving: { id: string; startX: number; startY: number; orig: Annotation } | null =
    null;

  const previewWith = (anns: Annotation[], selectedId: string | null): void => {
    renderScene(canvas, getState(), getImage(), { annotations: anns, selectedId });
  };

  // --- coordinate mapping ---------------------------------------------------
  const toCanvas = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };

  // --- pointer down ---------------------------------------------------------
  canvas.addEventListener('pointerdown', (e) => {
    if (!getImage()) return;
    const { tool, annColor, strokeWidth } = getState();
    const p = toCanvas(e);

    if (tool === 'text') {
      openTextEditor(canvas, p.x, p.y);
      return;
    }

    if (tool === 'none') {
      const hit = hitTest(p.x, p.y);
      patch({ selectedId: hit?.id ?? null });
      if (hit) {
        moving = { id: hit.id, startX: p.x, startY: p.y, orig: hit };
        canvas.setPointerCapture(e.pointerId);
      }
      return;
    }

    // A drawing tool: start a draft.
    if (tool === 'line' || tool === 'arrow') {
      draft = {
        id: newId(),
        type: tool,
        color: annColor,
        strokeWidth,
        x1: p.x,
        y1: p.y,
        x2: p.x,
        y2: p.y,
      };
    } else {
      draft = {
        id: newId(),
        type: tool,
        color: annColor,
        strokeWidth,
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
      };
    }
    canvas.setPointerCapture(e.pointerId);
  });

  // --- pointer move ---------------------------------------------------------
  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);

    if (draft) {
      if (draft.type === 'line' || draft.type === 'arrow') {
        draft = { ...draft, x2: p.x, y2: p.y };
      } else {
        const b = draft as BoxAnnotation;
        draft = { ...b, w: p.x - b.x, h: p.y - b.y };
      }
      previewWith([...getState().annotations, draft], null);
      return;
    }

    if (moving) {
      const dx = p.x - moving.startX;
      const dy = p.y - moving.startY;
      const moved = translate(moving.orig, dx, dy);
      const others = getState().annotations.map((a) =>
        a.id === moved.id ? moved : a,
      );
      previewWith(others, moved.id);
    }
  });

  // --- pointer up -----------------------------------------------------------
  const finish = (): void => {
    if (draft) {
      const b = annotationBounds(draft);
      if (b.w >= MIN_SIZE || b.h >= MIN_SIZE) addAnnotation(draft);
      else renderScene(canvas, getState(), getImage()); // discard tiny gesture
      draft = null;
    }
    if (moving) {
      // Cancelled mid-move: drop the move and restore committed state.
      moving = null;
      renderScene(canvas, getState(), getImage());
    }
  };

  canvas.addEventListener('pointerup', (e) => {
    if (moving) {
      const p = toCanvas(e);
      const dx = p.x - moving.startX;
      const dy = p.y - moving.startY;
      const moved = translate(moving.orig, dx, dy);
      updateAnnotation(moved.id, moved);
      moving = null;
      return;
    }
    finish();
  });

  canvas.addEventListener('pointercancel', finish);

  // --- keyboard -------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    const { selectedId } = getState();
    if (selectedId) {
      e.preventDefault();
      removeAnnotation(selectedId);
    }
  });
}

// --- helpers ----------------------------------------------------------------

function hitTest(x: number, y: number): Annotation | undefined {
  const { annotations } = getState();
  // Topmost first.
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    const b = annotationBounds(a);
    const pad = 'strokeWidth' in a ? a.strokeWidth + 6 : 6;
    if (
      x >= b.x - pad &&
      x <= b.x + b.w + pad &&
      y >= b.y - pad &&
      y <= b.y + b.h + pad
    ) {
      return a;
    }
  }
  return undefined;
}

function translate(a: Annotation, dx: number, dy: number): Annotation {
  switch (a.type) {
    case 'line':
    case 'arrow':
      return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
    default:
      return { ...a, x: a.x + dx, y: a.y + dy };
  }
}

// --- inline text editor -----------------------------------------------------

function openTextEditor(
  canvas: HTMLCanvasElement,
  canvasX: number,
  canvasY: number,
): void {
  const { annColor, fontSize } = getState();
  const r = canvas.getBoundingClientRect();
  const scale = r.width / canvas.width;

  const ta = document.createElement('textarea');
  ta.className = 'text-editor';
  ta.rows = 1;
  Object.assign(ta.style, {
    position: 'fixed',
    left: `${r.left + canvasX * scale}px`,
    top: `${r.top + canvasY * scale}px`,
    fontSize: `${fontSize * scale}px`,
    color: annColor,
  });
  document.body.appendChild(ta);
  requestAnimationFrame(() => ta.focus());

  let done = false;
  const commit = (save: boolean): void => {
    if (done) return;
    done = true;
    const text = ta.value.replace(/\s+$/, '');
    ta.remove();
    if (save && text) {
      addAnnotation({
        id: newId(),
        type: 'text',
        color: annColor,
        x: canvasX,
        y: canvasY,
        text,
        fontSize,
      });
    }
  };

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commit(false);
    }
  });
  ta.addEventListener('blur', () => commit(true));
}
