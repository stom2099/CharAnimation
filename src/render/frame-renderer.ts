import { createGrid, deform, sweptBounds, type AnimParams, type Grid } from '../engine';
import { createCanvas, get2d } from '../image/canvas';
import { createRenderer, type RendererPreference } from './factory';
import { fitView, type MeshRenderer, type View } from './types';

export interface FrameRendererOptions {
  width: number;
  height: number;
  /** Supersampling factor; 2 renders at double resolution and downsamples. */
  ssaa?: number;
  background?: string | null;
  padding?: number;
  preference?: RendererPreference;
}

/**
 * Renders individual animation frames offscreen for export.
 *
 * Framing comes from the motion's swept bounds rather than the rest pose, so a
 * sprite that leans out of its texture box is never clipped mid-swing — and the
 * preview uses the same box, so what you see is what you get.
 */
export class FrameRenderer {
  readonly grid: Grid;
  readonly view: View;
  readonly outputWidth: number;
  readonly outputHeight: number;

  private renderer: MeshRenderer;
  private glCanvas: HTMLCanvasElement | OffscreenCanvas;
  private outCanvas: HTMLCanvasElement | OffscreenCanvas;
  private outCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private positions: Float32Array;
  private background: string | null;
  private ssaa: number;

  constructor(cutout: ImageData, private params: AnimParams, options: FrameRendererOptions) {
    this.outputWidth = Math.max(2, Math.round(options.width));
    this.outputHeight = Math.max(2, Math.round(options.height));
    this.ssaa = Math.max(1, Math.min(4, options.ssaa ?? 1));
    this.background = options.background ?? null;

    this.grid = createGrid(cutout.width, cutout.height, params.grid.cols, params.grid.rows);
    this.positions = new Float32Array(this.grid.count * 2);

    const box = contentBox(this.grid, params);
    const bufferW = Math.round(this.outputWidth * this.ssaa);
    const bufferH = Math.round(this.outputHeight * this.ssaa);
    this.view = viewForBox(box, bufferW, bufferH, (options.padding ?? 0) * this.ssaa);

    this.glCanvas = createCanvas(bufferW, bufferH);
    this.renderer = createRenderer(this.glCanvas, options.preference ?? 'auto', { antialias: false });
    this.renderer.resize(bufferW, bufferH);
    this.renderer.setTexture(cutout);

    this.outCanvas = createCanvas(this.outputWidth, this.outputHeight);
    this.outCtx = get2d(this.outCanvas);
    this.outCtx.imageSmoothingEnabled = true;
    this.outCtx.imageSmoothingQuality = 'high';
  }

  get rendererKind(): string {
    return this.renderer.kind;
  }

  renderAt(t: number): ImageData {
    deform(this.grid, this.params, t, this.positions);
    this.renderer.draw(this.positions, this.grid, this.view, { background: this.background });

    const ctx = this.outCtx as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.outputWidth, this.outputHeight);
    if (this.background) {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.outputWidth, this.outputHeight);
    }
    ctx.drawImage(
      this.glCanvas as CanvasImageSource,
      0,
      0,
      this.outputWidth,
      this.outputHeight,
    );
    return ctx.getImageData(0, 0, this.outputWidth, this.outputHeight);
  }

  /** The canvas holding the most recent frame — handy for video encoders. */
  get frameCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.outCanvas;
  }

  dispose(): void {
    this.renderer.destroy();
  }
}

export interface ContentBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounds swept by the animation, in cutout pixel space. */
export function contentBox(grid: Grid, params: AnimParams): ContentBox {
  const b = sweptBounds(grid, params, 32);
  return {
    x: b.minX,
    y: b.minY,
    width: Math.max(1, b.maxX - b.minX),
    height: Math.max(1, b.maxY - b.minY),
  };
}

/**
 * Memoised `contentBox` for the render loop.
 *
 * Computing it sweeps the whole lattice 32 times. That is fine once per
 * parameter change and ruinous once per animation frame, so the result is
 * cached against the identity of the inputs, which the store replaces whenever
 * anything actually changes.
 */
export function createContentBoxCache(): (grid: Grid, params: AnimParams) => ContentBox {
  let lastGrid: Grid | null = null;
  let lastParams: AnimParams | null = null;
  let cached: ContentBox = { x: 0, y: 0, width: 1, height: 1 };

  return (grid, params) => {
    if (grid !== lastGrid || params !== lastParams) {
      lastGrid = grid;
      lastParams = params;
      cached = contentBox(grid, params);
    }
    return cached;
  };
}

/** Maps a content box onto a drawing buffer, centred and letterboxed. */
export function viewForBox(
  box: { x: number; y: number; width: number; height: number },
  bufferW: number,
  bufferH: number,
  padding = 0,
): View {
  const fitted = fitView(box.width, box.height, bufferW, bufferH, padding);
  return {
    scale: fitted.scale,
    offsetX: fitted.offsetX - box.x * fitted.scale,
    offsetY: fitted.offsetY - box.y * fitted.scale,
  };
}

/** Output size that matches the animation's aspect ratio for a given long edge. */
export function suggestOutputSize(
  grid: Grid,
  params: AnimParams,
  longEdge: number,
): { width: number; height: number } {
  const box = contentBox(grid, params);
  const scale = longEdge / Math.max(box.width, box.height);
  return {
    width: evenClamp(box.width * scale),
    height: evenClamp(box.height * scale),
  };
}

function evenClamp(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}
