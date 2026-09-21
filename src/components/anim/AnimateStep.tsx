import { useEffect, useState } from 'react';
import { Download, Sliders, Wand2 } from 'lucide-react';
import { canvasToBlob, createCanvas, get2d } from '../../image/canvas';
import { useProject } from '../../store/project';
import { useT } from '../../i18n';
import { Button } from '../common/Button';
import { PreviewCanvas } from './PreviewCanvas';
import { PresetGallery } from './PresetGallery';
import { ParamPanel } from './ParamPanel';
import { Timeline } from './Timeline';
import { ExportDialog } from '../export/ExportDialog';

type Tab = 'presets' | 'tuning';

const THUMBNAIL_SIZE = 128;

/** A small preview for the recent-projects list; the full cutout is stored separately. */
async function makeThumbnail(image: ImageData): Promise<Blob | null> {
  try {
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(image.width, image.height));
    const w = Math.max(1, Math.round(image.width * scale));
    const h = Math.max(1, Math.round(image.height * scale));
    const source = createCanvas(image.width, image.height);
    get2d(source).putImageData(image, 0, 0);
    const target = createCanvas(w, h);
    const ctx = get2d(target) as CanvasRenderingContext2D;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
    return await canvasToBlob(target, 'image/png');
  } catch {
    return null;
  }
}

export function AnimateStep() {
  const cutout = useProject((s) => s.cutout);
  const dirty = useProject((s) => s.dirty);
  const persist = useProject((s) => s.persist);
  const pushToast = useProject((s) => s.pushToast);
  const t = useT();

  const [tab, setTab] = useState<Tab>('presets');
  const [exportOpen, setExportOpen] = useState(false);
  const [rendererKind, setRendererKind] = useState<string | null>(null);

  // Autosave, debounced, so a refresh never loses work.
  useEffect(() => {
    if (!dirty || !cutout) return;
    const id = setTimeout(async () => {
      await persist(await makeThumbnail(cutout.image));
    }, 800);
    return () => clearTimeout(id);
  }, [dirty, cutout, persist]);

  useEffect(() => {
    if (rendererKind === 'canvas2d') pushToast('info', t('error.noWebgl'));
  }, [rendererKind, pushToast, t]);

  if (!cutout) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 lg:flex-row">
      <div className="flex min-h-[46vh] flex-1 flex-col gap-3 lg:min-h-[320px]">
        <div className="min-h-0 flex-1">
          <PreviewCanvas cutout={cutout.image} onRendererReady={setRendererKind} />
        </div>
        <Timeline />
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[340px]">
        <div className="flex rounded-lg border border-ink-600 bg-ink-800 p-0.5">
          {(
            [
              ['presets', t('anim.presets'), <Wand2 key="i" size={13} />],
              ['tuning', t('anim.tuning'), <Sliders key="i" size={13} />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as Tab)}
              aria-pressed={tab === id}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                tab === id ? 'bg-accent-500 font-semibold text-ink-950' : 'text-ink-300 hover:bg-ink-700'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'presets' ? <PresetGallery cutout={cutout.image} /> : <ParamPanel />}
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          icon={<Download size={16} />}
          data-testid="open-export"
          onClick={() => setExportOpen(true)}
        >
          {t('export.open')}
        </Button>
      </aside>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
