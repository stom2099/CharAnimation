import type { BackgroundRemover, ProgressFn } from './types';
import { RemovalAbortedError, RemovalFailedError } from './types';

/**
 * Background removal through `@imgly/background-removal`.
 *
 * Runs the ISNet matting model on WebGPU where available and on WASM
 * otherwise. Model weights are fetched once and then served from the service
 * worker cache, so repeat visits work offline.
 *
 * Licensing note: the package is AGPL-3.0. `VITE_BG_ADAPTER=transformers`
 * switches to the permissively licensed alternative — see docs/ARCHITECTURE.md.
 */
export class ImglyRemover implements BackgroundRemover {
  readonly id = 'imgly' as const;

  async remove(input: Blob, onProgress: ProgressFn, signal?: AbortSignal): Promise<Blob> {
    if (signal?.aborted) throw new RemovalAbortedError();

    onProgress({ stage: 'loading-model', ratio: null, detail: 'imgly/isnet' });

    const { removeBackground } = await import('@imgly/background-removal');
    const useGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;

    const totals = new Map<string, { loaded: number; total: number }>();
    let started = false;

    try {
      const result = await removeBackground(input, {
        model: 'isnet_fp16',
        device: useGpu ? 'gpu' : 'cpu',
        output: { format: 'image/png' },
        progress: (key: string, current: number, total: number) => {
          if (signal?.aborted) return;
          if (key.startsWith('compute:') || key.startsWith('process:')) {
            if (!started) {
              started = true;
              onProgress({ stage: 'processing', ratio: null });
            }
            return;
          }
          totals.set(key, { loaded: current, total });
          let loaded = 0;
          let sum = 0;
          for (const entry of totals.values()) {
            loaded += entry.loaded;
            sum += entry.total;
          }
          onProgress({
            stage: 'loading-model',
            ratio: sum > 0 ? Math.min(1, loaded / sum) : null,
            detail: key.split(':').pop(),
            bytesLoaded: loaded,
            bytesTotal: sum,
          });
        },
      });

      if (signal?.aborted) throw new RemovalAbortedError();
      onProgress({ stage: 'done', ratio: 1 });
      return result;
    } catch (error) {
      if (signal?.aborted) throw new RemovalAbortedError();
      throw new RemovalFailedError(
        error instanceof Error ? error.message : 'Background removal failed',
        error,
      );
    }
  }
}
