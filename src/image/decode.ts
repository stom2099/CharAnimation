import { alphaBBox, cropAndPad, hasAlpha, paddedWindow, type BBox, type RgbaImage } from './alpha';
import { createCanvas, get2d, imageDataToBlob } from './canvas';

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** iOS tabs are killed well before desktop ones, so cap the working resolution lower there. */
export function maxWorkingSize(): number {
  if (typeof navigator === 'undefined') return 2048;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIOS ? 1280 : 2048;
}

export interface DecodedSource {
  image: ImageData;
  width: number;
  height: number;
  hadAlpha: boolean;
  downscaled: boolean;
  originalWidth: number;
  originalHeight: number;
}

export class ImageDecodeError extends Error {
  constructor(
    message: string,
    readonly code: 'type' | 'size' | 'decode',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ImageDecodeError';
  }
}

export function assertAcceptable(file: File | Blob, name = ''): void {
  const type = file.type || '';
  if (!ACCEPTED_TYPES.includes(type as (typeof ACCEPTED_TYPES)[number])) {
    throw new ImageDecodeError(`Unsupported file type: ${type || name || 'unknown'}`, 'type');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageDecodeError(`File is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`, 'size');
  }
}

/** Decodes a user file, downscaling if needed, and reports whether it already has a matte. */
export async function decodeSource(file: File | Blob): Promise<DecodedSource> {
  assertAcceptable(file, 'name' in file ? file.name : '');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch (cause) {
    throw new ImageDecodeError('The file could not be decoded as an image', 'decode', { cause });
  }

  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const limit = maxWorkingSize();
  const scale = Math.min(1, limit / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));

  try {
    const canvas = createCanvas(width, height);
    const ctx = get2d(canvas);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);

    return {
      image,
      width,
      height,
      hadAlpha: hasAlpha(image),
      downscaled: scale < 1,
      originalWidth,
      originalHeight,
    };
  } finally {
    bitmap.close();
  }
}

export interface Cutout {
  /** Straight-alpha RGBA, ready to upload as a texture. */
  image: ImageData;
  width: number;
  height: number;
  /** Subject bounds inside the cutout, before padding. */
  subject: BBox;
  paddingRatio: number;
  blob: Blob;
}

export class EmptyCutoutError extends Error {
  constructor() {
    super('The image has no visible pixels left after background removal');
    this.name = 'EmptyCutoutError';
  }
}

/**
 * Trims the transparent margin and re-adds a controlled one.
 *
 * The margin matters: without it, a swaying sprite would be clipped by its own
 * texture bounds. With it, the deformation has empty room to move into.
 */
export async function buildCutout(image: ImageData, paddingRatio = 0.18): Promise<Cutout> {
  const rgba: RgbaImage = { data: image.data, width: image.width, height: image.height };
  const bbox = alphaBBox(rgba);
  if (!bbox) throw new EmptyCutoutError();

  const window = paddedWindow(bbox, paddingRatio);
  const cropped = cropAndPad(rgba, window);
  const out = new ImageData(cropped.data, cropped.width, cropped.height);
  const blob = await imageDataToBlob(cropped.data, cropped.width, cropped.height);

  return {
    image: out,
    width: cropped.width,
    height: cropped.height,
    subject: { x: bbox.x - window.x, y: bbox.y - window.y, width: bbox.width, height: bbox.height },
    paddingRatio,
    blob,
  };
}

/** Where the subject's feet sit inside the cutout — the natural sway pivot. */
export function suggestPivot(cutout: Cutout): { pu: number; pv: number } {
  const { subject, width, height } = cutout;
  return {
    pu: (subject.x + subject.width / 2) / width,
    pv: (subject.y + subject.height) / height,
  };
}
