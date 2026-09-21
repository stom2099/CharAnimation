declare module 'upng-js' {
  /**
   * @param cnum 0 = lossless; any other value is the palette size used by the
   *             built-in quantiser.
   */
  export function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[],
  ): ArrayBuffer;

  export function decode(buffer: ArrayBuffer): {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: unknown[];
    tabs: Record<string, unknown>;
    data: Uint8Array;
  };

  export function toRGBA8(img: ReturnType<typeof decode>): ArrayBuffer[];

  const UPNG: {
    encode: typeof encode;
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
  };
  export default UPNG;
}

declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        repeat?: number;
        dispose?: number;
ize?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;
  export function nearestColorIndex(palette: number[][], pixel: number[]): number;
  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    opts?: { roundRGB?: number; roundAlpha?: number; oneBitAlpha?: boolean | number },
  ): void;
}
