import { useEffect, useRef } from 'react';
import { createGrid, deform, type Grid } from '../../engine';
import {
  createRenderer,
  createContentBoxCache,
  viewForBox,
  type MeshRenderer,
  type View,
} from '../../render';
import { useProject } from '../../store/project';

/** Extra samples per axis; 2 means four samples per displayed pixel. */
const MAX_SUPERSAMPLE = 2;
const MIN_SUPERSAMPLE = 0.75;
const MAX_BUFFER_PIXELS = 4_500_000;
/** How often the scrubber is told the current time. 15 Hz is plenty. */
const TIME_PUBLISH_MS = 66;
/** Frame-time thresholds for the adaptive resolution controller. */
const SLOW_FRAME_MS = 24;
const FAST_FRAME_MS = 11;
const ADAPT_WINDOW = 45;

interface Props {
  cutout: ImageData;
  className?: string;
  onRendererReady?(kind: string): void;
}

/**
 * Live preview.
 *
 * Framing comes from the animation's swept bounds — the same box the exporter
 * uses — so the preview is a faithful preview of the file you get.
 *
 * The render loop reads the store imperatively rather than through hooks: it
 * runs on every animation frame and must never re-subscribe or re-render.
 */
export function PreviewCanvas({ cutout, className = '', onRendererReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<HTMLDivElement>(null);
  const supersampleRef = useRef(MAX_SUPERSAMPLE);
  const resizeRef = useRef<() => void>(() => {});
  const rendererRef = useRef<MeshRenderer | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const viewRef = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const dprRef = useRef(1);

  const gridCols = useProject((s) => s.params.grid.cols);
  const gridRows = useProject((s) => s.params.grid.rows);
  const background = useProject((s) => s.previewBackground);
  const previewColor = useProject((s) => s.previewColor);
  const showPivot = useProject((s) => s.showPivot);
  const setPivot = useProject((s) => s.setPivot);

  // Create the renderer once per cutout.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas, 'auto', { antialias: false });
    renderer.setTexture(cutout);
    rendererRef.current = renderer;
    onRendererReady?.(renderer.kind);
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [cutout, onRendererReady]);

  // Rebuild the lattice when the density or the cutout changes.
  useEffect(() => {
    const grid = createGrid(cutout.width, cutout.height, gridCols, gridRows);
    gridRef.current = grid;
    positionsRef.current = new Float32Array(grid.count * 2);
  }, [cutout, gridCols, gridRows]);

  // Keep the drawing buffer in step with the element's CSS size.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      // Supersample rather than using MSAA, then let the browser downscale.
      // Capped by total pixels so a large window does not tank the frame rate.
      const base = Math.min(2, window.devicePixelRatio || 1) * supersampleRef.current;
      const cssPixels = Math.max(1, rect.width * rect.height);
      const dpr = Math.min(base, Math.sqrt(MAX_BUFFER_PIXELS / cssPixels));
      dprRef.current = dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      rendererRef.current?.resize(rect.width * dpr, rect.height * dpr);
    };

    resizeRef.current = resize;
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // The render loop.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let publishedAt = 0;
    let local = useProject.getState().time;
    const boxFor = createContentBoxCache();

    // Adaptive resolution: supersampling is what makes deformed edges look
    // clean, but it is also the main cost. Measure real frame times and trade
    // sharpness for smoothness only on machines that need it.
    let frameMs = 16;
    let sinceAdapt = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const renderer = rendererRef.current;
      const grid = gridRef.current;
      if (!renderer || !grid) return;

      const state = useProject.getState();
      const elapsed = now - last;
      const dt = Math.min(0.1, elapsed / 1000);
      last = now;

      frameMs += (Math.min(200, elapsed) - frameMs) * 0.1;
      if (++sinceAdapt >= ADAPT_WINDOW) {
        sinceAdapt = 0;
        const current = supersampleRef.current;
        if (frameMs > SLOW_FRAME_MS && current > MIN_SUPERSAMPLE) {
          supersampleRef.current = Math.max(MIN_SUPERSAMPLE, current - 0.5);
          resizeRef.current();
        } else if (frameMs < FAST_FRAME_MS && current < MAX_SUPERSAMPLE) {
          supersampleRef.current = Math.min(MAX_SUPERSAMPLE, current + 0.25);
          resizeRef.current();
        }
      }

      if (state.playing) {
        local = (local + dt) % state.params.loopSeconds;
        if (now - publishedAt > TIME_PUBLISH_MS) {
          publishedAt = now;
          state.setTime(local);
        }
      } else {
        local = state.time;
      }

      const dpr = dprRef.current;
      const box = boxFor(grid, state.params);
      const view = viewForBox(box, renderer.width, renderer.height, 8 * dpr);
      viewRef.current = view;

      deform(grid, state.params, local, positionsRef.current);
      renderer.draw(positionsRef.current, grid, view, {
        background: previewBackgroundColor(state.previewBackground, state.previewColor),
      });

      // Position the anchor marker here rather than during render: it depends
      // on the live view transform, which changes every frame.
      const gizmo = gizmoRef.current;
      if (gizmo) {
        const x = (state.params.pivot.pu * grid.width * view.scale + view.offsetX) / dpr;
        const y = (state.params.pivot.pv * grid.height * view.scale + view.offsetY) / dpr;
        gizmo.style.transform = `translate(${x}px, ${y}px)`;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const placePivot = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = dprRef.current;
    const view = viewRef.current;
    const x = ((clientX - rect.left) * dpr - view.offsetX) / view.scale;
    const y = ((clientY - rect.top) * dpr - view.offsetY) / view.scale;
    setPivot(x / grid.width, y / grid.height);
  };

  const solid = previewBackgroundColor(background, previewColor);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden rounded-[14px] ${
        background === 'checker' ? 'checker' : ''
      } ${className}`}
      style={solid ? { background: solid } : undefined}
    >
      <canvas
        ref={canvasRef}
        data-testid="preview-canvas"
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          if (!showPivot) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          placePivot(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!showPivot || e.buttons !== 1) return;
          placePivot(e.clientX, e.clientY);
        }}
      />
      <div
        ref={gizmoRef}
        aria-hidden
        hidden={!showPivot}
        className="pointer-events-none absolute left-0 top-0 -ml-2.5 -mt-2.5 h-5 w-5 rounded-full border-2 border-accent-400 bg-accent-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
      >
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-300" />
      </div>
    </div>
  );
}

function previewBackgroundColor(
  background: 'checker' | 'dark' | 'light' | 'color',
  color: string,
): string | null {
  switch (background) {
    case 'dark':
      return '#0b0f14';
    case 'light':
      return '#eef2f6';
    case 'color':
      return color;
    default:
      return null;
  }
}
