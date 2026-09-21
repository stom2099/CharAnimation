/**
 * Alpha-channel utilities.
 *
 * Deliberately free of DOM types so they can be unit-tested in Node and reused
 * inside workers.
 */

/** RGBA bytes backed by a plain ArrayBuffer, which is what `ImageData` accepts. */
export type RgbaData = Uint8ClampedArray<ArrayBuffer>;

export interface RgbaImage {
  data: RgbaData;
  width: number;
  height: number;
}

export type BBox = { x: number; y: number; width: number; height: number };

/** Pixels at or below this alpha are treated as empty. */
export const ALPHA_THRESHOLD = 8;

/**
 * True when the image carries meaningful transparency.
 *
 * Sampling every `step`-th pixel keeps this cheap on large uploads; the ratio
 * test then decides whether the background-removal step can be skipped.
 */
export function hasAlpha(img: RgbaImage, ratio = 0.01, step = 4): boolean {
  const { data } = img;
  const total = (data.length / 4) | 0;
  if (total === 0) return false;
  let sampled = 0;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4 * step) {
    sampled++;
    if (data[i] < 250) transparent++;
  }
  if (sampled === 0) return false;
  return transparent / sampled >= ratio;
}

/** Tight bounds of everything above `threshold`, or null when fully transparent. */
export function alphaBBox(img: RgbaImage, threshold = ALPHA_THRESHOLD): BBox | null {
  const { data, width, height } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4 + 3;
    for (let x = 0; x < width; x++) {
      if (data[rowStart + x * 4] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Rounds up to an even number — H.264 rejects odd dimensions. */
export function toEven(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

/**
 * Computes the crop window: the subject's bounds plus a margin, so the sprite
 * has room to sway without its limbs being clipped at the canvas edge.
 *
 * The window may extend past the source image; `cropAndPad` fills the overhang
 * with transparent pixels.
 */
export function paddedWindow(
  bbox: BBox,
  paddingRatio: number,
): { x: number; y: number; width: number; height: number } {
  const pad = Math.round(Math.max(bbox.width, bbox.height) * Math.max(0, paddingRatio));
  return {
    x: bbox.x - pad,
    y: bbox.y - pad,
    width: toEven(bbox.width + pad * 2),
    height: toEven(bbox.height + pad * 2),
  };
}

/** Copies a (possibly out-of-bounds) window out of an RGBA image. */
export function cropAndPad(
  img: RgbaImage,
  window: { x: number; y: number; width: number; height: number },
): RgbaImage {
  const out = new Uint8ClampedArray(window.width * window.height * 4);
  const { data, width, height } = img;

  for (let y = 0; y < window.height; y++) {
    const sy = window.y + y;
    if (sy < 0 || sy >= height) continue;
    for (let x = 0; x < window.width; x++) {
      const sx = window.x + x;
      if (sx < 0 || sx >= width) continue;
      const si = (sy * width + sx) * 4;
      const di = (y * window.width + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }

  return { data: out, width: window.width, height: window.height };
}

/**
 * Shrinks the matte by `radius` pixels.
 *
 * Segmentation models tend to leave a rim of the old background around the
 * subject; eroding the alpha by a pixel removes that halo.
 */
export function erodeAlpha(img: RgbaImage, radius = 1): RgbaImage {
  if (radius <= 0) return img;
  const { data, width, height } = img;
  const src = new Uint8ClampedArray(data);
  const r = Math.round(radius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4 + 3;
      let min = src[i];
      for (let dy = -r; dy <= r && min > 0; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) {
          min = 0;
          break;
        }
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) {
            min = 0;
            break;
          }
          const a = src[(ny * width + nx) * 4 + 3];
          if (a < min) min = a;
        }
      }
      data[i] = min;
    }
  }
  return img;
}

/**
 * Softens the matte edge with a separable box blur on the alpha channel only.
 * RGB is left alone so colours never bleed across the silhouette.
 */
export function featherAlpha(img: RgbaImage, radius = 1): RgbaImage {
  if (radius <= 0) return img;
  const { data, width, height } = img;
  const r = Math.round(radius);
  const window = r * 2 + 1;
  const tmp = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = Math.min(width - 1, Math.max(0, x + dx));
        sum += data[(y * width + nx) * 4 + 3];
      }
      tmp[y * width + x] = sum / window;
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = Math.min(height - 1, Math.max(0, y + dy));
        sum += tmp[ny * width + x];
      }
      data[(y * width + x) * 4 + 3] = Math.round(sum / window);
    }
  }

  return img;
}

/**
 * Removes colour fringing by pushing each edge pixel's RGB toward the nearest
 * fully-opaque neighbour. Without this, semi-transparent pixels keep the old
 * background colour and show up as a bright rim over a dark backdrop.
 */
export function decontaminateEdges(img: RgbaImage, passes = 2): RgbaImage {
  const { data, width, height } = img;
  for (let pass = 0; pass < passes; pass++) {
    const src = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = src[i + 3];
        if (a === 0 || a >= 250) continue;

        let r = 0;
        let g = 0;
        let b = 0;
        let weight = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const ni = (ny * width + nx) * 4;
            const na = src[ni + 3];
            if (na < 250) continue;
            r += src[ni];
            g += src[ni + 1];
            b += src[ni + 2];
            weight++;
          }
        }
        if (weight === 0) continue;
        const mix = 1 - a / 255;
        data[i] = Math.round(src[i] * (1 - mix) + (r / weight) * mix);
        data[i + 1] = Math.round(src[i + 1] * (1 - mix) + (g / weight) * mix);
        data[i + 2] = Math.round(src[i + 2] * (1 - mix) + (b / weight) * mix);
      }
    }
  }
  return img;
}

/** Composites straight-alpha RGBA over an opaque colour, in place. */
export function flattenOnColor(img: RgbaImage, hex: string): RgbaImage {
  const { r, g, b } = parseHexColor(hex);
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    data[i] = Math.round(data[i] * a + r * (1 - a));
    data[i + 1] = Math.round(data[i + 1] * a + g * (1 - a));
    data[i + 2] = Math.round(data[i + 2] * a + b * (1 - a));
    data[i + 3] = 255;
  }
  return img;
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 255, g: 255, b: 255 };
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** Converts premultiplied RGBA (what WebGL hands back) to straight alpha, in place. */
export function unpremultiply(data: RgbaData): RgbaData {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    } else if (a < 255) {
      const f = 255 / a;
      data[i] = Math.min(255, Math.round(data[i] * f));
      data[i + 1] = Math.min(255, Math.round(data[i + 1] * f));
      data[i + 2] = Math.min(255, Math.round(data[i + 2] * f));
    }
  }
  return data;
}

/** Flips an RGBA buffer vertically — WebGL reads bottom-up, canvases are top-down. */
export function flipVertical(data: RgbaData, width: number, height: number): RgbaData {
  const stride = width * 4;
  const row = new Uint8ClampedArray(stride);
  for (let y = 0; y < (height >> 1); y++) {
    const top = y * stride;
    const bottom = (height - 1 - y) * stride;
    row.set(data.subarray(top, top + stride));
    data.copyWithin(top, bottom, bottom + stride);
    data.set(row, bottom);
  }
  return data;
}
