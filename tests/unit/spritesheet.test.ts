import { describe, expect, it } from 'vitest';
import { buildSheetMeta, planSheet } from '../../src/export/spritesheet';
import { buildFileName, estimateBytes } from '../../src/export';

describe('planSheet', () => {
  it('lays 48 square frames out in a compact grid', () => {
    const plan = planSheet(48, 256, 256, 4096);
    expect(plan.columns * plan.rows).toBeGreaterThanOrEqual(48);
    expect(plan.sheetWidth).toBeLessThanOrEqual(4096);
    expect(plan.sheetHeight).toBeLessThanOrEqual(4096);
    expect(plan.scale).toBe(1);
  });

  it('keeps the sheet within maxSize by shrinking frames when it must', () => {
    const plan = planSheet(60, 1024, 1024, 2048);
    expect(plan.sheetWidth).toBeLessThanOrEqual(2048);
    expect(plan.sheetHeight).toBeLessThanOrEqual(2048);
    expect(plan.scale).toBeLessThan(1);
    expect(plan.columns * plan.rows).toBeGreaterThanOrEqual(60);
  });

  it('handles a single frame', () => {
    const plan = planSheet(1, 300, 200, 4096);
    expect(plan.columns).toBe(1);
    expect(plan.rows).toBe(1);
    expect(plan.sheetWidth).toBe(300);
    expect(plan.sheetHeight).toBe(200);
  });

  it('accounts for non-square frames', () => {
    const plan = planSheet(30, 100, 400, 4096);
    expect(plan.columns * plan.rows).toBeGreaterThanOrEqual(30);
    expect(plan.sheetHeight).toBeLessThanOrEqual(4096);
  });

  it('never returns zero columns or rows', () => {
    const plan = planSheet(0, 10, 10, 64);
    expect(plan.columns).toBeGreaterThan(0);
    expect(plan.rows).toBeGreaterThan(0);
  });
});

describe('buildSheetMeta', () => {
  const plan = planSheet(4, 100, 100, 4096);
  const meta = JSON.parse(
    buildSheetMeta({ plan, frames: 4, fps: 25, imageName: 'cat.png' }),
  ) as {
    frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration: number }>;
    animations: Record<string, string[]>;
    meta: Record<string, unknown>;
  };

  it('names one entry per frame, zero padded', () => {
    expect(Object.keys(meta.frames)).toEqual(['idle_0', 'idle_1', 'idle_2', 'idle_3']);
  });

  it('lists the frames in playback order', () => {
    expect(meta.animations.idle).toHaveLength(4);
    expect(meta.animations.idle[0]).toBe('idle_0');
  });

  it('places frames on the grid without overlap', () => {
    const seen = new Set<string>();
    for (const entry of Object.values(meta.frames)) {
      const key = `${entry.frame.x},${entry.frame.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(entry.frame.w).toBe(plan.frameWidth);
    }
  });

  it('records the frame rate in both places engines look', () => {
    expect(meta.meta.frameRate).toBe(25);
    expect(Object.values(meta.frames)[0].duration).toBe(40);
  });

  it('pads indices for longer animations', () => {
    const long = JSON.parse(
      buildSheetMeta({ plan: planSheet(100, 32, 32, 4096), frames: 100, fps: 30, imageName: 'x.png' }),
    ) as { animations: Record<string, string[]> };
    expect(long.animations.idle[0]).toBe('idle_00');
    expect(long.animations.idle[99]).toBe('idle_99');
  });
});

describe('buildFileName', () => {
  it('builds a descriptive, filesystem-safe name', () => {
    expect(buildFileName('my cat.png', 'sway', 512, 512, 24, 'gif')).toBe(
      'my-cat_sway_512x512_24fps.gif',
    );
  });

  it('keeps Unicode letters and digits', () => {
    expect(buildFileName('mèo con 2', 'bob', 256, 256, 12, 'png')).toBe(
      'mèo-con-2_bob_256x256_12fps.png',
    );
  });

  it('falls back when the name has nothing usable', () => {
    expect(buildFileName('***', 'float', 256, 256, 30, 'webm')).toBe(
      'charanim_float_256x256_30fps.webm',
    );
  });

  it('truncates very long names', () => {
    const name = buildFileName('x'.repeat(200), 'wind', 256, 256, 24, 'mp4');
    expect(name.split('_')[0]).toHaveLength(48);
  });
});

describe('estimateBytes', () => {
  it('ranks video as the most compact and spritesheets as the least', () => {
    const args = [512, 512, 48] as const;
    expect(estimateBytes('mp4', ...args)).toBeLessThan(estimateBytes('gif', ...args));
    expect(estimateBytes('gif', ...args)).toBeLessThan(estimateBytes('apng', ...args));
    expect(estimateBytes('apng', ...args)).toBeLessThan(estimateBytes('spritesheet', ...args));
  });

  it('scales with frame count', () => {
    expect(estimateBytes('gif', 256, 256, 60)).toBeCloseTo(estimateBytes('gif', 256, 256, 30) * 2, 5);
  });
});
