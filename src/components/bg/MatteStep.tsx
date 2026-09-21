import { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, Sparkles, SkipForward, X } from 'lucide-react';
import { useProject } from '../../store/project';
import { useT } from '../../i18n';
import { Button } from '../common/Button';
import { ProgressBar } from '../common/ProgressBar';
import { Slider } from '../common/Slider';
import { Toggle } from '../common/Toggle';
import { BeforeAfter } from './BeforeAfter';

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function MatteStep() {
  const source = useProject((s) => s.source);
  const matte = useProject((s) => s.matte);
  const removal = useProject((s) => s.removal);
  const settings = useProject((s) => s.matteSettings);
  const skipped = useProject((s) => s.skippedRemoval);
  const runRemoval = useProject((s) => s.runRemoval);
  const cancelRemoval = useProject((s) => s.cancelRemoval);
  const skipRemoval = useProject((s) => s.skipRemoval);
  const rebuildCutout = useProject((s) => s.rebuildCutout);
  const goToStep = useProject((s) => s.goToStep);
  const t = useT();

  const autoStarted = useRef(false);

  // An image that already carries alpha needs no model download at all.
  useEffect(() => {
    if (!source || autoStarted.current) return;
    autoStarted.current = true;
    if (source.hadAlpha) void skipRemoval();
  }, [source, skipRemoval]);

  if (!source) return null;

  const progress = removal.progress;
  const stageLabel =
    progress?.stage === 'processing' ? t('matte.processing') : t('matte.loadingModel');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:flex-row">
      <div className="min-w-0 flex-1">
        {matte ? (
          <BeforeAfter before={source.image} after={matte} />
        ) : (
          <div
            className="checker overflow-hidden rounded-xl border border-ink-700"
            style={{ aspectRatio: `${source.width} / ${source.height}`, maxHeight: '52vh' }}
          >
            <SourcePreview image={source.image} />
          </div>
        )}
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div>
          <h2 className="text-sm font-semibold">{t('matte.headline')}</h2>
          {source.hadAlpha ? (
            <p className="mt-1 text-xs text-ink-400">{t('matte.hasAlpha')}</p>
          ) : (
            <p className="mt-1 text-xs text-ink-400">{t('matte.firstRun')}</p>
          )}
        </div>

        {removal.running ? (
          <div className="space-y-3">
            <ProgressBar
              ratio={progress?.ratio ?? null}
              label={stageLabel}
              detail={
                progress?.bytesTotal
                  ? `${formatBytes(progress.bytesLoaded)} / ${formatBytes(progress.bytesTotal)}`
                  : progress?.detail
              }
            />
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={cancelRemoval}>
              {t('matte.cancel')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              icon={<Sparkles size={15} />}
              data-testid="run-removal"
              onClick={() => void runRemoval()}
            >
              {matte && !skipped ? t('matte.rerun') : t('matte.run')}
            </Button>
            <Button
              variant="secondary"
              icon={<SkipForward size={15} />}
              data-testid="skip-removal"
              onClick={() => void skipRemoval()}
            >
              {t('matte.skip')}
            </Button>
          </div>
        )}

        {removal.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-danger-400/40 bg-danger-400/10 px-3 py-2 text-xs text-danger-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="flex-1">
              {t('matte.failed')}: {removal.error}
            </span>
          </div>
        ) : null}

        {removal.elapsedMs ? (
          <p className="text-xs text-accent-300">
            {t('matte.done', `${(removal.elapsedMs / 1000).toFixed(1)}s`)}
          </p>
        ) : null}

        {matte ? (
          <>
            <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-3">
              <h3 className="text-xs font-semibold text-ink-200">{t('matte.tuning')}</h3>
              <Slider
                label={t('matte.padding')}
                value={settings.paddingRatio}
                min={0}
                max={0.45}
                step={0.01}
                format={(n) => `${Math.round(n * 100)}%`}
                onChange={(paddingRatio) => void rebuildCutout({ paddingRatio })}
              />
              <Slider
                label={t('matte.erode')}
                value={settings.erode}
                min={0}
                max={3}
                step={1}
                disabled={skipped}
                format={(n) => `${n} px`}
                onChange={(erode) => void rebuildCutout({ erode })}
              />
              <Slider
                label={t('matte.feather')}
                value={settings.feather}
                min={0}
                max={3}
                step={1}
                disabled={skipped}
                format={(n) => `${n} px`}
                onChange={(feather) => void rebuildCutout({ feather })}
              />
              <Toggle
                label={t('matte.decontaminate')}
                checked={settings.decontaminate}
                disabled={skipped}
                onChange={(decontaminate) => void rebuildCutout({ decontaminate })}
              />
            </div>

            <Button
              variant="primary"
              className="w-full"
              icon={<ArrowRight size={15} />}
              data-testid="continue-to-animate"
              onClick={() => goToStep('animate')}
            >
              {t('matte.continue')}
            </Button>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function SourcePreview({ image }: { image: ImageData }) {
  return (
    <canvas
      className="h-full w-full object-contain"
      width={image.width}
      height={image.height}
      ref={(canvas) => {
        canvas?.getContext('2d')?.putImageData(image, 0, 0);
      }}
    />
  );
}
