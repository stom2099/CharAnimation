import type { Grid } from '../engine';
import type { RgbaData } from '../image/alpha';

/** Maps sprite pixel space onto the drawing buffer. */
export interface View {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface DrawOptions {
  /** `null` clears to transparent. */
  background: string | null;
}

export interface MeshRenderer {
  readonly kind: 'webgl2' | 'canvas2d';
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly width: number;
  readonly height: number;
  resize(width: number, height: number): void;
  setTexture(image: ImageData): void;
  draw(positions: Float32Array, grid: Grid, view: View, options: DrawOptions): void;
  /** Straight-alpha RGBA, top-down row order. */
  readPixels(): RgbaData;
  destroy(): void;
}

/** Fits a sprite of `w` x `h` into `boxW` x `boxH`, centred, never upscaling past `maxScale`. */
export function fitView(
  w: number,
  h: number,
  boxW: number,
  boxH: number,
  padding = 0,
  maxScale = Infinity,
): View {
  const availW = Math.max(1, boxW - padding * 2);
  const availH = Math.max(1, boxH - padding * 2);
  const scale = Math.min(maxScale, Math.min(availW / w, availH / h));
  return {
    scale,
    offsetX: (boxW - w * scale) / 2,
    offsetY: (boxH - h * scale) / 2,
  };
}
