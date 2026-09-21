interface Option<T extends string | number> {
  value: T;
  label: string;
  title?: string;
}

interface Props<T extends string | number> {
  label?: string;
  value: T;
  options: readonly Option<T>[];
  onChange(value: T): void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: Props<T>) {
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      {label ? <span className="mb-1 block text-xs text-ink-300">{label}</span> : null}
      <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-ink-600 bg-ink-800 p-0.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.title}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                active ? 'bg-accent-500 font-semibold text-ink-950' : 'text-ink-300 hover:bg-ink-700'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
