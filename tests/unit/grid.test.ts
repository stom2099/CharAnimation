import { describe, expect, it } from 'vitest';
import { createGrid } from '../../src/engine';

describe('createGrid', () => {
  it('produces (cols+1)*(rows+1) vertices', () => {
    const g = createGrid(100, 200, 4, 5);
    expect(g.count).toBe(5 * 6);
    expect(g.u).toHaveLength(g.count);
    expect(g.base).toHaveLength(g.count * 2);
  });

  it('spans the full image with normalised coordinates', () => {
    const g = createGrid(100, 200, 4, 5);
    expect(Math.min(...g.u)).toBe(0);
    expect(Math.max(...g.u)).toBe(1);
    expect(Math.min(...g.v)).toBe(0);
    expect(Math.max(...g.v)).toBe(1);
    expect(g.base[0]).toBe(0);
    expect(g.base[g.base.length - 2]).toBeCloseTo(100, 5);
    expect(g.base[g.base.length - 1]).toBeCloseTo(200, 5);
  });

  it('emits two triangles per cell with in-range indices', () => {
    const g = createGrid(64, 64, 3, 2);
    expect(g.indices).toHaveLength(3 * 2 * 6);
    expect(Math.max(...g.indices)).toBeLessThan(g.count);
  });

  it('clamps absurd subdivisions instead of exploding', () => {
    expect(createGrid(10, 10, 0, -4).cols).toBe(2);
    expect(createGrid(10, 10, 5000, 5000).cols).toBe(128);
  });
});
