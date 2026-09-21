import { useEffect, useRef } from 'react';
import { PRESETS, createGrid, deform } from '../../engine';
import { createRenderer, contentBox, viewForBox, type MeshRenderer } from '../../render';
import { createCanvas } from '../../image/canvas';
import { useProject } from '../../store/project';
import { useT, type MessageKey } from '../../i18n';

const THUMB = 88;
const THUMB_GRID = 14;

/**
 * Animated preset thumbnails.
 *
 * All eight share a single offscreen WebGL context and are blitted into cheap
 * 2D canvases. Giving each thumbnail its own context would burn through the
 * browser's context budget and cost far more than the copies do.
 */
export function PresetGallery({ cutout }: { cutout: ImageData }) {
  const presetId = useProject((s) => s.presetId);
  const applyPreset = useProject((s) => s.applyPreset);
  const t = useT();
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    // Thumbnails are tiny, so supersampling them is essentially free.
    const dpr = Math.min(2, window.devicePixelRatio || 1) * 2;
    const size = Math.round(THUMB * dpr);
    const offscreen = createCanvas(size, size);

    let renderer: MeshRenderer;
    try {
      renderer = createRenderer(offscreen, 'auto', { antialias: false });
    } catch {
      return;
    }
    renderer.resize(size, size);
    renderer.setTexture(cutout);

    const grid = createGrid(cutout.width, cutout.height, THUMB_GRID, THUMB_GRID);
    const positions = new Float32Array(grid.count * 2);
    const views = PRESETS.map((preset) =>
      viewForBox(contentBox(grid, preset.params), size, size, 3 * dpr),
    );

    const contexts = refs.current.map((canvas) => {
      if (!canvas) return null;
      canvas.width = size;
      canvas.height = size;
      return canvas.getContext('2d');
    });

    let frame = 0;
    let running = true;
    const start = performance.now();

    const tick = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(tick);
      const t0 = (now - start) / 1000;
      for (let i = 0; i < PRESETS.length; i++) {
        const ctx = contexts[i];
        if (!ctx) continue;
        deform(grid, PRESETS[i].params, t0, positions);
        renderer.draw(positions, grid, views[i], { background: null });
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(offscreen as CanvasImageSource, 0, 0);
      }
    };

    // Pause the loop when the tab is hidden; nobody is watching, and mobile
    // browsers punish background work.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.destroy();
    };
  }, [cutout]);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
      {PRESETS.map((preset, i) => {
        const active = preset.id === presetId;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset.id)}
            aria-pressed={active}
            title={t(preset.descKey as MessageKey)}
            data-testid={`preset-${preset.id}`}
            className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors ${
              active
                ? 'border-accent-500 bg-accent-900/40'
                : 'border-ink-700 bg-ink-800 hover:border-ink-500'
            }`}
          >
            <span className="checker block w-full overflow-hidden rounded-lg">
              <canvas
                ref={(el) => {
                  refs.current[i] = el;
                }}
                style={{ width: '100%', aspectRatio: '1 / 1', display: 'block' }}
              />
            </span>
            <span
              className={`text-[11px] leading-tight ${active ? 'font-semibold text-accent-300' : 'text-ink-300'}`}
            >
              {t(preset.nameKey as MessageKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
