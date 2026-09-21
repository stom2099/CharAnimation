import { describe, expect, it } from 'vitest';
import { effectiveLoop, frameCount, frameDelayMs, frameDelays, frameTime } from '../../src/engine';

describe('timeline', () => {
  it('rounds the frame count to whole frames', () => {
    expect(frameCount(2, 30)).toBe(60);
    expect(frameCount(1.05, 24)).toBe(25);
    expect(frameCount(3.2, 12)).toBe(38);
  });

  it('never drops below two frames', () => {
    expect(frameCount(0.01, 12)).toBe(2);
    expect(frameCount(0, 30)).toBe(2);
  });

  it('reports the snapped loop length', () => {
    expect(effectiveLoop(1.05, 24)).toBeCloseTo(25 / 24, 10);
    expect(effectiveLoop(2, 30)).toBe(2);
  });

  it('spaces frames evenly and starts at zero', () => {
    expect(frameTime(0, 30)).toBe(0);
    expect(frameTime(15, 30)).toBe(0.5);
  });

  it('derives the per-frame delay from fps', () => {
    expect(frameDelayMs(25)).toBe(40);
    expect(frameDelayMs(12)).toBeCloseTo(83.333, 3);
  });
});

describe('frameDelays', () => {
  it('sums to the exact loop duration in GIF hundredths', () => {
    const delays = frameDelays(36, 15, 10);
    expect(delays).toHaveLength(36);
    expect(delays.reduce((a, b) => a + b, 0)).toBe(240); // 2.4 s
  });

  it('sums to the exact loop duration in APNG milliseconds', () => {
    const delays = frameDelays(36, 15, 1);
    expect(delays.reduce((a, b) => a + b, 0)).toBe(2400);
  });

  it('stays within one unit of the ideal per-frame delay', () => {
    const delays = frameDelays(30, 24, 10);
    for (const d of delays) {
      expect(Math.abs(d - 100 / 24)).toBeLessThanOrEqual(1);
    }
  });

  it('is exact when fps divides the unit evenly', () => {
    expect(new Set(frameDelays(20, 20, 10))).toEqual(new Set([5]));
    expect(new Set(frameDelays(24, 24, 1))).toEqual(new Set([42, 41]));
  });

  it('never emits a zero delay, which players treat as "as fast as possible"', () => {
    for (const fps of [12, 15, 24, 30]) {
      expect(frameDelays(60, fps, 10).every((d) => d >= 1)).toBe(true);
    }
  });
});
