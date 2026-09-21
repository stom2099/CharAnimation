import { useEffect } from 'react';
import { Pause, Play } from 'lucide-react';
import { useProject } from '../../store/project';
import { useT } from '../../i18n';
import { SegmentedControl } from '../common/SegmentedControl';

export function Timeline() {
  const playing = useProject((s) => s.playing);
  const setPlaying = useProject((s) => s.setPlaying);
  const time = useProject((s) => s.time);
  const setTime = useProject((s) => s.setTime);
  const params = useProject((s) => s.params);
  const background = useProject((s) => s.previewBackground);
  const previewColor = useProject((s) => s.previewColor);
  const setBackground = useProject((s) => s.setPreviewBackground);
  const showPivot = useProject((s) => s.showPivot);
  const togglePivot = useProject((s) => s.toggleShowPivot);
  const t = useT();

  // Keyboard: space toggles playback, arrows step a frame at 24 fps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(!useProject.getState().playing);
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = (e.code === 'ArrowRight' ? 1 : -1) / 24;
        const loop = useProject.getState().params.loopSeconds;
        const next = (useProject.getState().time + step + loop) % loop;
        setPlaying(false);
        setTime(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlaying, setTime]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? t('anim.pause') : t('anim.play')}
        data-testid="play-toggle"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-500 text-ink-950 hover:bg-accent-400"
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      <input
        type="range"
        min={0}
        max={params.loopSeconds}
        step={0.01}
        value={Math.min(time, params.loopSeconds)}
        aria-label={t('anim.loop')}
        onChange={(e) => {
          setPlaying(false);
          setTime(Number(e.target.value));
        }}
        className="min-w-[120px] flex-1"
      />

      <span className="shrink-0 font-mono text-xs tabular-nums text-ink-400">
        {time.toFixed(2)} / {params.loopSeconds.toFixed(1)}
        {t('common.seconds')}
      </span>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <div className="min-w-[190px] flex-1">
          <SegmentedControl
            value={background}
            options={[
              { value: 'checker' as const, label: t('anim.bg.checker') },
              { value: 'dark' as const, label: t('anim.bg.dark') },
              { value: 'light' as const, label: t('anim.bg.light') },
              { value: 'color' as const, label: t('anim.bg.color') },
            ]}
            onChange={(value) => setBackground(value)}
          />
        </div>
        {background === 'color' ? (
          <input
            type="color"
            value={previewColor}
            aria-label={t('anim.bg.color')}
            onChange={(e) => setBackground('color', e.target.value)}
          />
        ) : null}
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={showPivot}
            onChange={togglePivot}
            className="accent-teal-500"
          />
          {t('anim.showPivot')}
        </label>
      </div>
    </div>
  );
}
