import { Canvas2DMeshRenderer } from './canvas2d';
import { WebGLMeshRenderer } from './webgl';
import type { MeshRenderer } from './types';

export type RendererPreference = 'auto' | 'webgl2' | 'canvas2d';

/** Picks the best available renderer, falling back instead of throwing. */
export function createRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  preference: RendererPreference = 'auto',
  opts: { antialias?: boolean } = {},
): MeshRenderer {
  if (preference !== 'canvas2d') {
    try {
      return new WebGLMeshRenderer(canvas, opts);
    } catch (error) {
      if (preference === 'webgl2') throw error;
      console.warn('[CharAnimation] WebGL2 unavailable, falling back to Canvas2D:', error);
    }
  }
  return new Canvas2DMeshRenderer(canvas);
}
