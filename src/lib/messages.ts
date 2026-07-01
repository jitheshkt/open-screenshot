/**
 * Typed message contract between the popup and the background service worker.
 * Add new capture modes here first, then implement a handler in the worker.
 */

export type CaptureMode = 'visible' | 'fullpage' | 'selection';

export interface CaptureRequest {
  type: 'CAPTURE';
  mode: CaptureMode;
}

export interface CaptureResult {
  ok: boolean;
  error?: string;
}

export type RuntimeMessage = CaptureRequest;

/** Promise-based wrapper around chrome.runtime.sendMessage. */
export function sendMessage<T = unknown>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}
