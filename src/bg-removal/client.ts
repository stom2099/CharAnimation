import type { AdapterId, ProgressFn } from './types';
import { RemovalAbortedError, RemovalFailedError } from './types';
import type { WorkerRequest, WorkerResponse } from './worker';

/**
 * Main-thread facade for background removal.
 *
 * Inference runs in a worker so a slow WASM pass never freezes the UI.
 * Cancelling terminates the worker outright — ONNX sessions cannot be
 * interrupted mid-run, and a fresh worker is cheap compared to a stuck tab.
 */

export function configuredAdapter(): AdapterId {
  const configured = import.meta.env?.VITE_BG_ADAPTER;
  return configured === 'transformers' ? 'transformers' : 'imgly';
}

let worker: Worker | null = null;
let nextId = 1;

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      name: 'charanim-bg-removal',
    });
  }
  return worker;
}

export function disposeWorker(): void {
  worker?.terminate();
  worker = null;
}

export function removeBackground(
  blob: Blob,
  onProgress: ProgressFn,
  signal?: AbortSignal,
  adapter: AdapterId = configuredAdapter(),
): Promise<Blob> {
  const active = ensureWorker();
  const id = nextId++;

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      active.removeEventListener('message', onMessage);
      active.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.id !== id) return;
      if (msg.type === 'progress') {
        onProgress(msg.progress);
      } else if (msg.type === 'result') {
        cleanup();
        resolve(msg.blob);
      } else {
        cleanup();
        reject(new RemovalFailedError(msg.message));
      }
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(new RemovalFailedError(event.message || 'Background removal worker crashed'));
    };

    const onAbort = () => {
      cleanup();
      disposeWorker();
      reject(new RemovalAbortedError());
    };

    active.addEventListener('message', onMessage);
    active.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });

    const request: WorkerRequest = { type: 'remove', id, blob, adapter };
    active.postMessage(request);
  });
}

export { RemovalAbortedError, RemovalFailedError };
export type { ProgressFn, RemovalProgress, RemovalStage } from './types';
