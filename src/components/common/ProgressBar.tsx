interface Props {
  /** 0..1, or null for an indeterminate bar. */
  ratio: number | null;
  label?: string;
  detail?: string;
}

export function ProgressBar({ ratio, label, detail }: Props) {
  const pct = ratio === null ? null : Math.round(Math.min(1, Math.max(0, ratio)) * 100);

  return (
    <div className="w-full">
      {label || detail ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="text-ink-200">{label}</span>
          <span className="truncate font-mono text-ink-400">
            {pct === null ? (detail ?? '') : `${pct}%`}
          </span>
        </div>
      ) : null}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-label={label}
      >
        {pct === null ? (
          <div className="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-accent-500" />
        ) : (
          <div
            className="h-full rounded-full bg-accent-500 transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(320%); } }`}</style>
    </div>
  );
}
