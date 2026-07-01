/**
 * Popup entry point. Sends a capture request to the background worker, which
 * performs the capture and opens the editor with the result.
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
  // Selection needs the user to interact with the page, which closes the popup.
  // Fire the request and let the background worker drive the rest.
  if (mode === 'selection') {
    void sendMessage<CaptureResult>({ type: 'CAPTURE', mode });
    window.close();
    return;
  }

  setBusy(true);
  setStatus('Capturing…');
  try {
    const result = await sendMessage<CaptureResult>({ type: 'CAPTURE', mode });
    if (!result.ok) throw new Error(result.error ?? 'Capture failed');
    window.close(); // background already opened the editor
  } catch (err) {
    setStatus(String((err as Error)?.message ?? err), true);
    setBusy(false);
  }
}

buttons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as CaptureMode | undefined;
    if (mode) void capture(mode);
  });
});
