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
