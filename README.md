# Open Screenshot

**A fast, open-source screenshot extension for Chrome — capture, beautify, annotate, done.**

![Manifest V3](https://img.shields.io/badge/Manifest-V3-5b8cff)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![No tracking](https://img.shields.io/badge/tracking-none-46d19e)
![License: MIT](https://img.shields.io/badge/license-MIT-black)

Capture the visible area, a full scrolling page, or a region you drag out — then
drop it onto a gradient background, add padding and a shadow, mark it up with
arrows, text, highlights and blur, and copy or download. All locally, in your
browser.

**[🌐 Website](https://jitheshkt.github.io/open-screenshot/)** · **[🔒 Privacy Policy](https://jitheshkt.github.io/open-screenshot/privacy.html)**

---

## Why this exists

The Chrome Web Store is full of screenshot extensions, and most of them share the
same problems: they're bloated, plastered with ads, gate basic features behind a
paywall or an account, or ask for alarming permissions and phone your captures
home.

A screenshot tool should do one thing well and get out of the way. **Open
Screenshot** is our answer:

- **No account, no tracking, no ads, no network calls.** Your screenshots never
  leave your machine.
- **Genuinely open source (MIT).** Read the code, audit the permissions, fork it.
- **Fast and minimal.** No bloated framework runtime — just the tool.

## Features

- 🖥️ **Visible area** — capture what's on screen
- 📜 **Full page** — scroll-and-stitch the entire page into one image
- ✂️ **Selection** — drag out any region to capture
- 🎨 **Background maker** — gradient (linear/radial, any angle) or solid, with a
  preset color palette, padding, corner radius, and shadow
- ✏️ **Annotate** — arrow, line, circle, text, highlight, and redact/blur; select,
  move, and delete
- 🖼️ **Export** — copy to clipboard or download as PNG; what you see on the canvas
  is exactly what you get
- 💾 **Remembers your style** — background, effects, and annotation settings
  persist across sessions
- 🔒 **Private by design** — everything runs locally

### Keyboard shortcuts

| Action        | Shortcut      |
| ------------- | ------------- |
| Visible area  | `Alt+Shift+V` |
| Full page     | `Alt+Shift+F` |
| Selection     | `Alt+Shift+S` |

Rebind them anytime at `chrome://extensions/shortcuts`.

## Tech stack

| Area          | Choice                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Platform      | Chrome extension, **Manifest V3**                                      |
| Language      | **TypeScript** (strict)                                                |
| Build         | **[Vite](https://vitejs.dev/)** + **[`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin)** (HMR + typed manifest) |
| UI            | Vanilla DOM + CSS — no framework runtime                               |
| Rendering     | `<canvas>` compositor; `OffscreenCanvas` in the service worker for full-page stitching and region cropping |
| Icons         | [Lucide](https://lucide.dev/)-style marks; brand icon rasterized from SVG via [`@resvg/resvg-js`](https://github.com/thx/resvg-js) |
| Storage       | `chrome.storage` (session for the pending capture, local for preferences) |

## Getting started

Requires Node 18+ (developed on Node 24).

```bash
npm install
npm run icons     # rasterize icons/icon.svg -> PNGs (re-run after editing the SVG)
npm run dev       # start Vite in watch mode
```

Load it into Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select the `dist/` folder
4. With `npm run dev` running, changes hot-reload automatically

Production build:

```bash
npm run build     # type-checks, then outputs to dist/
```

Other scripts: `npm run typecheck` (types only), `npm run icons` (regenerate icons).

## Project structure

```
manifest.config.ts        # MV3 manifest (typed, via @crxjs)
vite.config.ts
src/
  background/index.ts      # service worker — all capture ops + opens the editor
  popup/                   # the toolbar popup UI
  editor/
    main.ts                # bootstrap: image load, panels, export
    state.ts               # observable store (settings + annotations)
    render.ts              # the compositor engine — the canvas *is* the export
    annotations.ts         # pointer/keyboard interaction for the annotation layer
    prefs.ts               # persist style preferences to chrome.storage.local
    panels/                # General (background maker) + Annotate (tools) panels
  lib/messages.ts          # typed message contract between popup/worker
scripts/gen-icons.mjs      # rasterizes icon.svg -> PNGs via @resvg/resvg-js
icons/
  icon.svg                 # brand mark — single source of truth (edit this)
  icon-{16,32,48,128}.png  # generated; do not hand-edit
```

## How it works

```
popup / keyboard shortcut
        │  CAPTURE { mode }
        ▼
background service worker
   visible   → captureVisibleTab
   fullpage  → scroll + captureVisibleTab per step → stitch on OffscreenCanvas
   selection → inject drag overlay → captureVisibleTab → crop on OffscreenCanvas
        │  dataURL
        ▼
chrome.storage.session ("pendingCapture")
        │
        ▼
editor tab
   render.ts composites: background → image (padding/radius/shadow) → annotations
   → copy / download  (identical to the on-screen canvas)
```

Extending it:

- **New capture mode** → add to `CaptureMode` in `src/lib/messages.ts`, then handle
  it in `src/background/index.ts`.
- **New annotation tool** → add to `Tool` in `src/editor/state.ts`, draw it in
  `src/editor/render.ts`, and wire interaction in `src/editor/annotations.ts`.

## Permissions

We keep the permission set as small as the feature set allows — just three, with
**no broad host access**:

| Permission  | Why                                                                                     |
| ----------- | --------------------------------------------------------------------------------------- |
| `activeTab` | Temporary access to the current tab **only when you invoke the extension** (toolbar click or shortcut) — used to read the pixels and, for full-page/selection, to scroll and draw the selection overlay |
| `scripting` | Run the scroll/measure and selection-overlay logic in that active tab                    |
| `storage`   | Hold the pending capture and remember your preferences                                   |

Because there's no `host_permissions` and no always-on content script, Chrome
does **not** show the "read and change all your data on all websites" warning.
Nothing is sent anywhere — no analytics, no remote endpoints, no telemetry.

## Requesting a feature or reporting a bug

Feature requests and bug reports go through **GitHub Issues**:

👉 **[Open an issue](https://github.com/jitheshkt/open-screenshot/issues/new/choose)**

Please:

1. **Search [existing issues](https://github.com/jitheshkt/open-screenshot/issues) first** — if it's already there, add a 👍 or a comment instead of opening a duplicate.
2. **For a feature request**, describe *what* you want to do and *why* — the problem
   you're trying to solve, not just the solution. Screenshots or mockups help a lot.
3. **For a bug**, include: Chrome version, the page/URL type (or "any"), what you
   did, what you expected, and what happened. Console errors from the editor tab or
   the extension's service worker are gold.

We triage with labels like `enhancement`, `bug`, and `good first issue`. Upvotes on
issues genuinely help us prioritize.

## Roadmap

- [x] Editor engine — canvas compositor (the canvas *is* the export)
- [x] Gradient/solid background maker (linear/radial, angle, colors, swatches)
- [x] Effects — padding, corner radius, shadow
- [x] Annotation drawing — text, arrow, line, circle, highlight, redact/blur
- [x] Select / move / delete annotations
- [x] Full-page scroll-and-stitch capture
- [x] Drag-to-select region capture
- [x] Remember style preferences
- [ ] Resize handles for annotations
- [ ] Undo / redo
- [ ] Copy/download as JPEG/WebP with quality control
- [ ] Layout / Styles / Collage panels
- [ ] Options page (defaults, shortcuts, save location)

## Contributing

Contributions are welcome. A good PR:

- keeps the **permission set minimal** and the **UI fast**,
- passes `npm run build` (type-check + build) cleanly,
- and matches the surrounding code style.

For anything non-trivial, open an issue first so we can agree on the approach.

## License

[MIT](./LICENSE) © Open Screenshot contributors
