/**
 * General panel — the background maker.
 *
 * Background (gradient/solid) · Style (linear/radial) · Angle · Colors
 * (start/end + preset swatches) · Effects (padding, corner radius, shadow).
 *
 * Returns the element plus a `sync()` that reflects external state changes
 * (e.g. a swatch updating a color) back into the controls.
 */

import { getState, patch, SWATCHES } from '../state';
import type { ColorSlot } from '../state';

export interface Panel {
  el: HTMLElement;
  sync: () => void;
}

export function createGeneralPanel(): Panel {
  const el = document.createElement('div');
  el.className = 'panel-body';
  el.innerHTML = `
    <section class="group">
      <h2 class="group__title">Background</h2>
      <div class="segmented" data-seg="background">
        <button data-val="gradient">Gradient</button>
        <button data-val="solid">Solid</button>
      </div>
    </section>

    <section class="group" data-only="gradient">
      <h2 class="group__title">Style</h2>
      <div class="segmented" data-seg="gradientStyle">
        <button data-val="linear">Linear</button>
        <button data-val="radial">Radial</button>
      </div>
      <div class="field" data-only="linear">
        <div class="field__head">
          <span>Angle</span><output data-out="angle"></output>
        </div>
        <input type="range" min="0" max="360" step="1" data-range="angle" />
      </div>
    </section>

    <section class="group">
      <h2 class="group__title">Colors</h2>
      <div class="slots">
        <label class="slot" data-slot="start">
          <input type="color" data-color="start" />
          <span class="slot__meta">
            <span class="slot__name">Start</span>
            <span class="slot__hex" data-hex="start"></span>
          </span>
        </label>
        <label class="slot" data-slot="end" data-only="gradient">
          <input type="color" data-color="end" />
          <span class="slot__meta">
            <span class="slot__name">End</span>
            <span class="slot__hex" data-hex="end"></span>
          </span>
        </label>
      </div>
      <div class="swatches" data-swatches></div>
    </section>

    <section class="group">
      <h2 class="group__title">Effects</h2>
      <div class="field">
        <div class="field__head"><span>Padding</span><output data-out="padding"></output></div>
        <input type="range" min="0" max="256" step="1" data-range="padding" />
      </div>
      <div class="field">
        <div class="field__head"><span>Corner radius</span><output data-out="radius"></output></div>
        <input type="range" min="0" max="64" step="1" data-range="radius" />
      </div>
      <div class="field">
        <div class="field__head"><span>Shadow</span><output data-out="shadow"></output></div>
        <input type="range" min="0" max="100" step="1" data-range="shadow" />
      </div>
    </section>
  `;

  // Build swatch grid.
  const swatchWrap = el.querySelector<HTMLDivElement>('[data-swatches]')!;
  for (const hex of SWATCHES) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hex;
    b.dataset.swatch = hex;
    b.title = hex;
    swatchWrap.appendChild(b);
  }

  // --- Wiring ---------------------------------------------------------------

  // Segmented toggles (background type, gradient style).
  el.querySelectorAll<HTMLDivElement>('[data-seg]').forEach((seg) => {
    const key = seg.dataset.seg as 'background' | 'gradientStyle';
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.addEventListener('click', () =>
        patch({ [key]: btn.dataset.val } as never),
      );
    });
  });

  // Sliders.
  el.querySelectorAll<HTMLInputElement>('[data-range]').forEach((range) => {
    const key = range.dataset.range as 'angle' | 'padding' | 'radius' | 'shadow';
    range.addEventListener('input', () =>
      patch({ [key]: Number(range.value) } as never),
    );
  });

  // Color inputs.
  el.querySelectorAll<HTMLInputElement>('[data-color]').forEach((input) => {
    const slot = input.dataset.color as ColorSlot;
    input.addEventListener('input', () =>
      patch(
        slot === 'start'
          ? { colorStart: input.value, activeSlot: 'start' }
          : { colorEnd: input.value, activeSlot: 'end' },
      ),
    );
  });

  // Selecting a slot makes it the active target for swatches.
  el.querySelectorAll<HTMLLabelElement>('[data-slot]').forEach((label) => {
    label.addEventListener('click', () =>
      patch({ activeSlot: label.dataset.slot as ColorSlot }),
    );
  });

  // Swatches apply to the active slot.
  swatchWrap.querySelectorAll<HTMLButtonElement>('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hex = btn.dataset.swatch!;
      const { activeSlot } = getState();
      patch(activeSlot === 'end' ? { colorEnd: hex } : { colorStart: hex });
    });
  });

  // --- Reflect state back into the controls ---------------------------------

  function sync(): void {
    const s = getState();

    el.querySelectorAll<HTMLDivElement>('[data-seg]').forEach((seg) => {
      const key = seg.dataset.seg as 'background' | 'gradientStyle';
      seg.querySelectorAll<HTMLButtonElement>('button').forEach((btn) =>
        btn.classList.toggle('is-active', btn.dataset.val === s[key]),
      );
    });

    setRange(el, 'angle', s.angle, `${s.angle}°`);
    setRange(el, 'padding', s.padding, `${s.padding}px`);
    setRange(el, 'radius', s.radius, `${s.radius}px`);
    setRange(el, 'shadow', s.shadow, `${s.shadow}`);

    setColor(el, 'start', s.colorStart);
    setColor(el, 'end', s.colorEnd);

    el.querySelectorAll<HTMLLabelElement>('[data-slot]').forEach((label) =>
      label.classList.toggle('is-active', label.dataset.slot === s.activeSlot),
    );

    // Show/hide gradient-only and linear-only bits.
    el.querySelectorAll<HTMLElement>('[data-only="gradient"]').forEach(
      (n) => (n.hidden = s.background !== 'gradient'),
    );
    el.querySelectorAll<HTMLElement>('[data-only="linear"]').forEach(
      (n) => (n.hidden = s.background !== 'gradient' || s.gradientStyle !== 'linear'),
    );
  }

  return { el, sync };
}

function setRange(
  root: HTMLElement,
  key: string,
  value: number,
  label: string,
): void {
  const range = root.querySelector<HTMLInputElement>(`[data-range="${key}"]`);
  if (range && range.value !== String(value)) range.value = String(value);
  const out = root.querySelector<HTMLOutputElement>(`[data-out="${key}"]`);
  if (out) out.textContent = label;
}

function setColor(root: HTMLElement, slot: string, hex: string): void {
  const input = root.querySelector<HTMLInputElement>(`[data-color="${slot}"]`);
  if (input && input.value.toLowerCase() !== hex.toLowerCase()) input.value = hex;
  const out = root.querySelector<HTMLSpanElement>(`[data-hex="${slot}"]`);
  if (out) out.textContent = hex.toUpperCase();
}
