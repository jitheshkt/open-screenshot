/**
 * Popup entry point. Wires the capture buttons to the background worker and
 * opens the editor with the resulting screenshot.
 */

import { sendMessage } from '@/lib/messages';
import type { CaptureMode, CaptureResult } from '@/lib/messages';

const statusEl = document.getElementById('status') as HTMLSpanElement;
const buttons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('.action'),
);

function setStatus(text: string, isError = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('status--error', isError);
}

function setBusy(busy: boolean): void {
  buttons.forEach((b) => (b.disabled = busy));
}

async function capture(mode: CaptureMode): Promise<void> {
  setBusy(true);
  setStatus('Capturing…');
  try {
    const result = await sendMessage<CaptureResult>({ type: 'CAPTURE', mode });
    if (!result.ok || !result.dataUrl) {
      throw new Error(result.error ?? 'Capture failed');
    }
    // Hand the image to the editor via session storage, then open it.
    await chrome.storage.session.set({ pendingCapture: result.dataUrl });
    await chrome.tabs.create({
      url: chrome.runtime.getURL('src/editor/index.html'),
    });
    window.close();
  } catch (err) {
    setStatus(String((err as Error)?.message ?? err), true);
  } finally {
    setBusy(false);
  }
}

buttons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as CaptureMode | undefined;
    if (mode) void capture(mode);
  });
});
