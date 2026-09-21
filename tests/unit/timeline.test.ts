import { describe, expect, it } from 'vitest';
import { effectiveLoop, frameCount, frameDelayMs, frameTime } from '../../src/engine';

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
