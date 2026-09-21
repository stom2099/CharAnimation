import type { ExportOptions, ExportProgressFn } from './types';
import type { FrameStream } from './frames';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Video export through Mediabunny, which drives WebCodecs directly.
 *
 * Neither MP4/H.264 nor the WebM profiles browsers can encode carry an alpha
 * channel, so video exports are always flattened onto a solid colour. The UI
 * says so before the user commits to an export.
 */

const QUALITY_BITRATE: Record<ExportOptions['video']['quality'], number> = {
  low: 1_500_000,
  medium: 4_000_000,
  high: 9_000_000,
};

export type VideoContainer = 'mp4' | 'webm';

export interface VideoSupport {
  mp4: boolean;
  webm: boolean;
}

let cachedSupport: Promise<VideoSupport> | null = null;

/** Probes which containers this browser can actually encode. */
export function probeVideoSupport(): Promise<VideoSupport> {
  if (!cachedSupport) {
    cachedSupport = (async () => {
      if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
        return { mp4: false, webm: false };
      }
      try {
        const { canEncodeVideo } = await import('mediabunny');
        const size = { width: 640, height: 640 };
        const [mp4, vp9, vp8] = await Promise.all([
          canEncodeVideo('avc', size).catch(() => false),
          canEncodeVideo('vp9', size).catch(() => false),
          canEncodeVideo('vp8', size).catch(() => false),
        ]);
        return { mp4: Boolean(mp4), webm: Boolean(vp9 || vp8) };
      } catch {
        return { mp4: false, webm: false };
      }
    })();
  }
  return cachedSupport;
}

export async function encodeVideo(
  stream: FrameStream,
  options: ExportOptions,
  container: VideoContainer,
  onProgress?: ExportProgressFn,
  signal?: AbortSignal,
): Promise<Blob> {
  const mediabunny: any = await import('mediabunny');
  const {
    Output,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    CanvasSource,
    canEncodeVideo,
  } = mediabunny;

  const size = { width: stream.width, height: stream.height };
  let codec: string;
  if (container === 'mp4') {
    codec = 'avc';
  } else {
    codec = (await canEncodeVideo('vp9', size).catch(() => false)) ? 'vp9' : 'vp8';
  }

  const output = new Output({
    format: container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  const canvas = stream.renderer.frameCanvas;
  const source = new CanvasSource(canvas as HTMLCanvasElement, {
    codec,
    bitrate: QUALITY_BITRATE[options.video.quality],
    keyFrameInterval: 1,
    latencyMode: 'quality',
  });
  output.addVideoTrack(source, { frameRate: stream.fps });
  await output.start();

  const step = 1 / stream.fps;

  try {
    await stream.each(
      async (_image, index) => {
        await source.add(index * step, step);
        onProgress?.({ phase: 'encode', done: index + 1, total: stream.frames });
      },
      undefined,
      signal,
    );
    await output.finalize();
  } catch (error) {
    try {
      await output.cancel?.();
    } catch {
      /* the original error matters more */
    }
    throw error;
  }

  const buffer: ArrayBuffer | null = output.target.buffer;
  if (!buffer) throw new Error('Video encoding produced no data');
  return new Blob([buffer], { type: container === 'mp4' ? 'video/mp4' : 'video/webm' });
}
