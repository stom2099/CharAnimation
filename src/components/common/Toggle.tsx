import { useId } from 'react';

interface Props {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, description, disabled }: Props) {
  const id = useId();
  return (
    <div className={`flex items-start gap-3 ${disabled ? 'opacity-45' : ''}`}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-accent-400 bg-accent-500' : 'border-ink-600 bg-ink-700'
        } disabled:cursor-not-allowed`}
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full bg-ink-950 transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-sm text-ink-100">{label}</span>
        {description ? <span className="block text-xs text-ink-400">{description}</span> : null}
      </label>
    </div>
  );
}
