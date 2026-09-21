import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  FREQS,
  LIMITS,
  MODIFIER_KEYS,
  cloneParams,
  getPreset,
  type ModifierKey,
} from '../../engine';
import { useProject } from '../../store/project';
import { useT, type MessageKey } from '../../i18n';
import { Slider } from '../common/Slider';
import { Toggle } from '../common/Toggle';
import { SegmentedControl } from '../common/SegmentedControl';
import { Button } from '../common/Button';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const deg = (n: number) => `${n.toFixed(1)}°`;
const sec = (n: number) => `${n.toFixed(1)}s`;

function ModifierSection({ id }: { id: ModifierKey }) {
  const params = useProject((s) => s.params);
  const patch = useProject((s) => s.patchModifier);
  const t = useT();
  const mod = params[id];
  const [open, setOpen] = useState(mod.enabled);

  const freqOptions = FREQS.map((f) => ({ value: f, label: String(f) }));
  const shapeOptions = [
    { value: 'sine' as const, label: t('field.shape.sine') },
    { value: 'bounce' as const, label: t('field.shape.bounce') },
  ];

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-850">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Toggle
          label={t(`mod.${id}` as MessageKey)}
          description={t(`mod.${id}.desc` as MessageKey)}
          checked={mod.enabled}
          onChange={(enabled) => {
            patch(id, { enabled } as never);
            if (enabled) setOpen(true);
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('anim.advanced')}
          className="ml-auto shrink-0 rounded-md p-1 text-ink-400 hover:bg-ink-700 hover:text-ink-100"
        >
          <ChevronDown size={16} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-ink-700 px-3 py-3">
          {id === 'sway' && (
            <>
              <Slider
                label={t('field.amountDeg')}
                value={params.sway.amountDeg}
                min={LIMITS.swayDeg.min}
                max={LIMITS.swayDeg.max}
                step={LIMITS.swayDeg.step}
                format={deg}
                onChange={(amountDeg) => patch('sway', { amountDeg })}
              />
              <Slider
                label={t('field.falloff')}
                value={params.sway.falloff}
                min={LIMITS.falloff.min}
                max={LIMITS.falloff.max}
                step={LIMITS.falloff.step}
                onChange={(falloff) => patch('sway', { falloff })}
              />
              <Slider
                label={t('field.ease')}
                value={params.sway.ease}
                min={LIMITS.ease.min}
                max={LIMITS.ease.max}
                step={LIMITS.ease.step}
                onChange={(ease) => patch('sway', { ease })}
              />
              <SegmentedControl
                label={t('field.shape')}
                value={params.sway.shape}
                options={shapeOptions}
                onChange={(shape) => patch('sway', { shape })}
              />
            </>
          )}

          {id === 'wind' && (
            <>
              <Slider
                label={t('field.amount')}
                value={params.wind.amount}
                min={LIMITS.fraction.min}
                max={LIMITS.fraction.max}
                step={LIMITS.fraction.step}
                format={pct}
                onChange={(amount) => patch('wind', { amount })}
              />
              <Slider
                label={t('field.wavelength')}
                value={params.wind.wavelength}
                min={LIMITS.wavelength.min}
                max={LIMITS.wavelength.max}
                step={LIMITS.wavelength.step}
                onChange={(wavelength) => patch('wind', { wavelength })}
              />
              <Slider
                label={t('field.falloff')}
                value={params.wind.falloff}
                min={LIMITS.falloff.min}
                max={LIMITS.falloff.max}
                step={LIMITS.falloff.step}
                onChange={(falloff) => patch('wind', { falloff })}
              />
            </>
          )}

          {id === 'wiggle' && (
            <>
              <Slider
                label={t('field.amount')}
                value={params.wiggle.amount}
                min={LIMITS.fraction.min}
                max={LIMITS.fraction.max}
                step={LIMITS.fraction.step}
                format={pct}
                onChange={(amount) => patch('wiggle', { amount })}
              />
              <Slider
                label={t('field.scaleU')}
                value={params.wiggle.scaleU}
                min={LIMITS.scale.min}
                max={LIMITS.scale.max}
                step={LIMITS.scale.step}
                onChange={(scaleU) => patch('wiggle', { scaleU })}
              />
              <Slider
                label={t('field.scaleV')}
                value={params.wiggle.scaleV}
                min={LIMITS.scale.min}
                max={LIMITS.scale.max}
                step={LIMITS.scale.step}
                onChange={(scaleV) => patch('wiggle', { scaleV })}
              />
            </>
          )}

          {id === 'breathe' && (
            <>
              <Slider
                label={t('field.amountY')}
                value={params.breathe.amountY}
                min={-LIMITS.fraction.max}
                max={LIMITS.fraction.max}
                step={LIMITS.fraction.step}
                format={pct}
                onChange={(amountY) => patch('breathe', { amountY })}
              />
              <Slider
                label={t('field.amountX')}
                value={params.breathe.amountX}
                min={-LIMITS.fraction.max}
                max={LIMITS.fraction.max}
                step={LIMITS.fraction.step}
                format={pct}
                disabled={params.breathe.preserveVolume}
                onChange={(amountX) => patch('breathe', { amountX })}
              />
              <Toggle
                label={t('field.preserveVolume')}
                checked={params.breathe.preserveVolume}
                onChange={(preserveVolume) => patch('breathe', { preserveVolume })}
              />
              <SegmentedControl
                label={t('field.shape')}
                value={params.breathe.shape}
                options={shapeOptions}
                onChange={(shape) => patch('breathe', { shape })}
              />
            </>
          )}

          {id === 'bob' && (
            <>
              <Slider
                label={t('field.amountY')}
                value={params.bob.amountY}
                min={-LIMITS.fraction.max}
                max={LIMITS.fraction.max}
                step={LIMITS.fraction.step}
                format={pct}
                onChange={(amountY) => patch('bob', { amountY })}
              />
              <Slider
                label={t('field.amountX')}
                value={params.bob.amountX}
                min={-LIMITS.fraction.max}
                max={LIMITS.fraction.max}
                step={LIMITS.fraction.step}
                format={pct}
                onChange={(amountX) => patch('bob', { amountX })}
              />
              <SegmentedControl
                label={t('field.shape')}
                value={params.bob.shape}
                options={shapeOptions}
                onChange={(shape) => patch('bob', { shape })}
              />
            </>
          )}

          {id === 'jitter' && (
            <Slider
              label={t('field.amount')}
              value={params.jitter.amount}
              min={LIMITS.smallFraction.min}
              max={LIMITS.smallFraction.max}
              step={LIMITS.smallFraction.step}
              format={pct}
              onChange={(amount) => patch('jitter', { amount })}
            />
          )}

          <SegmentedControl
            label={t('field.freq')}
            value={mod.freq}
            options={freqOptions}
            onChange={(freq) => patch(id, { freq } as never)}
          />
          <Slider
            label={t('field.phase')}
            value={mod.phase}
            min={LIMITS.phase.min}
            max={LIMITS.phase.max}
            step={LIMITS.phase.step}
            onChange={(phase) => patch(id, { phase } as never)}
          />
        </div>
      ) : null}
    </section>
  );
}

