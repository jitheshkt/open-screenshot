import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Open Screenshot',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Open Screenshot',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  // activeTab grants temporary access to the current tab when the user invokes
  // the extension (toolbar click or a keyboard command) — enough for
  // captureVisibleTab and scripting.executeScript, with no broad-host warning.
  permissions: ['activeTab', 'scripting', 'storage'],
  commands: {
    'capture-visible': {
      suggested_key: {
        default: 'Alt+Shift+V',
        mac: 'Alt+Shift+V',
      },
      description: 'Capture the visible part of the page',
    },
    'capture-fullpage': {
      suggested_key: {
        default: 'Alt+Shift+F',
        mac: 'Alt+Shift+F',
      },
      description: 'Capture the full scrolling page',
    },
    'capture-selection': {
      suggested_key: {
        default: 'Alt+Shift+S',
        mac: 'Alt+Shift+S',
      },
      description: 'Capture a selected region',
    },
  },
});
