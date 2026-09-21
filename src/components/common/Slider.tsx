import { useId } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
  format?(value: number): string;
  disabled?: boolean;
  hint?: string;
}

export function Slider({ label, value, min, max, step, onChange, format, disabled, hint }: Props) {
  const id = useId();
  const display = format ? format(value) : String(Math.round(value * 1000) / 1000);

  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-ink-300">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-xs tabular-nums text-ink-200">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <p className="-mt-1 text-[11px] leading-tight text-ink-500">{hint}</p> : null}
    </div>
  );
}
