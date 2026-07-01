/**
 * Editor state — a tiny observable store shared by every panel and the
 * renderer. Panels write to it via `patch()`; the canvas and panels subscribe
 * and re-render on change. No framework, no magic.
 */

export type BackgroundType = 'gradient' | 'solid';
export type GradientStyle = 'linear' | 'radial';
export type ColorSlot = 'start' | 'end';
export type Tool =
  | 'none'
  | 'text'
  | 'arrow'
  | 'line'
  | 'circle'
  | 'highlight'
  | 'redact';

/** Annotations live in canvas-pixel coordinates (the full padded document). */
interface AnnotationBase {
  id: string;
  color: string;
}
export interface BoxAnnotation extends AnnotationBase {
  type: 'circle' | 'highlight' | 'redact';
  x: number;
  y: number;
  w: number;
  h: number;
  strokeWidth: number;
}
export interface LineAnnotation extends AnnotationBase {
  type: 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}
export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
}
export type Annotation = BoxAnnotation | LineAnnotation | TextAnnotation;

export interface EditorState {
  background: BackgroundType;
  gradientStyle: GradientStyle;
  angle: number; // degrees, CSS semantics (0 = to top, 90 = to right)
  colorStart: string; // hex
  colorEnd: string; // hex
  activeSlot: ColorSlot; // which color the swatches apply to
  padding: number; // px around the image
  radius: number; // px corner radius on the image
  shadow: number; // 0–100 shadow strength
  tool: Tool;
  // Annotation layer
  annotations: Annotation[];
  selectedId: string | null;
  annColor: string; // color for new annotations
  strokeWidth: number; // for shapes/lines
  fontSize: number; // for text
}

export const DEFAULT_STATE: EditorState = {
  background: 'gradient',
  gradientStyle: 'linear',
  angle: 135,
  colorStart: '#FFBF00',
  colorEnd: '#06B6D4',
  activeSlot: 'start',
  padding: 64,
  radius: 12,
  shadow: 45,
  tool: 'none',
  annotations: [],
  selectedId: null,
  annColor: '#EF4444',
  strokeWidth: 4,
  fontSize: 28,
};

/** Preset swatch palette (mirrors the look we're after). */
export const SWATCHES: string[] = [
  '#FFBF00', '#F59E0B', '#F97316', '#EF4444', '#EC4899', '#22D3EE', '#3B82F6', '#6366F1',
  '#10B981', '#22C55E', '#64748B', '#8B5CF6', '#111827', '#1F2937', '#F3F4F6', '#FFFFFF',
];

type Listener = (state: EditorState) => void;

let state: EditorState = { ...DEFAULT_STATE };
const listeners = new Set<Listener>();

export function getState(): EditorState {
  return state;
}

export function patch(next: Partial<EditorState>): void {
  state = { ...state, ...next };
  for (const fn of listeners) fn(state);
}

export function reset(): void {
  patch({ ...DEFAULT_STATE });
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- Annotation helpers -----------------------------------------------------

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `a${listeners.size}-${Date.now()}`;
}

export function addAnnotation(a: Annotation): void {
  patch({ annotations: [...state.annotations, a], selectedId: a.id });
}

export function updateAnnotation(id: string, changes: Partial<Annotation>): void {
  patch({
    annotations: state.annotations.map((a) =>
      a.id === id ? ({ ...a, ...changes } as Annotation) : a,
    ),
  });
}

export function removeAnnotation(id: string): void {
  patch({
    annotations: state.annotations.filter((a) => a.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
  });
}

export function selectedAnnotation(): Annotation | undefined {
  return state.annotations.find((a) => a.id === state.selectedId);
}
