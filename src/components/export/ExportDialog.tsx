import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { createGrid, frameCount } from '../../engine';
import {
  FPS_CHOICES,
  SIZE_CHOICES,
  SUPPORTS_ALPHA,
  downloadFiles,
  estimateBytes,
  probeVideoSupport,
  runExport,
  type ExportFormat,
  type ExportResult,
  type VideoSupport,
} from '../../export';
import { suggestOutputSize } from '../../render';
import { useProject } from '../../store/project';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { ProgressBar } from '../common/ProgressBar';
import { SegmentedControl } from '../common/SegmentedControl';
import { Slider } from '../common/Slider';
import { Toggle } from '../common/Toggle';

const FORMATS: ExportFormat[] = ['gif', 'apng', 'spritesheet', 'webm', 'mp4'];

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface Props {
  open: boolean;
  onClose(): void;
}

export function ExportDialog({ open, onClose }: Props) {
  const cutout = useProject((s) => s.cutout);
  const params = useProject((s) => s.params);
  const presetId = useProject((s) => s.presetId);
  const sourceName = useProject((s) => s.sourceName);
  const options = useProject((s) => s.exportOptions);
  const patch = useProject((s) => s.patchExportOptions);
  const exporting = useProject((s) => s.exporting);
  const setExporting = useProject((s) => s.setExporting);
  const pushToast = useProject((s) => s.pushToast);
  const t = useT();

  const [videoSupport, setVideoSupport] = useState<VideoSupport>({ mp4: true, webm: true });
  const [result, setResult] = useState<ExportResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) void probeVideoSupport().then(setVideoSupport);
  }, [open]);

  const frames = frameCount(params.loopSeconds, options.fps);
  // Framing follows the motion's swept bounds, so ask the renderer for the
  // exact size rather than guessing from the cutout's aspect ratio.
  const size = useMemo(() => {
    if (!cutout) return { width: options.longEdge, height: options.longEdge };
    const grid = createGrid(cutout.width, cutout.height, params.grid.cols, params.grid.rows);
    return suggestOutputSize(grid, params, options.longEdge);
  }, [cutout, params, options.longEdge]);

  const estimate = estimateBytes(options.format, size.width, size.height, frames);
  const alphaCapable = SUPPORTS_ALPHA[options.format];
  const formatUnsupported =
    (options.format === 'mp4' && !videoSupport.mp4) ||
    (options.format === 'webm' && !videoSupport.webm);

  const start = async () => {
    if (!cutout) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setResult(null);
    setExporting({ running: true, progress: null, error: null });

    try {
      const exported = await runExport(
        {
          cutout: cutout.image,
          params,
          options: { ...options, transparent: options.transparent && alphaCapable },
          baseName: sourceName,
          presetId,
        },
        (progress) => setExporting({ progress }),
        controller.signal,
      );
      setResult(exported);
      downloadFiles(exported.files);
      setExporting({ running: false, progress: null, error: null });
      pushToast(
        'success',
        t('export.done', exported.files[0].name, `${(exported.elapsedMs / 1000).toFixed(1)}s`),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExporting({ running: false, progress: null, error: message });
      if (!controller.signal.aborted) pushToast('error', `${t('export.failed')}: ${message}`);
    } finally {
      controllerRef.current = null;
    }
  };

  const progressLabel = () => {
    const p = exporting.progress;
    if (!p) return t('export.rendering', 0, frames);
    if (p.phase === 'package') return t('export.packaging');
    if (p.phase === 'encode') return t('export.encoding', p.done, p.total);
    return t('export.rendering', p.done, p.total);
  };

  return (
    <Modal
      open={open}
      title={t('export.title')}
      onClose={() => {
        controllerRef.current?.abort();
        onClose();
      }}
      footer={
        exporting.running ? (
          <Button
            variant="ghost"
            onClick={() => {
              controllerRef.current?.abort();
              setExporting({ running: false });
            }}
          >
            {t('export.cancel')}
          </Button>
        ) : (
          <>
            {result ? (
              <Button
                variant="secondary"
                icon={<Download size={15} />}
                onClick={() => downloadFiles(result.files)}
              >
                {t('export.download')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              disabled={!cutout || formatUnsupported}
              icon={<Download size={15} />}
              data-testid="start-export"
              onClick={() => void start()}
            >
              {t('export.start')}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-1.5 block text-xs text-ink-300">{t('export.format')}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMATS.map((format) => {
              const active = format === options.format;
              const disabled =
                (format === 'mp4' && !videoSupport.mp4) || (format === 'webm' && !videoSupport.webm);
              return (
                <button
                  key={format}
                  type="button"
                  disabled={disabled}
                  data-testid={`format-${format}`}
                  onClick={() => patch({ format })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    active
                      ? 'border-accent-500 bg-accent-900/40'
                      : 'border-ink-700 bg-ink-800 hover:border-ink-500'
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${active ? 'text-accent-300' : 'text-ink-100'}`}
                  >
                    {t(`format.${format}` as MessageKey)}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-ink-400">
                    {t(`format.${format}.desc` as MessageKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SegmentedControl
            label={t('export.fps')}
            value={options.fps}
            options={FPS_CHOICES.map((fps) => ({ value: fps, label: String(fps) }))}
            onChange={(fps) => patch({ fps })}
          />
          <SegmentedControl
            label={t('export.size')}
            value={options.longEdge}
            options={SIZE_CHOICES.map((px) => ({ value: px, label: String(px) }))}
            onChange={(longEdge) => patch({ longEdge })}
          />
        </div>

        <div className="space-y-3">
          <Toggle
            label={t('export.transparent')}
            checked={options.transparent && alphaCapable}
            disabled={!alphaCapable}
            onChange={(transparent) => patch({ transparent })}
          />
          {!options.transparent || !alphaCapable ? (
            <label className="flex items-center gap-2 text-xs text-ink-300">
              {t('export.bgColor')}
              <input
                type="color"
                value={options.backgroundColor}
                onChange={(e) => patch({ backgroundColor: e.target.value })}
              />
            </label>
          ) : null}
          <Toggle
            label={t('export.ssaa')}
            checked={options.ssaa === 2}
            onChange={(on) => patch({ ssaa: on ? 2 : 1 })}
          />
        </div>

        {options.format === 'gif' ? (
          <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-3">
            <Slider
              label={t('export.colors')}
              value={options.gif.colors}
              min={8}
              max={256}
              step={8}
              onChange={(colors) => patch({ gif: { ...options.gif, colors } })}
            />
            <Toggle
              label={t('export.sharedPalette')}
              checked={options.gif.sharedPalette}
              onChange={(sharedPalette) => patch({ gif: { ...options.gif, sharedPalette } })}
            />
          </div>
        ) : null}

        {options.format === 'spritesheet' ? (
          <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-3">
            <SegmentedControl
              label={t('export.maxSize')}
              value={options.spritesheet.maxSize}
              options={[
                { value: 2048 as const, label: '2048' },
                { value: 4096 as const, label: '4096' },
              ]}
              onChange={(maxSize) => patch({ spritesheet: { ...options.spritesheet, maxSize } })}
            />
            <Toggle
              label={t('export.zip')}
              checked={options.spritesheet.zip}
              onChange={(zip) => patch({ spritesheet: { ...options.spritesheet, zip } })}
            />
          </div>
        ) : null}

        {options.format === 'mp4' || options.format === 'webm' ? (
          <SegmentedControl
            label={t('export.quality')}
            value={options.video.quality}
            options={[
              { value: 'low' as const, label: t('export.quality.low') },
              { value: 'medium' as const, label: t('export.quality.medium') },
              { value: 'high' as const, label: t('export.quality.high') },
            ]}
            onChange={(quality) => patch({ video: { quality } })}
          />
        ) : null}

        {!alphaCapable ? (
          <p className="flex items-start gap-2 text-xs text-warn-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {t('export.noAlphaWarning')}
          </p>
        ) : null}
        {options.format === 'gif' && options.transparent ? (
          <p className="flex items-start gap-2 text-xs text-warn-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {t('export.gifWarning')}
          </p>
        ) : null}
        {formatUnsupported ? (
          <p className="flex items-start gap-2 text-xs text-danger-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {t('export.unsupported')}
          </p>
        ) : null}

        <p className="rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs text-ink-300">
          {t(
            'export.summary',
            frames,
            size.width,
            size.height,
            (frames / options.fps).toFixed(2),
            formatBytes(estimate),
          )}
        </p>

        {exporting.running ? (
          <div className="flex items-center gap-3">
            <Loader2 size={16} className="shrink-0 animate-spin text-accent-400" />
            <div className="flex-1">
              <ProgressBar
                ratio={
                  exporting.progress ? exporting.progress.done / Math.max(1, exporting.progress.total) : null
                }
                label={progressLabel()}
              />
            </div>
          </div>
        ) : null}

        {exporting.error ? (
          <p className="text-xs text-danger-400">
            {t('export.failed')}: {exporting.error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
