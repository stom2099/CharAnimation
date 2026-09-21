/// <reference lib="webworker" />
import { ImglyRemover } from './imgly.adapter';
import { TransformersRemover } from './transformers.adapter';
import type { AdapterId, BackgroundRemover, RemovalProgress } from './types';

export type WorkerRequest = { type: 'remove'; id: number; blob: Blob; adapter: AdapterId };

export type WorkerResponse =
  | { type: 'progress'; id: number; progress: RemovalProgress }
  | { type: 'result'; id: number; blob: Blob }
  | { type: 'error'; id: number; message: string };

const cache = new Map<AdapterId, BackgroundRemover>();

function getRemover(id: AdapterId): BackgroundRemover {
  let remover = cache.get(id);
  if (!remover) {
    remover = id === 'transformers' ? new TransformersRemover() : new ImglyRemover();
    cache.set(id, remover);
  }
  return remover;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type !== 'remove') return;

  const post = (response: WorkerResponse) => self.postMessage(response);

  try {
    const blob = await getRemover(msg.adapter).remove(msg.blob, (progress) =>
      post({ type: 'progress', id: msg.id, progress }),
    );
    post({ type: 'result', id: msg.id, blob });
  } catch (error) {
    post({
      type: 'error',
      id: msg.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
