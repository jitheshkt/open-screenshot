/**
 * Annotate panel — tool selector + style controls.
 *
 * Tool grid picks the active tool. The style group (color, size) applies to
 * newly drawn annotations and, when one is selected, edits it live. Drawing
 * itself is handled by the interaction controller in ../annotations.ts.
 */

import {
  getState,
  patch,
  removeAnnotation,
  selectedAnnotation,
  SWATCHES,
  updateAnnotation,
} from '../state';
import type { Tool } from '../state';
import type { Panel } from './general';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'text', label: 'Text' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'line', label: 'Line' },
  { id: 'circle', label: 'Circle' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'redact', label: 'Redact / Blur' },
];

export function createAnnotatePanel(): Panel {
  const el = document.createElement('div');
  el.className = 'panel-body';
  el.innerHTML = `
    <section class="group">
      <h2 class="group__title">Tool</h2>
      <div class="tool-grid" data-tools></div>
      <p class="hint" data-hint></p>
    </section>

    <section class="group">
      <h2 class="group__title">Annotation style</h2>
      <label class="slot is-active" data-anncolor>
        <input type="color" data-color="ann" />
        <span class="slot__meta">
          <span class="slot__name">Color</span>
          <span class="slot__hex" data-hex="ann"></span>
        </span>
      </label>
      <div class="swatches" data-swatches></div>
      <div class="field">
        <div class="field__head"><span data-size-label>Size</span><output data-out="size"></output></div>
        <input type="range" data-range="size" />
      </div>
      <button class="btn btn--ghost" data-delete disabled type="button">Delete selected</button>
    </section>
  `;

  // Tool grid.
  const grid = el.querySelector<HTMLDivElement>('[data-tools]')!;
  for (const tool of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.dataset.tool = tool.id;
    btn.textContent = tool.label;
    btn.addEventListener('click', () => patch({ tool: tool.id }));
    grid.appendChild(btn);
  }

  // Swatches (reuse the shared palette).
  const swatchWrap = el.querySelector<HTMLDivElement>('[data-swatches]')!;
  for (const hex of SWATCHES) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.dataset.swatch = hex;
    b.title = hex;
    b.addEventListener('click', () => applyColor(hex));
    swatchWrap.appendChild(b);
  }

  // Color input.
  el.querySelector<HTMLInputElement>('[data-color="ann"]')!.addEventListener(
    'input',
    (e) => applyColor((e.target as HTMLInputElement).value),
  );

  // Size slider.
  const size = el.querySelector<HTMLInputElement>('[data-range="size"]')!;
  size.addEventListener('input', () => applySize(Number(size.value)));

  // Delete.
  el.querySelector<HTMLButtonElement>('[data-delete]')!.addEventListener(
    'click',
    () => {
      const { selectedId } = getState();
      if (selectedId) removeAnnotation(selectedId);
    },
  );

  // --- helpers --------------------------------------------------------------

  function applyColor(hex: string): void {
    const sel = selectedAnnotation();
    patch({ annColor: hex });
    if (sel) updateAnnotation(sel.id, { color: hex });
  }

  function sizeIsText(): boolean {
    const sel = selectedAnnotation();
    return sel ? sel.type === 'text' : getState().tool === 'text';
  }

  function applySize(value: number): void {
    const sel = selectedAnnotation();
    if (sizeIsText()) {
      patch({ fontSize: value });
      if (sel && sel.type === 'text') updateAnnotation(sel.id, { fontSize: value });
    } else {
      patch({ strokeWidth: value });
      if (sel && 'strokeWidth' in sel) updateAnnotation(sel.id, { strokeWidth: value });
    }
  }

  // --- sync -----------------------------------------------------------------

  function sync(): void {
    const s = getState();
    const sel = selectedAnnotation();

    grid.querySelectorAll<HTMLButtonElement>('.tool').forEach((btn) =>
      btn.classList.toggle('is-active', btn.dataset.tool === s.tool),
    );

    const hint = el.querySelector<HTMLParagraphElement>('[data-hint]')!;
    hint.textContent =
      s.tool === 'none'
        ? 'Click an annotation to select it, drag to move, press Delete to remove.'
        : s.tool === 'text'
          ? 'Click on the image to place text, then type. Enter to confirm, Esc to cancel.'
          : 'Drag on the image to draw. Switch to None to move or delete.';

    // Color chip + hex reflect the selection if any, else the new-annotation color.
    const color = sel?.color ?? s.annColor;
    const colorInput = el.querySelector<HTMLInputElement>('[data-color="ann"]')!;
    if (colorInput.value.toLowerCase() !== color.toLowerCase())
      colorInput.value = color;
    el.querySelector<HTMLSpanElement>('[data-hex="ann"]')!.textContent =
      color.toUpperCase();

    // Size control adapts to text vs. shape context.
    const text = sizeIsText();
    const value =
      sel && sel.type === 'text'
        ? sel.fontSize
        : sel && 'strokeWidth' in sel
          ? sel.strokeWidth
          : text
            ? s.fontSize
            : s.strokeWidth;
    size.min = text ? '12' : '1';
    size.max = text ? '96' : '24';
    if (size.value !== String(value)) size.value = String(value);
    el.querySelector<HTMLSpanElement>('[data-size-label]')!.textContent = text
      ? 'Font size'
      : 'Stroke width';
    el.querySelector<HTMLOutputElement>('[data-out="size"]')!.textContent = `${value}px`;

    const del = el.querySelector<HTMLButtonElement>('[data-delete]')!;
    del.disabled = !sel;
  }

  return { el, sync };
}
