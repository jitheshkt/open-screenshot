/**
 * Background service worker.
 *
 * Owns all privileged capture operations and opens the editor with the result.
 * Three modes:
 *   - visible  : chrome.tabs.captureVisibleTab
 *   - fullpage : scroll the page in viewport steps, capture each, stitch on an
 *                OffscreenCanvas
 *   - selection: inject a drag-to-select overlay, then crop the visible capture
 *
 * The worker (not the popup) opens the editor, so the flow survives the popup
 * closing — essential for selection, where the user must click the page.
 */

import type { CaptureMode, CaptureResult, RuntimeMessage } from '@/lib/messages';

const EDITOR_PATH = 'src/editor/index.html';
const CAPTURE_RETRY_DELAY = 600; // ms; captureVisibleTab is rate-limited (~2/s)

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'CAPTURE') {
      runCapture(message.mode)
        .then(async (dataUrl) => {
          await openEditor(dataUrl);
          sendResponse({ ok: true } satisfies CaptureResult);
        })
        .catch((err) =>
          sendResponse({ ok: false, error: errMsg(err) } satisfies CaptureResult),
        );
      return true; // async response
    }
    return false;
  },
);

chrome.commands.onCommand.addListener((command) => {
  const mode: CaptureMode | null =
    command === 'capture-visible'
      ? 'visible'
      : command === 'capture-fullpage'
        ? 'fullpage'
        : command === 'capture-selection'
          ? 'selection'
          : null;
  if (!mode) return;
  runCapture(mode)
    .then(openEditor)
    .catch((err) => console.error('[open-screenshot] capture failed:', errMsg(err)));
});

// --- Dispatch ---------------------------------------------------------------

function runCapture(mode: CaptureMode): Promise<string> {
  switch (mode) {
    case 'visible':
      return captureVisible();
    case 'fullpage':
      return captureFullPage();
    case 'selection':
      return captureSelection();
    default:
      return Promise.reject(new Error(`Unknown capture mode: ${mode}`));
  }
}

// --- Visible ----------------------------------------------------------------

async function captureVisible(): Promise<string> {
  const tab = await activeTab();
  return captureWindow(tab.windowId);
}

// --- Full page --------------------------------------------------------------

