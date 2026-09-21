import type { ReactNode } from 'react';
import { Check, Clock, Languages, Plus } from 'lucide-react';
import { useLocale, useT } from '../../i18n';
import { useProject, type Step } from '../../store/project';
import { Button } from '../common/Button';

const STEPS: { id: Step; labelKey: 'step.upload' | 'step.matte' | 'step.animate' }[] = [
  { id: 'upload', labelKey: 'step.upload' },
  { id: 'matte', labelKey: 'step.matte' },
  { id: 'animate', labelKey: 'step.animate' },
];

interface Props {
  children: ReactNode;
  onOpenRecent(): void;
}

export function AppShell({ children, onOpenRecent }: Props) {
  const step = useProject((s) => s.step);
  const source = useProject((s) => s.source);
  const cutout = useProject((s) => s.cutout);
  const goToStep = useProject((s) => s.goToStep);
  const reset = useProject((s) => s.reset);
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const t = useT();

  const reachable: Record<Step, boolean> = {
    upload: true,
    matte: Boolean(source),
    animate: Boolean(cutout),
  };
  const currentIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-500 text-sm font-bold text-ink-950">
            C
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">{t('app.title')}</h1>
            <p className="hidden text-[11px] text-ink-500 sm:block">{t('app.tagline')}</p>
          </div>
        </div>

        <nav aria-label="steps" className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < currentIndex;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!reachable[s.id]}
                onClick={() => goToStep(s.id)}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? 'bg-accent-900/60 font-semibold text-accent-300' : 'text-ink-400 hover:bg-ink-800'
                }`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                    done ? 'bg-accent-500 text-ink-950' : active ? 'bg-accent-400 text-ink-950' : 'bg-ink-700'
                  }`}
                >
                  {done ? <Check size={10} /> : i + 1}
                </span>
                {t(s.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<Clock size={14} />} onClick={onOpenRecent}>
            <span className="hidden sm:inline">{t('nav.recent')}</span>
          </Button>
          <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={reset}>
            <span className="hidden sm:inline">{t('nav.new')}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Languages size={14} />}
            aria-label={t('nav.language')}
            onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
          >
            {locale.toUpperCase()}
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
