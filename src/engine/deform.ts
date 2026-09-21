import type { AnimParams, Grid } from './types';
import { TAU, degToRad, pivotWeight, rotateAround, wave } from './math';

const scratch = { x: 0, y: 0 };

/**
 * Writes the deformed vertex positions for loop time `t` into `out`.
 *
 * Pure and allocation-free: preview and export call this with the same inputs
 * and get byte-identical geometry, which is what keeps WYSIWYG honest.
 *
 * @param g    lattice built by `createGrid`
 * @param p    animation parameters
 * @param t    time in seconds; only `t mod loopSeconds` matters
 * @param out  Float32Array of length `g.count * 2`, interleaved x,y
 */
export function deform(g: Grid, p: AnimParams, t: number, out: Float32Array): Float32Array {
  const T = p.loopSeconds > 0 ? p.loopSeconds : 1;
  const theta = (TAU * (((t % T) + T) % T)) / T;

  const { pu, pv } = p.pivot;
  const px = pu * g.width;
  const py = pv * g.height;

  const { sway, wind, wiggle, breathe, bob, jitter } = p;

  // Hoist every per-frame constant out of the vertex loop.
  const swayAngle = sway.enabled
    ? degToRad(sway.amountDeg) * wave(sway.shape, sway.freq, theta, sway.phase, sway.ease)
    : 0;

  const windPhase = wind.enabled ? wind.freq * theta + wind.phase * TAU : 0;
  const windAmp = wind.enabled ? wind.amount * g.width : 0;

  const wigglePhaseA = wiggle.enabled ? wiggle.freq * theta + wiggle.phase * TAU : 0;
  const wigglePhaseB = wiggle.enabled ? wiggle.freq * 2 * theta + wiggle.phase * TAU : 0;
  const wiggleAmp = wiggle.enabled ? wiggle.amount * g.width * 0.5 : 0;

  let scaleX = 1;
  let scaleY = 1;
  if (breathe.enabled) {
    const s = wave(breathe.shape, breathe.freq, theta, breathe.phase, breathe.ease);
    scaleY = 1 + breathe.amountY * s;
    if (scaleY < 0.05) scaleY = 0.05;
    scaleX = breathe.preserveVolume ? 1 / scaleY : 1 + breathe.amountX * s;
    if (scaleX < 0.05) scaleX = 0.05;
  }

  let bobX = 0;
  let bobY = 0;
  if (bob.enabled) {
    bobX = bob.amountX * g.width * wave(bob.shape, bob.freq, theta, bob.phase + 0.25, bob.ease);
    bobY = bob.amountY * g.height * wave(bob.shape, bob.freq, theta, bob.phase, bob.ease);
  }

  const jitterPhase = jitter.enabled ? jitter.freq * theta + jitter.phase * TAU : 0;
  const jitterAmpX = jitter.enabled ? jitter.amount * g.width : 0;
  const jitterAmpY = jitter.enabled ? jitter.amount * g.height : 0;

  const { u, v, base, count } = g;

  for (let i = 0; i < count; i++) {
    const uu = u[i];
    const vv = v[i];
    let x = base[i * 2];
    let y = base[i * 2 + 1];

    if (sway.enabled && swayAngle !== 0) {
      const angle = swayAngle * pivotWeight(vv, pv, sway.falloff);
      if (angle !== 0) {
        rotateAround(x, y, px, py, Math.cos(angle), Math.sin(angle), scratch);
        x = scratch.x;
        y = scratch.y;
      }
    }

    if (wind.enabled) {
      const w = pivotWeight(vv, pv, wind.falloff);
      x += windAmp * w * Math.sin(windPhase - vv * wind.wavelength * TAU);
    }

    if (wiggle.enabled) {
      const w = pivotWeight(vv, pv, wiggle.falloff);
      x +=
        wiggleAmp *
        w *
        (Math.sin(wigglePhaseA + uu * wiggle.scaleU) + Math.sin(wigglePhaseB + vv * wiggle.scaleV));
    }

    if (breathe.enabled) {
      x = px + (x - px) * scaleX;
      y = py + (y - py) * scaleY;
    }

    if (bob.enabled) {
      x += bobX;
      y += bobY;
    }

    if (jitter.enabled) {
      x += jitterAmpX * Math.sin(jitterPhase + uu * 13.37);
      y += jitterAmpY * Math.sin(jitterPhase + vv * 17.11 + 1.7);
    }

    out[i * 2] = x;
    out[i * 2 + 1] = y;
  }

  return out;
}

/**
 * Axis-aligned bounds swept by the deformation across a whole loop.
 * Used to auto-fit the viewport and to size exports so nothing is clipped.
 */
export function sweptBounds(
  g: Grid,
  p: AnimParams,
  samples = 24,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const out = new Float32Array(g.count * 2);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let s = 0; s < samples; s++) {
    deform(g, p, (s / samples) * p.loopSeconds, out);
    for (let i = 0; i < g.count; i++) {
      const x = out[i * 2];
      const y = out[i * 2 + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return { minX, minY, maxX, maxY };
}
