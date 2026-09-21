import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useProject } from '../../store/project';
import { hasMessage, useT } from '../../i18n';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
} as const;

const TONES = {
  info: 'border-ink-600 text-ink-100',
  success: 'border-accent-500 text-accent-300',
  error: 'border-danger-400 text-danger-400',
} as const;

/**
 * A toast message is either plain text or an i18n key with `|`-separated
 * arguments. That lets the store raise translated messages without importing
 * the dictionary, while raw error text still passes through untouched.
 */
function render(message: string, t: ReturnType<typeof useT>): string {
  const [key, ...args] = message.split('|');
  return hasMessage(key) ? t(key, ...args) : message;
}

export function Toasts() {
  const toasts = useProject((s) => s.toasts);
  const dismiss = useProject((s) => s.dismissToast);
  const t = useT();

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={`panel pointer-events-auto flex max-w-lg items-start gap-2.5 border px-3.5 py-2.5 text-sm shadow-lg ${TONES[toast.kind]}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 text-ink-100">{render(toast.message, t)}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded p-0.5 text-ink-400 hover:text-ink-100"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
