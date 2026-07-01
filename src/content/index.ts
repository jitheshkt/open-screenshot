/**
 * Content script.
 *
 * Runs in the page context. Currently only reports page metrics, which the
 * full-page capture flow will need for scroll-and-stitch. Selection-mode UI
 * (drawing a crop rectangle over the page) will also live here.
 */

import type { GetPageMetricsRequest, PageMetrics } from '@/lib/messages';

chrome.runtime.onMessage.addListener(
  (message: GetPageMetricsRequest, _sender, sendResponse) => {
    if (message.type === 'GET_PAGE_METRICS') {
      sendResponse(getPageMetrics());
      return true;
    }
    return false;
  },
);

function getPageMetrics(): PageMetrics {
  const doc = document.documentElement;
  const body = document.body;
  return {
    fullWidth: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0),
    fullHeight: Math.max(doc.scrollHeight, body?.scrollHeight ?? 0),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

export {};
