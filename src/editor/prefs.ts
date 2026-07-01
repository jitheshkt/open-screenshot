/**
 * Preference persistence.
 *
 * Saves the *style* portion of the editor state to chrome.storage.local so the
 * next capture opens with the same look. The image, annotations, current tool,
 * and selection are intentionally NOT persisted — those belong to a single
 * editing session.
 */

import { getState } from './state';
import type { EditorState } from './state';

const KEY = 'editorPrefs';

const PERSIST_KEYS = [
  'background',
  'gradientStyle',
  'angle',
  'colorStart',
  'colorEnd',
  'activeSlot',
  'padding',
  'radius',
  'shadow',
  'annColor',
  'strokeWidth',
  'fontSize',
] as const satisfies readonly (keyof EditorState)[];

type PersistedPrefs = Partial<Pick<EditorState, (typeof PERSIST_KEYS)[number]>>;

function hasStorage(): boolean {
  return Boolean(globalThis.chrome?.storage?.local);
}

/** Read saved preferences (empty object when unavailable or unset). */
export async function loadPrefs(): Promise<PersistedPrefs> {
  if (!hasStorage()) return {};
  const res = await chrome.storage.local.get(KEY);
  const saved = res[KEY];
  return saved && typeof saved === 'object' ? (saved as PersistedPrefs) : {};
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Persist the current style prefs, debounced so slider drags don't spam. */
export function savePrefs(): void {
  if (!hasStorage()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const s = getState();
    const subset: PersistedPrefs = {};
    for (const k of PERSIST_KEYS) (subset as Record<string, unknown>)[k] = s[k];
    void chrome.storage.local.set({ [KEY]: subset });
  }, 250);
}

/** Forget saved preferences (used by Reset all). */
export function clearPrefs(): void {
  if (!hasStorage()) return;
  void chrome.storage.local.remove(KEY);
}
