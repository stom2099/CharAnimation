import UPNG from 'upng-js';
import { frameDelays } from '../engine';
import type { ExportOptions, ExportProgressFn } from './types';
import type { FrameStream } from './frames';

/**
 * Encodes the frame sequence as an animated PNG.
 *
 * APNG keeps the full 8-bit alpha channel, so this is the recommended format
 * whenever the result needs to sit on top of an arbitrary background.
 */
export async function encodeApng(
  stream: FrameStream,
  options: ExportOptions,
  onProgress?: ExportProgressFn,
  signal?: AbortSignal,
): Promise<Blob> {
  const buffers: ArrayBuffer[] = [];

  await stream.each(
    (image, index) => {
      // Copy: the renderer reuses its backing buffer between frames.
      buffers.push(image.data.slice().buffer as ArrayBuffer);
      onProgress?.({ phase: 'render', done: index + 1, total: stream.frames });
    },
    undefined,
    signal,
  );

  onProgress?.({ phase: 'encode', done: 0, total: 1 });
  const delays = frameDelays(buffers.length, options.fps, 1);
  // cnum = 0 keeps it lossless; anything else quantises to a palette.
  const png = UPNG.encode(buffers, stream.width, stream.height, 0, delays);
  onProgress?.({ phase: 'encode', done: 1, total: 1 });

  return new Blob([png], { type: 'image/png' });
}
