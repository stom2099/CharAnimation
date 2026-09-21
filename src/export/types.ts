export type ExportFormat = 'gif' | 'apng' | 'spritesheet' | 'webm' | 'mp4';

export const FPS_CHOICES = [12, 15, 24, 30] as const;
export type Fps = (typeof FPS_CHOICES)[number];

export const SIZE_CHOICES = [256, 384, 512, 768, 1024] as const;

export interface ExportOptions {
  format: ExportFormat;
  fps: Fps;
  /** Longest edge of the output, in pixels. */
  longEdge: number;
  /** Supersampling factor used while rendering; 2 gives visibly cleaner edges. */
  ssaa: 1 | 2;
  transparent: boolean;
  backgroundColor: string;
  gif: { colors: number; dither: boolean; sharedPalette: boolean };
  spritesheet: { maxSize: 2048 | 4096; zip: boolean };
  video: { quality: 'low' | 'medium' | 'high' };
}

export interface ExportFile {
  name: string;
  blob: Blob;
}

export interface ExportResult {
  files: ExportFile[];
  frames: number;
  width: number;
  height: number;
  durationSeconds: number;
  elapsedMs: number;
}

export interface ExportProgress {
  phase: 'render' | 'encode' | 'package';
  done: number;
  total: number;
}

export type ExportProgressFn = (progress: ExportProgress) => void;

export function defaultExportOptions(): ExportOptions {
  return {
    format: 'gif',
    fps: 24,
    longEdge: 512,
    ssaa: 2,
    transparent: true,
    backgroundColor: '#ffffff',
    gif: { colors: 256, dither: true, sharedPalette: true },
    spritesheet: { maxSize: 4096, zip: true },
    video: { quality: 'high' },
  };
}

/** Formats that can carry an alpha channel. */
export const SUPPORTS_ALPHA: Record<ExportFormat, boolean> = {
  gif: true,
  apng: true,
  spritesheet: true,
  webm: false,
  mp4: false,
};

export const FORMAT_EXTENSION: Record<ExportFormat, string> = {
  gif: 'gif',
  apng: 'png',
  // Suffixed so a sprite sheet never overwrites an APNG of the same animation.
  spritesheet: 'sheet.png',
  webm: 'webm',
  mp4: 'mp4',
};

/**
 * Peak memory an export needs for frames it must hold simultaneously.
 *
 * APNG is the only format that buffers the whole sequence: the encoder needs
 * every frame before it can write the file. At 1024 px and 30 fps an eight
 * second loop would want about a gigabyte, which takes the tab down. GIF,
 * video and sprite sheets consume frames as they arrive, so they are free.
 */
export function peakFrameMemoryBytes(
  format: ExportFormat,
  width: number,
  height: number,
  frames: number,
): number {
  return format === 'apng' ? width * height * 4 * frames : 0;
}

/** Above this, the browser is likely to run out of memory before it finishes. */
export const MEMORY_LIMIT_BYTES = 700 * 1024 * 1024;
/** Above this it still works, but it is worth warning about. */
export const MEMORY_WARN_BYTES = 350 * 1024 * 1024;

/** `my-cat_sway_512x512_24fps.gif` */
export function buildFileName(
  base: string,
  presetId: string,
  width: number,
  height: number,
  fps: number,
  extension: string,
): string {
  const safe =
    base
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'charanim';
  return `${safe}_${presetId}_${width}x${height}_${fps}fps.${extension}`;
}
