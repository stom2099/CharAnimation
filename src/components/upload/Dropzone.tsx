import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, ShieldCheck } from 'lucide-react';
import { useProject } from '../../store/project';
import { useT } from '../../i18n';
import { Button } from '../common/Button';
import { SampleGallery } from './SampleGallery';

export function Dropzone() {
  const loadFile = useProject((s) => s.loadFile);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const accept = useCallback(
    async (file: File | Blob, name: string) => {
      setBusy(true);
      try {
        await loadFile(file, name);
      } catch {
        /* the store has already raised a toast */
      } finally {
        setBusy(false);
      }
    },
    [loadFile],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) void accept(file, file.name || 'pasted');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [accept]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void accept(file, file.name);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragging ? 'border-accent-400 bg-accent-900/20' : 'border-ink-600 bg-ink-850'
        }`}
      >
        {busy ? (
          <>
            <Loader2 size={30} className="animate-spin text-accent-400" />
            <p className="text-sm text-ink-300">{t('upload.loading')}</p>
          </>
        ) : (
          <>
            <ImagePlus size={30} className="text-ink-400" />
            <div>
              <p className="text-base font-semibold">{t('upload.headline')}</p>
              <p className="mt-1 text-xs text-ink-400">{t('upload.sub')}</p>
            </div>
            <Button variant="primary" size="md" onClick={() => inputRef.current?.click()}>
              {t('upload.browse')}
            </Button>
            <p className="text-[11px] text-ink-500">{t('upload.paste')}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void accept(file, file.name);
            e.target.value = '';
          }}
        />
      </div>

      <SampleGallery onPick={accept} />

      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-500">
        <ShieldCheck size={13} />
        {t('app.privacy')}
      </p>
    </div>
  );
}
