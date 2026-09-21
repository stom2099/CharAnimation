import type { WaveShape } from './types';

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Bends a sine wave without breaking its period.
 *
 * `ease > 1` makes the motion linger near the extremes of travel;
 * `ease < 1` makes it linger near the centre. `ease === 1` is a plain sine.
 */
export function shapeWave(s: number, ease: number): number {
  if (ease === 1) return s;
  const magnitude = Math.abs(s) ** ease;
  return s < 0 ? -magnitude : magnitude;
}

/**
 * Evaluates one wave at loop phase `theta` (radians, 0..TAU over one loop).
 *
 * Both shapes have a period that divides TAU for every integer `freq`, which is
 * what guarantees a seamless loop:
 *  - `sine`   repeats every TAU / freq
 *  - `bounce` uses |sin(freq * theta / 2)|, period TAU / freq as well
 */
export function wave(
  shape: WaveShape,
  freq: number,
  theta: number,
  phaseTurns: number,
  ease: number,
): number {
  const phase = phaseTurns * TAU;
  if (shape === 'bounce') {
    const rectified = Math.abs(Math.sin((freq * theta) / 2 + phase / 2));
    return 2 * rectified ** ease - 1;
  }
  return shapeWave(Math.sin(freq * theta + phase), ease);
}

/** Rotates (x, y) around (cx, cy). `cos`/`sin` are passed in so callers can hoist them. */
export function rotateAround(
  x: number,
  y: number,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
  out: { x: number; y: number },
): void {
  const dx = x - cx;
  const dy = y - cy;
  out.x = cx + dx * cos - dy * sin;
  out.y = cy + dx * sin + dy * cos;
}

/**
 * Distance from the pivot row, normalised so the farthest row weighs exactly 1.
 * Keeps slider values literal: "10°" really means 10° at the far end.
 */
export function pivotWeight(v: number, pv: number, falloff: number): number {
  const span = Math.max(pv, 1 - pv);
  if (span <= 1e-6) return 0;
  const d = Math.abs(v - pv) / span;
  return falloff === 1 ? d : d ** falloff;
}
