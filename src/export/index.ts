import type { AnimParams } from '../engine';
import { createFrameStream, ExportAbortedError } from './frames';
import { encodeApng } from './apng';
import { encodeGif } from './gif';
import { encodeSpritesheet } from './spritesheet-encode';
import { sheetFiles } from './spritesheet';
import { encodeVideo } from './video';
import { zipFiles } from './download';
import {
  FORMAT_EXTENSION,
  buildFileName,
  type ExportOptions,
  type ExportProgressFn,
  type ExportResult,
} from './types';

export * from './types';
export * from './spritesheet';
export { downloadBlob, downloadFiles, zipFiles } from './download';
export { probeVideoSupport, type VideoSupport } from './video';
export { ExportAbortedError } from './frames';

export interface RunExportInput {
  cutout: ImageData;
  params: AnimParams;
  options: ExportOptions;
  baseName: string;
  presetId: string;
}

/**
 * Renders and encodes a full export.
 *
 * Everything runs on the main thread by design: the renderer needs a GPU
 * context, and the frame loop yields between frames so the progress bar keeps
 * moving and cancellation stays responsive.
 */
export async function runExport(
  input: RunExportInput,
  onProgress?: ExportProgressFn,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const started = performance.now();
  const { cutout, params, options, baseName, presetId } = input;
  const stream = createFrameStream(cutout, params, options);

  try {
    const fileName = buildFileName(
      baseName,
      presetId,
      stream.width,
      stream.height,
      options.fps,
      FORMAT_EXTENSION[options.format],
    );

    let files;
    switch (options.format) {
      case 'gif':
        files = [{ name: fileName, blob: await encodeGif(stream, options, onProgress, signal) }];
        break;
      case 'apng':
        files = [{ name: fileName, blob: await encodeApng(stream, options, onProgress, signal) }];
        break;
      case 'webm':
      case 'mp4':
        files = [
          {
            name: fileName,
            blob: await encodeVideo(stream, options, options.format, onProgress, signal),
          },
        ];
        break;
      case 'spritesheet': {
        const sheet = await encodeSpritesheet(stream, options, fileName, onProgress, signal);
        files = sheetFiles(fileName, sheet.png, sheet.json);
        if (options.spritesheet.zip) {
          onProgress?.({ phase: 'package', done: 0, total: 1 });
          const zipped = await zipFiles(files, fileName.replace(/\.png$/i, '.zip'));
          onProgress?.({ phase: 'package', done: 1, total: 1 });
          files = [zipped];
        }
        break;
      }
      default: {
        const exhaustive: never = options.format;
        throw new Error(`Unsupported export format: ${String(exhaustive)}`);
      }
    }

    if (signal?.aborted) throw new ExportAbortedError();

    return {
      files,
      frames: stream.frames,
      width: stream.width,
      height: stream.height,
      durationSeconds: stream.durationSeconds,
      elapsedMs: performance.now() - started,
    };
  } finally {
    stream.dispose();
  }
}

/** Rough output-size estimate, used to warn before an expensive export. */
export function estimateBytes(
  format: ExportOptions['format'],
  width: number,
  height: number,
  frames: number,
): number {
  const pixels = width * height * frames;
  switch (format) {
    case 'gif':
      return pixels * 0.32;
    case 'apng':
      return pixels * 0.9;
    case 'spritesheet':
      return pixels * 1.1;
    case 'mp4':
      return pixels * 0.07;
    case 'webm':
      return pixels * 0.06;
    default:
      return pixels;
  }
}
