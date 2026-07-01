/**
 * Editor bootstrap.
 *
 * Loads the captured (or uploaded) image, builds the left rail and panels,
 * keeps the canvas in sync with the store, and handles export.
 */

import { getState, patch, subscribe, reset } from './state';
import { renderScene, toPngBlob } from './render';
import { initAnnotations } from './annotations';
import { loadPrefs, savePrefs, clearPrefs } from './prefs';
import { createGeneralPanel } from './panels/general';
import { createAnnotatePanel } from './panels/annotate';
import type { Panel } from './panels/general';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const empty = document.getElementById('empty') as HTMLElement;
const panelEl = document.getElementById('panel') as HTMLElement;
const fileInput = document.getElementById('file') as HTMLInputElement;

let image: HTMLImageElement | null = null;

// --- Panels -----------------------------------------------------------------
// All option groups live in one scrolling list — no section tabs.

const panels: Panel[] = [createGeneralPanel(), createAnnotatePanel()];

function mountPanels(): void {
  for (const panel of panels) {
    panelEl.appendChild(panel.el);
    panel.sync();
  }
}

// --- Image loading ----------------------------------------------------------

function loadImage(src: string): void {
  const img = new Image();
  img.onload = () => {
    image = img;
    empty.hidden = true;
    canvas.hidden = false;
    render();
  };
  img.onerror = () => showEmpty();
  img.src = src;
}

function showEmpty(): void {
  image = null;
  canvas.hidden = true;
  empty.hidden = false;
}

async function loadPendingCapture(): Promise<void> {
  // Outside the extension (e.g. `vite preview`) chrome.storage is absent;
  // fall back to the empty state so Upload Image still works.
  if (!globalThis.chrome?.storage?.session) {
    showEmpty();
    return;
  }
  const { pendingCapture } = await chrome.storage.session.get('pendingCapture');
  if (typeof pendingCapture === 'string' && pendingCapture) {
    await chrome.storage.session.remove('pendingCapture');
    loadImage(pendingCapture);
  } else {
    showEmpty();
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadImage(url);
});

// --- Render loop ------------------------------------------------------------

function render(): void {
  renderScene(canvas, getState(), image);
}

// Re-render on any state change, keep panels in sync, persist style prefs, and
// reflect the tool in the canvas cursor.
subscribe(() => {
  render();
  for (const panel of panels) panel.sync();
  savePrefs();
  canvas.style.cursor =
    getState().tool === 'none' ? 'default' : 'crosshair';
});

// --- Export -----------------------------------------------------------------

function exportName(): string {
  const custom = (
    document.getElementById('filename') as HTMLInputElement
  ).value.trim();
  const base = custom || defaultName();
  return base.endsWith('.png') ? base : `${base}.png`;
}

function defaultName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `open-screenshot-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Render without the selection outline, export, then restore the view. */
async function exportBlob(): Promise<Blob> {
  renderScene(canvas, getState(), image, { selectedId: null });
  const blob = await toPngBlob(canvas);
  render(); // restore selection outline / normal view
  return blob;
}

async function download(): Promise<void> {
  if (!image) return;
  const blob = await exportBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy(btn: HTMLButtonElement): Promise<void> {
  if (!image) return;
  const label = btn.querySelector('span')!;
  try {
    const blob = await exportBlob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    label.textContent = 'Copied!';
  } catch {
    label.textContent = 'Copy failed';
  }
  setTimeout(() => (label.textContent = 'Copy'), 1500);
}

// --- Wire up ----------------------------------------------------------------

const openFilePicker = () => fileInput.click();
document.getElementById('upload')!.addEventListener('click', openFilePicker);
document.getElementById('empty-upload')!.addEventListener('click', openFilePicker);
document.getElementById('download')!.addEventListener('click', () => void download());
document
  .getElementById('copy')!
  .addEventListener('click', (e) => void copy(e.currentTarget as HTMLButtonElement));
document.getElementById('reset')!.addEventListener('click', () => {
  reset();
  clearPrefs();
});

async function init(): Promise<void> {
  // Restore saved style preferences before the panels first render.
  const saved = await loadPrefs();
  if (Object.keys(saved).length > 0) patch(saved);

  mountPanels();
  initAnnotations(canvas, () => image);
  await loadPendingCapture();
}

void init();
