import { frameCount, frameTime, type AnimParams } from '../engine';
import { FrameRenderer } from '../render';
import type { ExportOptions, ExportProgressFn } from './types';
import { suggestOutputSize } from '../render';
import { createGrid } from '../engine';

export interface FrameStream {
  renderer: FrameRenderer;
  frames: number;
  fps: number;
  width: number;
  height: number;
  durationSeconds: number;
  /** Yields one frame at a time, letting the event loop breathe between them. */
  each(
    visit: (image: ImageData, index: number) => void | Promise<void>,
    onProgress?: ExportProgressFn,
    signal?: AbortSignal,
  ): Promise<void>;
  dispose(): void;
}

export class ExportAbortedError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportAbortedError';
  }
}

/** Lets the browser paint between frames so progress stays responsive. */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

/**
 * Builds the frame sequence for an export.
 *
 * The frame at t = duration is deliberately not rendered: it is identical to
 * frame 0, and emitting it would produce a visible hitch on every loop.
 */
export function createFrameStream(
  cutout: ImageData,
  params: AnimParams,
  options: ExportOptions,
): FrameStream {
  const fps = options.fps;
  const frames = frameCount(params.loopSeconds, fps);
  const probeGrid = createGrid(cutout.width, cutout.height, params.grid.cols, params.grid.rows);
  const { width, height } = suggestOutputSize(probeGrid, params, options.longEdge);

  const renderer = new FrameRenderer(cutout, params, {
    width,
    height,
    ssaa: options.ssaa,
    background: options.transparent ? null : options.backgroundColor,
  });

  return {
    renderer,
    frames,
    fps,
    width,
    height,
    durationSeconds: frames / fps,
    async each(visit, onProgress, signal) {
      for (let i = 0; i < frames; i++) {
        if (signal?.aborted) throw new ExportAbortedError();
        const image = renderer.renderAt(frameTime(i, fps));
        await visit(image, i);
        onProgress?.({ phase: 'render', done: i + 1, total: frames });
        if (i % 2 === 1) await yieldToUi();
      }
    },
    dispose() {
      renderer.dispose();
    },
  };
}
