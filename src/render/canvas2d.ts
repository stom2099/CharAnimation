import type { Grid } from '../engine';
import type { DrawOptions, MeshRenderer, View } from './types';
import { createCanvas, get2d } from '../image/canvas';
import type { RgbaData } from '../image/alpha';

/**
 * Canvas2D fallback renderer.
 *
 * Draws the mesh as affine-mapped triangles. Slower than the WebGL path and
 * slightly seamier, but it keeps the app usable — including export — on
 * machines with no working WebGL2.
 */
export class Canvas2DMeshRenderer implements MeshRenderer {
  readonly kind = 'canvas2d' as const;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;

  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private texture: OffscreenCanvas | HTMLCanvasElement | null = null;
  private texWidth = 1;
  private texHeight = 1;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas;
    this.ctx = get2d(canvas);
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  resize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    this.ctx = get2d(this.canvas);
  }

  setTexture(image: ImageData): void {
    const c = createCanvas(image.width, image.height);
    get2d(c).putImageData(image, 0, 0);
    this.texture = c;
    this.texWidth = image.width;
    this.texHeight = image.height;
  }

  draw(positions: Float32Array, grid: Grid, view: View, options: DrawOptions): void {
    const ctx = this.ctx as CanvasRenderingContext2D;
    const { width, height } = this.canvas;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, width, height);
    }
    if (!this.texture) return;

    const idx = grid.indices;
    for (let i = 0; i < idx.length; i += 3) {
      this.drawTriangle(ctx, positions, grid, view, idx[i], idx[i + 1], idx[i + 2]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawTriangle(
    ctx: CanvasRenderingContext2D,
    pos: Float32Array,
    grid: Grid,
    view: View,
    ia: number,
    ib: number,
    ic: number,
  ): void {
    const { scale, offsetX, offsetY } = view;
    const x0 = pos[ia * 2] * scale + offsetX;
    const y0 = pos[ia * 2 + 1] * scale + offsetY;
    const x1 = pos[ib * 2] * scale + offsetX;
    const y1 = pos[ib * 2 + 1] * scale + offsetY;
    const x2 = pos[ic * 2] * scale + offsetX;
    const y2 = pos[ic * 2 + 1] * scale + offsetY;

    const u0 = grid.u[ia] * this.texWidth;
    const v0 = grid.v[ia] * this.texHeight;
    const u1 = grid.u[ib] * this.texWidth;
    const v1 = grid.v[ib] * this.texHeight;
    const u2 = grid.u[ic] * this.texWidth;
    const v2 = grid.v[ic] * this.texHeight;

    const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (Math.abs(det) < 1e-8) return;

    const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
    const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
    const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det;
    const d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
    const e = x0 - a * u0 - c * v0;
    const f = y0 - b * u0 - d * v0;

    // Expand the clip outward by a hair so adjacent triangles overlap instead
    // of leaving hairline seams.
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const grow = 0.6;
    const push = (x: number, y: number): [number, number] => {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [x + (dx / len) * grow, y + (dy / len) * grow];
    };
    const [gx0, gy0] = push(x0, y0);
    const [gx1, gy1] = push(x1, y1);
    const [gx2, gy2] = push(x2, y2);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    ctx.lineTo(gx1, gy1);
    ctx.lineTo(gx2, gy2);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(this.texture as CanvasImageSource, 0, 0);
    ctx.restore();
  }

  readPixels(): RgbaData {
    const { width, height } = this.canvas;
    return this.ctx.getImageData(0, 0, width, height).data as RgbaData;
  }

  destroy(): void {
    this.texture = null;
  }
}
