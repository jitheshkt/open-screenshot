# Open Screenshot

An open-source, no-nonsense screenshot extension for Chrome. Built because the
existing options are bloated, ad-ridden, or want too many permissions.

> Status: **early scaffold.** Visible-area capture works end to end. Full-page
> and selection capture are stubbed and ready to be built out.

## Features

- 🖥️ **Visible area** — capture what's on screen (`Alt+Shift+V`)
- 📜 **Full page** — scroll-and-stitch capture (`Alt+Shift+F`) _(stubbed)_
- ✂️ **Selection** — drag a region to capture _(stubbed)_
- 🖼️ **Editor** — preview, copy to clipboard, and download as PNG
- 🔒 **No accounts, no tracking, no ads**

## Tech stack

- Manifest V3
- TypeScript + [Vite](https://vitejs.dev/)
- [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin) for HMR + manifest handling

## Getting started

```bash
npm install
npm run icons     # generate placeholder icons (one-time)
npm run dev       # start Vite in watch mode
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select the `dist/` folder
4. During `npm run dev`, changes hot-reload automatically

For a production bundle:

```bash
npm run build     # type-checks, then outputs to dist/
```

## Project structure

```
manifest.config.ts     # MV3 manifest (typed, via @crxjs)
vite.config.ts
src/
  background/index.ts   # service worker — owns all capture operations
  content/index.ts      # runs in the page — page metrics, selection UI (later)
  popup/                # the toolbar popup UI
  editor/               # preview + copy + download; annotation canvas (later)
  lib/messages.ts       # typed message contract between the above
scripts/gen-icons.mjs   # generates placeholder PNG icons
icons/                  # extension icons
```

## How it fits together

```
popup / keyboard command
        │  CAPTURE { mode }
        ▼
background service worker  ──► chrome.tabs.captureVisibleTab
        │  dataUrl
        ▼
chrome.storage.session ("pendingCapture")
        │
        ▼
editor tab  ──► preview · copy · download
```

New capture modes start in `src/lib/messages.ts` (add to `CaptureMode`), then
get a handler in `src/background/index.ts`.

## Roadmap

- [ ] Full-page scroll-and-stitch capture
- [ ] Drag-to-select region capture
- [ ] Annotation tools (pen, arrow, rectangle, text, blur/redact)
- [ ] Crop in editor
- [ ] Copy/download as JPEG/WebP with quality control
- [ ] Options page (default format, shortcuts, save location)

## Contributing

Issues and PRs welcome. Keep permissions minimal and the UI fast.

## License

[MIT](./LICENSE)
