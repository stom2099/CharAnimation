import { create } from 'zustand';
import { vi, type MessageKey } from './vi';
import { en } from './en';

export type Locale = 'vi' | 'en';

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { vi, en };
const STORAGE_KEY = 'charanim:locale';

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    /* private mode: fall through to the language header */
  }
  if (typeof navigator !== 'undefined' && !navigator.language?.toLowerCase().startsWith('vi')) {
    return 'en';
  }
  return 'vi';
}

interface LocaleStore {
  locale: Locale;
  setLocale(locale: Locale): void;
}

export const useLocale = create<LocaleStore>((set) => ({
  locale: detectLocale(),
  setLocale(locale) {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* storage is optional */
    }
    document.documentElement.lang = locale;
    set({ locale });
  },
}));

/** `t('export.summary', 48, 512, 512)` — positional `{0}`, `{1}`, … placeholders. */
export function translate(locale: Locale, key: MessageKey, ...args: (string | number)[]): string {
  const template = DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? key;
  if (args.length === 0) return template;
  return template.replace(/\{(\d+)\}/g, (match, i) => {
    const value = args[Number(i)];
    return value === undefined ? match : String(value);
  });
}

export function useT() {
  const locale = useLocale((s) => s.locale);
  return (key: MessageKey, ...args: (string | number)[]) => translate(locale, key, ...args);
}

export type { MessageKey };