async function captureFullPage(): Promise<string> {
  const tab = await activeTab();
  const tabId = tab.id!;

  const metrics = await runFunc(tabId, prepAndMeasure);
  const { fullHeight, viewW, viewH, dpr } = metrics;

  const canvas = new OffscreenCanvas(
    Math.round(viewW * dpr),
    Math.round(fullHeight * dpr),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');

  let requestedY = 0;
  let lastY = -1;
  try {
    while (requestedY < fullHeight) {
      const actualY = await runFunc(tabId, scrollToY, requestedY);
      await sleep(CAPTURE_RETRY_DELAY); // repaint + honor the rate limit
      const dataUrl = await captureWindow(tab.windowId);
      const bmp = await bitmapFromDataUrl(dataUrl);
      ctx.drawImage(bmp, 0, Math.round(actualY * dpr));
      bmp.close();

      if (actualY + viewH >= fullHeight) break; // reached the bottom
      if (actualY === lastY) break; // can't scroll further (e.g. fixed layout)
      lastY = actualY;
      requestedY += viewH;
    }
  } finally {
    await runFunc(tabId, restoreScroll, metrics.originalScrollY, metrics.originalBehavior);
  }

  return offscreenToDataUrl(canvas);
}

// --- Selection --------------------------------------------------------------

async function captureSelection(): Promise<string> {
  const tab = await activeTab();
  const tabId = tab.id!;

  const rect = await runFunc(tabId, pickRegion);
  if (!rect) throw new Error('Selection cancelled.');

  await sleep(150); // let the overlay removal repaint before capturing
  const dataUrl = await captureWindow(tab.windowId);
  const bmp = await bitmapFromDataUrl(dataUrl);

  const cw = Math.round(rect.w * rect.dpr);
  const ch = Math.round(rect.h * rect.dpr);
  const canvas = new OffscreenCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');
  ctx.drawImage(bmp, rect.x * rect.dpr, rect.y * rect.dpr, cw, ch, 0, 0, cw, ch);
  bmp.close();

  return offscreenToDataUrl(canvas);
}

// --- Injected page functions (must be self-contained) -----------------------

function prepAndMeasure(): {
  fullHeight: number;
  viewW: number;
  viewH: number;
  dpr: number;
  originalScrollY: number;
  originalBehavior: string;
} {
  const de = document.documentElement;
  const body = document.body;
  const fullHeight = Math.max(
    de.scrollHeight,
    body ? body.scrollHeight : 0,
    de.clientHeight,
  );
  const originalBehavior = de.style.scrollBehavior;
  de.style.scrollBehavior = 'auto';
  return {
    fullHeight,
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    originalScrollY: window.scrollY,
    originalBehavior,
  };
}

function scrollToY(y: number): number {
  window.scrollTo(0, y);
  return window.scrollY;
}

function restoreScroll(y: number, behavior: string): void {
  window.scrollTo(0, y);
  document.documentElement.style.scrollBehavior = behavior;
}

function pickRegion(): Promise<{
  x: number;
  y: number;
  w: number;
  h: number;
  dpr: number;
} | null> {
  return new Promise((resolve) => {
    const dpr = window.devicePixelRatio || 1;
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.25);';
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;border:2px solid #5b8cff;background:rgba(91,140,255,0.15);pointer-events:none;display:none;';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let sx = 0;
    let sy = 0;
    let drawing = false;

    const cleanup = (): void => {
      overlay.remove();
      window.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        resolve(null);
      }
    };
    window.addEventListener('keydown', onKey, true);

    overlay.addEventListener('mousedown', (e) => {
      drawing = true;
      sx = e.clientX;
      sy = e.clientY;
      Object.assign(box.style, {
        display: 'block',
        left: `${sx}px`,
        top: `${sy}px`,
        width: '0px',
        height: '0px',
      });
    });
    overlay.addEventListener('mousemove', (e) => {
      if (!drawing) return;
      Object.assign(box.style, {
        left: `${Math.min(sx, e.clientX)}px`,
        top: `${Math.min(sy, e.clientY)}px`,
        width: `${Math.abs(e.clientX - sx)}px`,
        height: `${Math.abs(e.clientY - sy)}px`,
      });
    });
    overlay.addEventListener('mouseup', (e) => {
      if (!drawing) return;
      drawing = false;
      const x = Math.min(sx, e.clientX);
      const y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx);
      const h = Math.abs(e.clientY - sy);
      cleanup();
      if (w < 4 || h < 4) resolve(null);
      else resolve({ x, y, w, h, dpr });
    });
  });
}

// --- Helpers ----------------------------------------------------------------

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId === undefined) {
    throw new Error('No active tab to capture.');
  }
  return tab;
}

/** captureVisibleTab with retries to ride out the rate limit. */
async function captureWindow(windowId: number): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch (err) {
      lastErr = err;
      await sleep(CAPTURE_RETRY_DELAY);
    }
  }
  throw new Error(`Capture failed: ${errMsg(lastErr)}`);
}

/**
 * Run a self-contained function in the page and return its result.
 * executeScript awaits a returned promise, so the result is Awaited<R>.
 */
async function runFunc<A extends unknown[], R>(
  tabId: number,
  func: (...args: A) => R,
  ...args: A
): Promise<Awaited<R>> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return injection?.result as Awaited<R>;
}

async function bitmapFromDataUrl(dataUrl: string): Promise<ImageBitmap> {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

async function offscreenToDataUrl(canvas: OffscreenCanvas): Promise<string> {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

async function openEditor(dataUrl: string): Promise<void> {
  await chrome.storage.session.set({ pendingCapture: dataUrl });
  await chrome.tabs.create({ url: chrome.runtime.getURL(EDITOR_PATH) });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export {};
