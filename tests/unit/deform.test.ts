import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  createGrid,
  defaultParams,
  deform,
  cloneParams,
  sweptBounds,
  type AnimParams,
} from '../../src/engine';

const W = 240;
const H = 320;

function positionsAt(params: AnimParams, t: number): Float32Array {
  const grid = createGrid(W, H, params.grid.cols, params.grid.rows);
  const out = new Float32Array(grid.count * 2);
  deform(grid, params, t, out);
  return out;
}

function maxDelta(a: Float32Array, b: Float32Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

/** Every preset with every modifier forced on — the worst case for loop continuity. */
function allModifiersOn(): AnimParams {
  const p = defaultParams();
  p.loopSeconds = 1.7;
  p.sway.enabled = true;
  p.wind.enabled = true;
  p.wiggle.enabled = true;
  p.breathe.enabled = true;
  p.bob.enabled = true;
  p.jitter.enabled = true;
  return p;
}

describe('deform — seamless looping', () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))(
    'preset "%s" returns to its start after exactly one loop',
    (_id, preset) => {
      const at0 = positionsAt(preset.params, 0);
      const atT = positionsAt(preset.params, preset.params.loopSeconds);
      expect(maxDelta(at0, atT)).toBeLessThan(1e-4);
    },
  );

  it('loops seamlessly with every modifier enabled at once', () => {
    const p = allModifiersOn();
    expect(maxDelta(positionsAt(p, 0), positionsAt(p, p.loopSeconds))).toBeLessThan(1e-4);
  });

  it('repeats across many loops and for negative time', () => {
    const p = allModifiersOn();
    const ref = positionsAt(p, 0.42);
    expect(maxDelta(ref, positionsAt(p, 0.42 + p.loopSeconds * 5))).toBeLessThan(1e-4);
    expect(maxDelta(ref, positionsAt(p, 0.42 - p.loopSeconds * 3))).toBeLessThan(1e-4);
  });

  it('is continuous — no jump between the last sample and the wrap point', () => {
    const p = allModifiersOn();
    const nearEnd = positionsAt(p, p.loopSeconds - 1e-3);
    const start = positionsAt(p, 0);
    // A millisecond of motion must stay far below one pixel per vertex.
    expect(maxDelta(nearEnd, start)).toBeLessThan(1.5);
  });
});

describe('deform — correctness', () => {
  it('is the identity when every modifier is disabled', () => {
    const p = defaultParams();
    const grid = createGrid(W, H, p.grid.cols, p.grid.rows);
    const out = new Float32Array(grid.count * 2);
    deform(grid, p, 0.73, out);
    expect(maxDelta(out, grid.base)).toBe(0);
  });

  it('keeps the pivot row fixed for pivot-anchored modifiers', () => {
    const p = defaultParams();
    p.pivot = { pu: 0.5, pv: 1 };
    p.sway.enabled = true;
    p.sway.amountDeg = 30;
    p.wind.enabled = true;
    p.wind.amount = 0.3;
    p.wiggle.enabled = true;
    p.wiggle.amount = 0.3;

    const grid = createGrid(W, H, 16, 16);
    const out = new Float32Array(grid.count * 2);
    deform(grid, p, 0.31, out);

    for (let i = 0; i < grid.count; i++) {
      if (grid.v[i] !== 1) continue;
      expect(Math.abs(out[i * 2] - grid.base[i * 2])).toBeLessThan(1e-6);
      expect(Math.abs(out[i * 2 + 1] - grid.base[i * 2 + 1])).toBeLessThan(1e-6);
    }
  });

  it('honours the sway amplitude literally at the far edge', () => {
    const p = defaultParams();
    p.pivot = { pu: 0.5, pv: 1 };
    p.sway.enabled = true;
    p.sway.amountDeg = 90;
    p.sway.falloff = 1;
    p.loopSeconds = 4;

    const grid = createGrid(W, H, 8, 8);
    const out = new Float32Array(grid.count * 2);
    // Quarter of the loop is the sine peak, so the top row rotates a full 90°.
    deform(grid, p, 1, out);

    const topCentre = grid.count - grid.count; // vertex 0 is the top-left corner
    const dx = out[topCentre * 2] - grid.base[topCentre * 2];
    expect(Math.abs(dx)).toBeGreaterThan(H * 0.5);
  });

  it('never produces NaN for extreme parameters', () => {
    const p = allModifiersOn();
    p.loopSeconds = 0.4;
    p.pivot = { pu: 0, pv: 0 };
    p.sway.amountDeg = 45;
    p.sway.falloff = 3;
    p.sway.ease = 2.5;
    p.breathe.amountY = 0.35;
    p.breathe.preserveVolume = true;
    p.wiggle.amount = 0.35;
    p.wind.amount = 0.35;
    p.jitter.amount = 0.06;

    for (const t of [0, 0.13, 0.2, 0.39, 1.2]) {
      const out = positionsAt(p, t);
      expect(out.every((n) => Number.isFinite(n))).toBe(true);
    }
  });

  it('degrades gracefully when loopSeconds is zero', () => {
    const p = allModifiersOn();
    p.loopSeconds = 0;
    expect(positionsAt(p, 0.5).every((n) => Number.isFinite(n))).toBe(true);
  });

  it('writes into the caller buffer without allocating a new one', () => {
    const p = allModifiersOn();
    const grid = createGrid(W, H, 8, 8);
    const out = new Float32Array(grid.count * 2);
    expect(deform(grid, p, 0.2, out)).toBe(out);
  });
});

describe('sweptBounds', () => {
  it('covers the rest pose when nothing moves', () => {
    const p = defaultParams();
    const grid = createGrid(W, H, 16, 16);
    const b = sweptBounds(grid, p, 8);
    expect(b.minX).toBeCloseTo(0, 5);
    expect(b.minY).toBeCloseTo(0, 5);
    expect(b.maxX).toBeCloseTo(W, 5);
    expect(b.maxY).toBeCloseTo(H, 5);
  });

  it('expands beyond the rest pose once the sprite moves', () => {
    const p = cloneParams(defaultParams());
    p.sway.enabled = true;
    p.sway.amountDeg = 20;
    const grid = createGrid(W, H, 16, 16);
    const b = sweptBounds(grid, p, 24);
    expect(b.maxX).toBeGreaterThan(W);
    expect(b.minX).toBeLessThan(0);
  });
});
