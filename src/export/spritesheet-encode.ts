import { createCanvas, canvasToBlob, get2d } from '../image/canvas';
import type { ExportOptions, ExportProgressFn } from './types';
import type { FrameStream } from './frames';
import { buildSheetMeta, planSheet, type SheetPlan } from './spritesheet';

export interface SheetOutput {
  png: Blob;
  json: string;
  plan: SheetPlan;
}

/** Packs every frame into a single texture atlas plus its JSON descriptor. */
export async function encodeSpritesheet(
  stream: FrameStream,
  options: ExportOptions,
  imageName: string,
  onProgress?: ExportProgressFn,
  signal?: AbortSignal,
): Promise<SheetOutput> {
  const plan = planSheet(stream.frames, stream.width, stream.height, options.spritesheet.maxSize);
  const canvas = createCanvas(plan.sheetWidth, plan.sheetHeight);
  const ctx = get2d(canvas) as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (!options.transparent) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, plan.sheetWidth, plan.sheetHeight);
  }

  const scratch = createCanvas(stream.width, stream.height);
  const scratchCtx = get2d(scratch) as CanvasRenderingContext2D;

  await stream.each(
    (image, index) => {
      const col = index % plan.columns;
      const row = Math.floor(index / plan.columns);
      const x = col * plan.frameWidth;
      const y = row * plan.frameHeight;

      if (plan.scale === 1) {
        ctx.putImageData(image, x, y);
      } else {
        scratchCtx.putImageData(image, 0, 0);
        ctx.drawImage(scratch as CanvasImageSource, x, y, plan.frameWidth, plan.frameHeight);
      }
      onProgress?.({ phase: 'encode', done: index + 1, total: stream.frames });
    },
    undefined,
    signal,
  );

  const png = await canvasToBlob(canvas, 'image/png');
  const json = buildSheetMeta({
    plan,
    frames: stream.frames,
    fps: stream.fps,
    imageName,
  });

  return { png, json, plan };
}
