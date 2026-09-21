import type { ExportFile } from './types';

export interface SheetPlan {
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  /** < 1 when frames had to be shrunk to fit inside `maxSize`. */
  scale: number;
}

/**
 * Lays frames out in the squarest grid that fits inside `maxSize`, shrinking
 * the frames only as a last resort so game engines can still load the sheet.
 */
export function planSheet(
  frames: number,
  frameWidth: number,
  frameHeight: number,
  maxSize = 4096,
): SheetPlan {
  const count = Math.max(1, Math.round(frames));
  let scale = 1;

  for (let attempt = 0; attempt < 12; attempt++) {
    const fw = Math.max(1, Math.floor(frameWidth * scale));
    const fh = Math.max(1, Math.floor(frameHeight * scale));
    const maxCols = Math.max(1, Math.floor(maxSize / fw));
    const maxRows = Math.max(1, Math.floor(maxSize / fh));

    if (maxCols * maxRows >= count) {
      const columns = Math.min(maxCols, Math.max(1, Math.ceil(Math.sqrt((count * fh) / fw))));
      const rows = Math.ceil(count / columns);
      if (rows <= maxRows) {
        return {
          columns,
          rows,
          frameWidth: fw,
          frameHeight: fh,
          sheetWidth: columns * fw,
          sheetHeight: rows * fh,
          scale,
        };
      }
      const widened = Math.min(maxCols, Math.ceil(count / maxRows));
      const widenedRows = Math.ceil(count / widened);
      if (widenedRows <= maxRows) {
        return {
          columns: widened,
          rows: widenedRows,
          frameWidth: fw,
          frameHeight: fh,
          sheetWidth: widened * fw,
          sheetHeight: widenedRows * fh,
          scale,
        };
      }
    }
    scale *= 0.8;
  }

  // Degenerate input: one tiny row rather than an exception.
  return {
    columns: count,
    rows: 1,
    frameWidth: 1,
    frameHeight: 1,
    sheetWidth: count,
    sheetHeight: 1,
    scale: 1 / Math.max(frameWidth, frameHeight),
  };
}

export interface SheetMetaInput {
  plan: SheetPlan;
  frames: number;
  fps: number;
  imageName: string;
  animationName?: string;
}

/**
 * TexturePacker "JSON Hash" metadata, the format Pixi, Phaser and most 2D
 * engines read directly.
 */
export function buildSheetMeta(input: SheetMetaInput): string {
  const { plan, frames, fps, imageName } = input;
  const animation = input.animationName ?? 'idle';
  const pad = String(Math.max(1, frames - 1)).length;

  const framesMap: Record<string, unknown> = {};
  const order: string[] = [];

  for (let i = 0; i < frames; i++) {
    const name = `${animation}_${String(i).padStart(pad, '0')}`;
    order.push(name);
    const col = i % plan.columns;
    const row = Math.floor(i / plan.columns);
    framesMap[name] = {
      frame: {
        x: col * plan.frameWidth,
        y: row * plan.frameHeight,
        w: plan.frameWidth,
        h: plan.frameHeight,
      },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: plan.frameWidth, h: plan.frameHeight },
      sourceSize: { w: plan.frameWidth, h: plan.frameHeight },
      pivot: { x: 0.5, y: 0.5 },
      duration: Math.round(1000 / fps),
    };
  }

  return JSON.stringify(
    {
      frames: framesMap,
      animations: { [animation]: order },
      meta: {
        app: 'CharAnimation',
        version: '1.0',
        image: imageName,
        format: 'RGBA8888',
        size: { w: plan.sheetWidth, h: plan.sheetHeight },
        scale: '1',
        frameRate: fps,
        frameTags: [{ name: animation, from: 0, to: frames - 1, direction: 'forward' }],
      },
    },
    null,
    2,
  );
}

export function sheetFiles(baseName: string, png: Blob, json: string): ExportFile[] {
  const stem = baseName.replace(/\.[a-z0-9]+$/i, '');
  return [
    { name: `${stem}.png`, blob: png },
    { name: `${stem}.json`, blob: new Blob([json], { type: 'application/json' }) },
  ];
}
