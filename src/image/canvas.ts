import type { RgbaData } from './alpha';

/** Small canvas helpers shared by the decode, render and export paths. */

export function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

export function get2d(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return ctx;
}

export async function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob() returned null'))),
      type,
      quality,
    );
  });
}

export function imageDataToBlob(
  data: RgbaData,
  width: number,
  height: number,
  type = 'image/png',
): Promise<Blob> {
  const canvas = createCanvas(width, height);
  get2d(canvas).putImageData(new ImageData(data, width, height), 0, 0);
  return canvasToBlob(canvas, type);
}

export async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    const canvas = createCanvas(bitmap.width, bitmap.height);
    const ctx = get2d(canvas);
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** Draws a checkerboard so transparency is visible against any theme. */
export function paintChecker(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  size = 12,
  colors: [string, string] = ['#1a2029', '#151b23'],
): void {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors[1];
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if (((x / size) | 0) % 2 === ((y / size) | 0) % 2) ctx.fillRect(x, y, size, size);
    }
  }
}
