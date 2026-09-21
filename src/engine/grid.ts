import type { Grid } from './types';
import { clamp } from './math';

/** Builds the deformation lattice for an image of `width` x `height` pixels. */
export function createGrid(width: number, height: number, cols: number, rows: number): Grid {
  const c = Math.round(clamp(cols, 2, 128));
  const r = Math.round(clamp(rows, 2, 128));
  const vx = c + 1;
  const vy = r + 1;
  const count = vx * vy;

  const u = new Float32Array(count);
  const v = new Float32Array(count);
  const base = new Float32Array(count * 2);

  for (let row = 0; row < vy; row++) {
    const vv = row / r;
    for (let col = 0; col < vx; col++) {
      const i = row * vx + col;
      const uu = col / c;
      u[i] = uu;
      v[i] = vv;
      base[i * 2] = uu * width;
      base[i * 2 + 1] = vv * height;
    }
  }

  const indices = new Uint32Array(c * r * 6);
  let k = 0;
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const a = row * vx + col;
      const b = a + 1;
      const d = a + vx;
      const e = d + 1;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = b;
      indices[k++] = e;
      indices[k++] = d;
    }
  }

  return { cols: c, rows: r, count, u, v, base, indices, width, height };
}
