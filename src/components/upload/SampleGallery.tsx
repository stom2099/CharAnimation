import { useState } from 'react';
import { useT } from '../../i18n';

const SAMPLES = [
  { file: 'cat.png', label: 'Cat' },
  { file: 'plant.png', label: 'Plant' },
  { file: 'balloon.png', label: 'Balloon' },
] as const;

interface Props {
  onPick(file: Blob, name: string): void | Promise<void>;
}

export function SampleGallery({ onPick }: Props) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const base = import.meta.env.BASE_URL;

  return (
    <div>
      <p className="mb-2 text-center text-xs text-ink-400">{t('upload.samples')}</p>
      <div className="flex justify-center gap-3">
        {SAMPLES.map((sample) => (
          <button
            key={sample.file}
            type="button"
            disabled={busy !== null}
            data-testid={`sample-${sample.file.replace('.png', '')}`}
            onClick={async () => {
              setBusy(sample.file);
              try {
                const response = await fetch(`${base}samples/${sample.file}`);
                const blob = await response.blob();
                await onPick(blob, sample.file);
              } finally {
                setBusy(null);
              }
            }}
            className={`checker h-24 w-24 overflow-hidden rounded-xl border transition-colors ${
              busy === sample.file ? 'border-accent-400' : 'border-ink-700 hover:border-ink-500'
            }`}
          >
            <img
              src={`${base}samples/${sample.file}`}
              alt={sample.label}
              className="h-full w-full object-contain p-1.5"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