export function ParamPanel() {
  const params = useProject((s) => s.params);
  const presetId = useProject((s) => s.presetId);
  const patchParams = useProject((s) => s.patchParams);
  const applyPreset = useProject((s) => s.applyPreset);
  const resetPivot = useProject((s) => s.resetPivot);
  const t = useT();

  const canReset = presetId === 'custom' || getPreset(presetId) !== undefined;

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-3">
        <Slider
          label={t('anim.loop')}
          value={params.loopSeconds}
          min={LIMITS.loopSeconds.min}
          max={LIMITS.loopSeconds.max}
          step={LIMITS.loopSeconds.step}
          format={sec}
          onChange={(loopSeconds) => patchParams({ loopSeconds })}
        />
        <Slider
          label={t('anim.grid')}
          value={params.grid.cols}
          min={LIMITS.grid.min}
          max={LIMITS.grid.max}
          step={LIMITS.grid.step}
          onChange={(n) => patchParams({ grid: { cols: n, rows: n } })}
          hint={t('anim.pivotHint')}
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-ink-300">
            {t('anim.pivot')}{' '}
            <span className="font-mono text-ink-400">
              {params.pivot.pu.toFixed(2)}, {params.pivot.pv.toFixed(2)}
            </span>
          </span>
          <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={resetPivot}>
            {t('anim.pivotReset')}
          </Button>
        </div>
      </div>

      {MODIFIER_KEYS.map((key) => (
        <ModifierSection key={key} id={key} />
      ))}

      {canReset && presetId !== 'custom' ? (
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          icon={<RotateCcw size={13} />}
          onClick={() => applyPreset(presetId)}
        >
          {t('anim.reset')}
        </Button>
      ) : null}
      {presetId === 'custom' ? (
        <p className="px-1 text-[11px] text-ink-500">
          {t('preset.custom.desc')} ·{' '}
          <button
            type="button"
            className="underline hover:text-ink-300"
            onClick={() => {
              const preset = getPreset('sway')!;
              patchParams(cloneParams(preset.params));
              applyPreset('sway');
            }}
          >
            {t('anim.reset')}
          </button>
        </p>
      ) : null}
    </div>
  );
}
