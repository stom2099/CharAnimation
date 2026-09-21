import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';

interface Props {
  before: ImageData;
  after: ImageData;
}

/** Drag-to-compare slider between the original photo and the cut-out matte. */
export function BeforeAfter({ before, after }: Props) {
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(0.5);
  const [wrapWidth, setWrapWidth] = useState(0);
  const t = useT();

  // The clipped "before" canvas has to stay at full width while its container
  // narrows, otherwise the two halves would not line up.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) => setWrapWidth(entry.contentRect.width));
    observer.observe(wrap);
    setWrapWidth(wrap.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    for (const [ref, image] of [
      [beforeRef, before],
      [afterRef, after],
    ] as const) {
      const canvas = ref.current;
      if (!canvas) continue;
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d')?.putImageData(image, 0, 0);
    }
  }, [before, after]);

  const move = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSplit(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };

  return (
    <div
      ref={wrapRef}
      className="checker relative select-none overflow-hidden rounded-xl border border-ink-700"
      style={{ aspectRatio: `${before.width} / ${before.height}`, maxHeight: '52vh' }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) move(e.clientX);
      }}
    >
      <canvas ref={afterRef} className="absolute inset-0 h-full w-full object-contain" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${split * 100}%` }}>
        <canvas
          ref={beforeRef}
          className="absolute inset-0 h-full object-contain"
          style={{ width: wrapWidth || '100%' }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent-400"
        style={{ left: `${split * 100}%` }}
      >
        <span className="absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-accent-400 bg-ink-900 text-[10px] text-accent-300">
          ↔
        </span>
      </div>
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-ink-950/70 px-1.5 py-0.5 text-[10px] text-ink-200">
        {t('matte.original')}
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-ink-950/70 px-1.5 py-0.5 text-[10px] text-ink-200">
        {t('matte.result')}
      </span>
    </div>
  );
}
