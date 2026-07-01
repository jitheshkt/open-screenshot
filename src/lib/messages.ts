/**
 * Typed message contract shared between popup, content script, and the
 * background service worker. Add new capture modes here first, then implement
 * a handler in the background worker.
 */

export type CaptureMode = 'visible' | 'fullpage' | 'selection';

export interface CaptureRequest {
  type: 'CAPTURE';
  mode: CaptureMode;
}

export interface CaptureResult {
  ok: boolean;
  /** Data URL of the resulting PNG, present when ok === true. */
  dataUrl?: string;
  error?: string;
}

/** Sent from background -> content script to measure the full page size. */
export interface GetPageMetricsRequest {
  type: 'GET_PAGE_METRICS';
}

export interface PageMetrics {
  fullWidth: number;
  fullHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export type RuntimeMessage = CaptureRequest | GetPageMetricsRequest;

/** Promise-based wrapper around chrome.runtime.sendMessage. */
export function sendMessage<T = unknown>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

/** Promise-based wrapper around chrome.tabs.sendMessage. */
export function sendTabMessage<T = unknown>(
  tabId: number,
  message: RuntimeMessage,
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message);
}
