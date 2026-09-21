import type { AnimParams, Modifiers, Preset, PresetId } from './types';

function baseModifiers(): Modifiers {
  return {
    sway: {
      enabled: false,
      freq: 1,
      phase: 0,
      amountDeg: 6,
      falloff: 1.6,
      ease: 1,
      shape: 'sine',
    },
    wind: { enabled: false, freq: 2, phase: 0, amount: 0.03, wavelength: 1.2, falloff: 1.4 },
    wiggle: { enabled: false, freq: 2, phase: 0, amount: 0.02, scaleU: 6, scaleV: 9, falloff: 1.2 },
    breathe: {
      enabled: false,
      freq: 1,
      phase: 0,
      amountX: 0.01,
      amountY: 0.025,
      preserveVolume: true,
      ease: 1,
      shape: 'sine',
    },
    bob: {
      enabled: false,
      freq: 1,
      phase: 0,
      amountX: 0,
      amountY: 0.03,
      shape: 'sine',
      ease: 1,
    },
    jitter: { enabled: false, freq: 8, phase: 0, amount: 0.002 },
  };
}

/** A neutral, valid parameter set. Every preset is built by patching this. */
export function defaultParams(): AnimParams {
  return {
    loopSeconds: 2,
    pivot: { pu: 0.5, pv: 1 },
    grid: { cols: 32, rows: 32 },
    ...baseModifiers(),
  };
}

function make(
  id: PresetId,
  patch: (p: AnimParams) => void,
): Preset {
  const params = defaultParams();
  patch(params);
  return { id, nameKey: `preset.${id}.name`, descKey: `preset.${id}.desc`, params };
}

export const PRESETS: readonly Preset[] = [
  make('sway', (p) => {
    p.loopSeconds = 2.4;
    p.sway.enabled = true;
    p.sway.amountDeg = 5.5;
    p.sway.falloff = 1.6;
    p.sway.ease = 1;
    p.breathe.enabled = true;
    p.breathe.amountY = 0.012;
    p.breathe.freq = 1;
  }),

  make('bob', (p) => {
    p.loopSeconds = 1.8;
    p.pivot = { pu: 0.5, pv: 1 };
    p.bob.enabled = true;
    p.bob.amountY = -0.03;
    p.bob.freq = 1;
    p.breathe.enabled = true;
    p.breathe.amountY = 0.018;
    p.breathe.freq = 1;
    p.breathe.phase = 0.5;
  }),

  make('breathe', (p) => {
    p.loopSeconds = 3.2;
    p.breathe.enabled = true;
    p.breathe.amountY = 0.03;
    p.breathe.amountX = 0.014;
    p.breathe.preserveVolume = true;
    p.breathe.ease = 1.2;
    p.bob.enabled = true;
    p.bob.amountY = -0.008;
  }),

  make('float', (p) => {
    p.loopSeconds = 3.6;
    p.pivot = { pu: 0.5, pv: 0.5 };
    p.bob.enabled = true;
    p.bob.amountY = -0.035;
    p.bob.amountX = 0.012;
    p.bob.freq = 1;
    p.sway.enabled = true;
    p.sway.amountDeg = 2.5;
    p.sway.falloff = 1;
    p.sway.phase = 0.25;
  }),

  make('wind', (p) => {
    p.loopSeconds = 2.2;
    p.wind.enabled = true;
    p.wind.amount = 0.035;
    p.wind.wavelength = 1.1;
    p.wind.falloff = 1.5;
    p.wind.freq = 2;
    p.sway.enabled = true;
    p.sway.amountDeg = 3.5;
    p.sway.falloff = 1.7;
    p.sway.freq = 1;
  }),

  make('wiggle', (p) => {
    p.loopSeconds = 1.6;
    p.wiggle.enabled = true;
    p.wiggle.amount = 0.024;
    p.wiggle.freq = 2;
    p.wiggle.scaleU = 5;
    p.wiggle.scaleV = 9;
    p.wiggle.falloff = 1.1;
  }),

  make('bounce', (p) => {
    p.loopSeconds = 1.2;
    p.breathe.enabled = true;
    p.breathe.shape = 'bounce';
    p.breathe.amountY = -0.09;
    p.breathe.preserveVolume = true;
    p.breathe.ease = 1.4;
    p.breathe.freq = 1;
    p.bob.enabled = true;
    p.bob.shape = 'bounce';
    p.bob.amountY = -0.07;
    p.bob.ease = 1.6;
    p.bob.freq = 1;
    p.bob.phase = 0.5;
  }),

  make('pendulum', (p) => {
    p.loopSeconds = 2.6;
    p.pivot = { pu: 0.5, pv: 0 };
    p.sway.enabled = true;
    p.sway.amountDeg = 11;
    p.sway.falloff = 1.05;
    p.sway.ease = 1.25;
    p.sway.freq = 1;
  }),
];

export const PRESET_IDS: readonly PresetId[] = PRESETS.map((p) => p.id);

export function getPreset(id: PresetId): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Deep clone that stays JSON-safe — used when applying a preset or loading a project. */
export function cloneParams(params: AnimParams): AnimParams {
  return {
    loopSeconds: params.loopSeconds,
    pivot: { ...params.pivot },
    grid: { ...params.grid },
    sway: { ...params.sway },
    wind: { ...params.wind },
    wiggle: { ...params.wiggle },
    breathe: { ...params.breathe },
    bob: { ...params.bob },
    jitter: { ...params.jitter },
  };
}

/** Repairs a parameter object coming from storage or an imported file. */
export function normaliseParams(input: unknown): AnimParams {
  const fallback = defaultParams();
  if (!input || typeof input !== 'object') return fallback;
  const raw = input as Partial<AnimParams>;
  const out = cloneParams(fallback);

  if (Number.isFinite(raw.loopSeconds)) {
    out.loopSeconds = Math.min(8, Math.max(0.4, raw.loopSeconds as number));
  }
  if (raw.pivot && Number.isFinite(raw.pivot.pu) && Number.isFinite(raw.pivot.pv)) {
    out.pivot = {
      pu: Math.min(1, Math.max(0, raw.pivot.pu)),
      pv: Math.min(1, Math.max(0, raw.pivot.pv)),
    };
  }
  if (raw.grid && Number.isFinite(raw.grid.cols) && Number.isFinite(raw.grid.rows)) {
    out.grid = {
      cols: Math.min(64, Math.max(8, Math.round(raw.grid.cols))),
      rows: Math.min(64, Math.max(8, Math.round(raw.grid.rows))),
    };
  }

  for (const key of ['sway', 'wind', 'wiggle', 'breathe', 'bob', 'jitter'] as const) {
    const src = raw[key];
    if (!src || typeof src !== 'object') continue;
    const target = out[key] as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(src)) {
      if (!(field in target)) continue;
      const current = target[field];
      if (typeof current === 'number' && Number.isFinite(value)) target[field] = value;
      else if (typeof current === 'boolean' && typeof value === 'boolean') target[field] = value;
      else if (typeof current === 'string' && typeof value === 'string') target[field] = value;
    }
  }

  return out;
}
