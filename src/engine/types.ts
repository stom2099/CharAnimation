/**
 * Pure animation engine types.
 *
 * Every modifier is built from waves whose frequency is an *integer* number of
 * cycles per loop. That guarantees f(0) === f(T) exactly, so every exported
 * animation loops seamlessly without any post-processing.
 */

/** Cycles per loop. Integers only — this is what makes the loop seamless. */
export type Freq = 1 | 2 | 3 | 4 | 6 | 8;

export const FREQS: readonly Freq[] = [1, 2, 3, 4, 6, 8];

/** `sine` is smooth; `bounce` rectifies the wave for an impact-like motion. */
export type WaveShape = 'sine' | 'bounce';

/** Normalised anchor point inside the image: (0,0) top-left, (1,1) bottom-right. */
export interface Pivot {
  pu: number;
  pv: number;
}

export interface ModifierBase {
  enabled: boolean;
  freq: Freq;
  /** Phase offset in turns (0..1); 0.25 = a quarter cycle. */
  phase: number;
}

/** Rotation around the pivot, ramped by distance from the pivot row. */
export interface SwayMod extends ModifierBase {
  amountDeg: number;
  falloff: number;
  ease: number;
  shape: WaveShape;
}

/** A travelling wave along the vertical axis — grass/cloth in the wind. */
export interface WindMod extends ModifierBase {
  amount: number;
  wavelength: number;
  falloff: number;
}

/** Two out-of-phase waves keyed on u and v — a soft noodly wobble. */
export interface WiggleMod extends ModifierBase {
  amount: number;
  scaleU: number;
  scaleV: number;
  falloff: number;
}

/** Non-uniform scale around the pivot — breathing, squash and stretch. */
export interface BreatheMod extends ModifierBase {
  amountX: number;
  amountY: number;
  preserveVolume: boolean;
  ease: number;
  shape: WaveShape;
}

/** Rigid translation of the whole sprite. */
export interface BobMod extends ModifierBase {
  amountX: number;
  amountY: number;
  shape: WaveShape;
  ease: number;
}

/** High-frequency shake, uncorrelated per axis. */
export interface JitterMod extends ModifierBase {
  amount: number;
}

export interface Modifiers {
  sway: SwayMod;
  wind: WindMod;
  wiggle: WiggleMod;
  breathe: BreatheMod;
  bob: BobMod;
  jitter: JitterMod;
}

export type ModifierKey = keyof Modifiers;

export const MODIFIER_KEYS: readonly ModifierKey[] = [
  'sway',
  'wind',
  'wiggle',
  'breathe',
  'bob',
  'jitter',
];

export interface AnimParams extends Modifiers {
  /** Loop duration in seconds. */
  loopSeconds: number;
  pivot: Pivot;
  grid: { cols: number; rows: number };
}

export type PresetId =
  | 'sway'
  | 'bob'
  | 'breathe'
  | 'float'
  | 'wind'
  | 'wiggle'
  | 'bounce'
  | 'pendulum'
  | 'custom';

export interface Preset {
  id: PresetId;
  /** i18n key, resolved by the UI. */
  nameKey: string;
  descKey: string;
  params: AnimParams;
}

/** Pre-computed, immutable geometry for one cutout. */
export interface Grid {
  cols: number;
  rows: number;
  /** Number of vertices = (cols + 1) * (rows + 1). */
  count: number;
  /** Normalised vertex coordinates, one entry per vertex. */
  u: Float32Array;
  v: Float32Array;
  /** Rest positions in pixels, interleaved x,y. */
  base: Float32Array;
  /** Triangle indices (6 per cell). */
  indices: Uint32Array;
  width: number;
  height: number;
}

export const LIMITS = {
  loopSeconds: { min: 0.4, max: 8, step: 0.1 },
  grid: { min: 8, max: 64, step: 4 },
  swayDeg: { min: 0, max: 45, step: 0.5 },
  falloff: { min: 0.4, max: 3, step: 0.1 },
  ease: { min: 0.4, max: 2.5, step: 0.05 },
  fraction: { min: 0, max: 0.35, step: 0.005 },
  smallFraction: { min: 0, max: 0.06, step: 0.001 },
  wavelength: { min: 0.25, max: 4, step: 0.05 },
  scale: { min: 0, max: 24, step: 0.5 },
  phase: { min: 0, max: 1, step: 0.01 },
} as const;
