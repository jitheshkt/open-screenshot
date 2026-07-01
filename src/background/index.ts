/**
 * Background service worker.
 *
 * Owns all privileged capture operations. The popup and keyboard commands
 * send a CaptureRequest here; this worker performs the capture and returns a
 * CaptureResult, then opens the editor with the image.
 */

import type {
  CaptureRequest,
  CaptureResult,
  CaptureMode,
  RuntimeMessage,
} from '@/lib/messages';

const EDITOR_PATH = 'src/editor/index.html';

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'CAPTURE') {
      handleCapture(message)
        .then((result) => sendResponse(result))
        .catch((err) =>
          sendResponse({ ok: false, error: String(err?.message ?? err) }),
        );
      // Return true to keep the message channel open for the async response.
      return true;
    }
    return false;
  },
);

// Keyboard shortcuts declared in the manifest.
chrome.commands.onCommand.addListener(async (command) => {
  const mode: CaptureMode | null =
    command === 'capture-visible'
      ? 'visible'
      : command === 'capture-fullpage'
        ? 'fullpage'
        : null;
  if (!mode) return;
  const result = await handleCapture({ type: 'CAPTURE', mode });
  if (result.ok && result.dataUrl) await openEditor(result.dataUrl);
});

async function handleCapture(req: CaptureRequest): Promise<CaptureResult> {
  try {
    switch (req.mode) {
      case 'visible':
        return { ok: true, dataUrl: await captureVisible() };
      case 'fullpage':
        // TODO(features): stitch multiple viewport captures while scrolling.
        // For now fall back to a visible capture so the flow works end to end.
        return { ok: true, dataUrl: await captureVisible() };
      case 'selection':
        // TODO(features): let the content script draw a selection rect, then
        // crop the visible capture to those coordinates.
        return { ok: true, dataUrl: await captureVisible() };
      default:
        return { ok: false, error: `Unknown capture mode: ${req.mode}` };
    }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

/** Capture the currently visible area of the active tab as a PNG data URL. */
async function captureVisible(): Promise<string> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.windowId) throw new Error('No active tab to capture.');
  return chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
}

/** Open the editor page in a new tab and hand it the captured image. */
async function openEditor(dataUrl: string): Promise<void> {
  // Stash the image where the editor can read it once, then clear it.
  await chrome.storage.session.set({ pendingCapture: dataUrl });
  await chrome.tabs.create({ url: chrome.runtime.getURL(EDITOR_PATH) });
}

// Expose openEditor to the popup flow via message handling above is enough,
// but the popup opens the editor itself after receiving the data URL.

export {};
