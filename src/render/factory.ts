import { Canvas2DMeshRenderer } from './canvas2d';
import { WebGLMeshRenderer } from './webgl';
import type { MeshRenderer } from './types';

export type RendererPreference = 'auto' | 'webgl2' | 'canvas2d';

/**
 * `?renderer=canvas2d` forces the software path.
 *
 * Useful when a machine reports WebGL2 but its driver misbehaves, and it is how
 * the end-to-end suite covers the fallback.
 */
export function preferenceFromUrl(): RendererPreference {
  if (typeof location === 'undefined') return 'auto';
  const value = new URLSearchParams(location.search).get('renderer');
  return value === 'canvas2d' || value === 'webgl2' ? value : 'auto';
}

/** Picks the best available renderer, falling back instead of throwing. */
export function createRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  preference: RendererPreference = 'auto',
  opts: { antialias?: boolean } = {},
): MeshRenderer {
  const resolved = preference === 'auto' ? preferenceFromUrl() : preference;
  if (resolved !== 'canvas2d') {
    try {
      return new WebGLMeshRenderer(canvas, opts);
    } catch (error) {
      if (resolved === 'webgl2') throw error;
      console.warn('[CharAnimation] WebGL2 unavailable, falling back to Canvas2D:', error);
    }
  }
  return new Canvas2DMeshRenderer(canvas);
}
