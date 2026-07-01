/**
 * Editor entry point.
 *
 * Reads the pending capture from session storage, shows it, and offers copy /
 * download. This is the baseline; annotation and crop tools will be layered on
 * top of a <canvas> here later.
 */

const preview = document.getElementById('preview') as HTMLImageElement;
const empty = document.getElementById('empty') as HTMLParagraphElement;
const downloadBtn = document.getElementById('download') as HTMLButtonElement;
const copyBtn = document.getElementById('copy') as HTMLButtonElement;

let currentDataUrl: string | null = null;

async function init(): Promise<void> {
  const { pendingCapture } = await chrome.storage.session.get('pendingCapture');
  if (typeof pendingCapture === 'string' && pendingCapture.length > 0) {
    currentDataUrl = pendingCapture;
    preview.src = pendingCapture;
    preview.hidden = false;
    empty.hidden = true;
    // One-shot: clear it so a refresh doesn't resurrect a stale capture.
    await chrome.storage.session.remove('pendingCapture');
  } else {
    preview.hidden = true;
    empty.hidden = false;
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
  }
}

function timestampName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `open-screenshot-${stamp}.png`;
}

downloadBtn.addEventListener('click', () => {
  if (!currentDataUrl) return;
  chrome.downloads.download({
    url: currentDataUrl,
    filename: timestampName(),
    saveAs: true,
  });
});

copyBtn.addEventListener('click', async () => {
  if (!currentDataUrl) return;
  try {
    const blob = await (await fetch(currentDataUrl)).blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
  } catch (err) {
    copyBtn.textContent = 'Copy failed';
    console.error(err);
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
  }
});

void init();
