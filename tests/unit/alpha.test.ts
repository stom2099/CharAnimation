import { describe, expect, it } from 'vitest';
import {
  alphaBBox,
  cropAndPad,
  erodeAlpha,
  featherAlpha,
  flattenOnColor,
  flipVertical,
  hasAlpha,
  paddedWindow,
  parseHexColor,
  toEven,
  unpremultiply,
  type RgbaImage,
} from '../../src/image/alpha';

function blank(width: number, height: number, alpha = 0): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 1] = 100;
    data[i + 2] = 50;
    data[i + 3] = alpha;
  }
  return { data, width, height };
}

function setPixel(img: RgbaImage, x: number, y: number, a: number) {
  img.data[(y * img.width + x) * 4 + 3] = a;
}

describe('hasAlpha', () => {
  it('is false for a fully opaque image', () => {
    expect(hasAlpha(blank(32, 32, 255))).toBe(false);
  });

  it('is true for a fully transparent image', () => {
    expect(hasAlpha(blank(32, 32, 0))).toBe(true);
  });

  it('ignores a negligible amount of transparency', () => {
    const img = blank(64, 64, 255);
    setPixel(img, 0, 0, 0);
    expect(hasAlpha(img, 0.01, 1)).toBe(false);
  });

  it('handles an empty buffer', () => {
    expect(hasAlpha({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toBe(false);
  });
});

describe('alphaBBox', () => {
  it('returns null when nothing is visible', () => {
    expect(alphaBBox(blank(16, 16, 0))).toBeNull();
  });

  it('finds the tight bounds of the visible content', () => {
    const img = blank(20, 20, 0);
    setPixel(img, 4, 6, 255);
    setPixel(img, 11, 15, 255);
    expect(alphaBBox(img)).toEqual({ x: 4, y: 6, width: 8, height: 10 });
  });

  it('treats near-zero alpha as empty', () => {
    const img = blank(10, 10, 0);
    setPixel(img, 5, 5, 4);
    expect(alphaBBox(img)).toBeNull();
    setPixel(img, 5, 5, 40);
    expect(alphaBBox(img)).toEqual({ x: 5, y: 5, width: 1, height: 1 });
  });

  it('covers the whole frame for an opaque image', () => {
    expect(alphaBBox(blank(7, 9, 255))).toEqual({ x: 0, y: 0, width: 7, height: 9 });
  });
});

describe('paddedWindow / toEven', () => {
  it('rounds dimensions up to even numbers', () => {
    expect(toEven(3)).toBe(4);
    expect(toEven(4)).toBe(4);
    expect(toEven(0)).toBe(2);
  });

  it('adds a margin proportional to the longest side', () => {
    const w = paddedWindow({ x: 10, y: 20, width: 100, height: 50 }, 0.2);
    expect(w.x).toBe(-10);
    expect(w.y).toBe(0);
    expect(w.width).toBe(140);
    expect(w.height).toBe(90);
  });

  it('supports zero padding', () => {
    const w = paddedWindow({ x: 0, y: 0, width: 10, height: 10 }, 0);
    expect(w).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

describe('cropAndPad', () => {
  it('fills out-of-bounds area with transparent pixels', () => {
    const img = blank(4, 4, 255);
    const out = cropAndPad(img, { x: -2, y: -2, width: 8, height: 8 });
    expect(out.width).toBe(8);
    expect(out.data[0 * 4 + 3]).toBe(0);
    expect(out.data[(2 * 8 + 2) * 4 + 3]).toBe(255);
  });

  it('copies colour as well as alpha', () => {
    const img = blank(4, 4, 255);
    const out = cropAndPad(img, { x: 1, y: 1, width: 2, height: 2 });
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([200, 100, 50]);
  });
});

describe('matte clean-up', () => {
  it('erodeAlpha shrinks the visible area', () => {
    const img = blank(9, 9, 0);
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) setPixel(img, x, y, 255);
    erodeAlpha(img, 1);
    expect(alphaBBox(img)).toEqual({ x: 4, y: 4, width: 1, height: 1 });
  });

  it('featherAlpha softens a hard edge without touching colour', () => {
    const img = blank(9, 9, 0);
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) setPixel(img, x, y, 255);
    featherAlpha(img, 1);
    const edge = img.data[(4 * 9 + 2) * 4 + 3];
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(img.data[(4 * 9 + 4) * 4]).toBe(200);
  });

  it('erode with radius 0 is a no-op', () => {
    const img = blank(4, 4, 255);
    const before = Array.from(img.data);
    erodeAlpha(img, 0);
    featherAlpha(img, 0);
    expect(Array.from(img.data)).toEqual(before);
  });
});

describe('colour helpers', () => {
  it('parses both hex forms and falls back to white', () => {
    expect(parseHexColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('00ff80')).toEqual({ r: 0, g: 255, b: 128 });
    expect(parseHexColor('not a colour')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('flattens transparency onto a background colour', () => {
    const img = blank(1, 1, 0);
    flattenOnColor(img, '#000000');
    expect(Array.from(img.data)).toEqual([0, 0, 0, 255]);
  });

  it('leaves opaque pixels untouched when flattening', () => {
    const img = blank(1, 1, 255);
    flattenOnColor(img, '#000000');
    expect(Array.from(img.data)).toEqual([200, 100, 50, 255]);
  });

  it('unpremultiplies back to straight alpha', () => {
    const data = new Uint8ClampedArray([128, 64, 32, 128, 0, 0, 0, 0]);
    unpremultiply(data);
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(128);
    expect(data[3]).toBe(128);
    expect(Array.from(data.slice(4))).toEqual([0, 0, 0, 0]);
  });
});

describe('flipVertical', () => {
  it('mirrors rows top to bottom', () => {
    const data = new Uint8ClampedArray([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
    flipVertical(data, 1, 3);
    expect(Array.from(data)).toEqual([3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1]);
  });

  it('is its own inverse', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).map((_, i) => i % 255);
    const before = Array.from(data);
    flipVertical(data, 4, 4);
    flipVertical(data, 4, 4);
    expect(Array.from(data)).toEqual(before);
  });
});
