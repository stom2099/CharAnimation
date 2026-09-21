/**
 * Frame-count helpers.
 *
 * Exports render frames at `i / fps` for i in [0, N). The frame at t = N / fps
 * is deliberately skipped because it is identical to frame 0 — emitting it
 * would show up as a stutter when the clip loops.
 */

export function frameCount(loopSeconds: number, fps: number): number {
  return Math.max(2, Math.round(loopSeconds * fps));
}

/** Loop length actually written to the file, after snapping to whole frames. */
export function effectiveLoop(loopSeconds: number, fps: number): number {
  return frameCount(loopSeconds, fps) / fps;
}

export function frameTime(index: number, fps: number): number {
  return index / fps;
}

/** Per-frame delay in milliseconds, for GIF and APNG. */
export function frameDelayMs(fps: number): number {
  return 1000 / fps;
}

/**
 * Integer per-frame delays that add up to the exact loop duration.
 *
 * Container formats store delays in coarse units — GIF in hundredths of a
 * second, APNG in milliseconds. Rounding each frame independently drifts: at
 * 15 fps a GIF would round 66.67 ms up to 70 ms on every frame and run 5%
 * slow. Rounding the running total instead spreads the remainder across the
 * loop, so the animation keeps its intended tempo.
 *
 * @param unitMs milliseconds per unit of the target container (10 for GIF, 1 for APNG)
 */
export function frameDelays(frames: number, fps: number, unitMs: number): number[] {
  const delays: number[] = [];
  let previous = 0;
  for (let i = 1; i <= frames; i++) {
    const boundary = Math.round((i * 1000) / fps / unitMs);
    delays.push(Math.max(1, boundary - previous));
    previous = boundary;
  }
  return delays;
}
