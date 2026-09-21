import { describe, expect, it } from 'vitest';
import {
  FREQS,
  LIMITS,
  MODIFIER_KEYS,
  PRESETS,
  cloneParams,
  defaultParams,
  getPreset,
  normaliseParams,
} from '../../src/engine';

describe('presets', () => {
  it('exposes eight distinct presets', () => {
    expect(PRESETS).toHaveLength(8);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(8);
  });

  it('enables at least one modifier per preset', () => {
    for (const preset of PRESETS) {
      const active = MODIFIER_KEYS.filter((k) => preset.params[k].enabled);
      expect(active.length, preset.id).toBeGreaterThan(0);
    }
  });

  it('uses only integer loop frequencies, which is what keeps loops seamless', () => {
    for (const preset of PRESETS) {
      for (const key of MODIFIER_KEYS) {
        expect(FREQS, `${preset.id}.${key}`).toContain(preset.params[key].freq);
      }
    }
  });

  it('keeps loop lengths inside the UI limits', () => {
    for (const preset of PRESETS) {
      expect(preset.params.loopSeconds).toBeGreaterThanOrEqual(LIMITS.loopSeconds.min);
      expect(preset.params.loopSeconds).toBeLessThanOrEqual(LIMITS.loopSeconds.max);
    }
  });

  it('hands out independent copies', () => {
    const a = getPreset('sway')!;
    const copy = cloneParams(a.params);
    copy.sway.amountDeg = 99;
    copy.pivot.pu = 0.1;
    expect(a.params.sway.amountDeg).not.toBe(99);
    expect(a.params.pivot.pu).toBe(0.5);
  });
});

describe('normaliseParams', () => {
  it('falls back to defaults for junk input', () => {
    expect(normaliseParams(null)).toEqual(defaultParams());
    expect(normaliseParams('nope')).toEqual(defaultParams());
    expect(normaliseParams(42)).toEqual(defaultParams());
  });

  it('clamps out-of-range values', () => {
    const p = normaliseParams({ loopSeconds: 999, pivot: { pu: -3, pv: 12 }, grid: { cols: 2, rows: 4000 } });
    expect(p.loopSeconds).toBe(8);
    expect(p.pivot).toEqual({ pu: 0, pv: 1 });
    expect(p.grid).toEqual({ cols: 8, rows: 64 });
  });

  it('keeps known modifier fields and drops unknown ones', () => {
    const p = normaliseParams({ sway: { enabled: true, amountDeg: 12, bogus: 5 } });
    expect(p.sway.enabled).toBe(true);
    expect(p.sway.amountDeg).toBe(12);
    expect('bogus' in p.sway).toBe(false);
  });

  it('ignores type-mismatched fields', () => {
    const p = normaliseParams({ sway: { enabled: 'yes', amountDeg: 'lots' } });
    expect(p.sway.enabled).toBe(false);
    expect(p.sway.amountDeg).toBe(defaultParams().sway.amountDeg);
  });

  it('round-trips through JSON', () => {
    const original = getPreset('wind')!.params;
    expect(normaliseParams(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });
});
