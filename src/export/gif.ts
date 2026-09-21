import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { frameDelays } from '../engine';
import type { ExportOptions, ExportProgressFn } from './types';
import type { FrameStream } from './frames';

/**
 * Encodes the frame sequence as an animated GIF.
 *
 * A palette shared across all frames is the default: per-frame palettes track
 * colour better in theory, but on a looping character they make the sprite
 * shimmer as the palette drifts frame to frame.
 */
export async function encodeGif(
  stream: FrameStream,
  options: ExportOptions,
  onProgress?: ExportProgressFn,
  signal?: AbortSignal,
): Promise<Blob> {
  const gif = GIFEncoder();
  // GIF stores delays in hundredths of a second; spread the rounding error.
  const delays = frameDelays(stream.frames, options.fps, 10).map((cs) => cs * 10);
  const format = options.transparent ? 'rgba4444' : 'rgb565';
  const colors = Math.max(2, Math.min(256, options.gif.colors));

  let sharedPalette: number[][] | null = null;

  await stream.each(
    (image, index) => {
      const rgba = image.data;

      if (options.transparent) {
        // GIF transparency is one bit: snap everything to fully on or off so
        // the matte edge does not turn into speckle.
        for (let i = 3; i < rgba.length; i += 4) {
          rgba[i] = rgba[i] < 128 ? 0 : 255;
        }
      }

      if (!sharedPalette || !options.gif.sharedPalette) {
        sharedPalette = quantize(rgba, colors, {
          format,
          oneBitAlpha: options.transparent,
          clearAlpha: options.transparent,
          clearAlphaThreshold: 128,
        });
      }

      const indexed = applyPalette(rgba, sharedPalette, format);
      gif.writeFrame(indexed, image.width, image.height, {
        palette: index === 0 || !options.gif.sharedPalette ? sharedPalette : undefined,
        delay: delays[index],
        repeat: 0,
        transparent: options.transparent,
        transparentIndex: options.transparent ? findTransparentIndex(sharedPalette) : 0,
        dispose: options.transparent ? 2 : -1,
        first: index === 0,
      });
      onProgress?.({ phase: 'encode', done: index + 1, total: stream.frames });
    },
    undefined,
    signal,
  );

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/gif' });
}

/** gifenc puts the fully transparent entry first, but never assume it. */
function findTransparentIndex(palette: number[][]): number {
  const idx = palette.findIndex((c) => c.length === 4 && c[3] === 0);
  return idx >= 0 ? idx : 0;
}
