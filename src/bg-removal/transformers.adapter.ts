import type { BackgroundRemover, ProgressFn } from './types';
import { RemovalAbortedError, RemovalFailedError } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Permissively licensed alternative built on Transformers.js (Apache-2.0) with
 * the MIT-licensed BiRefNet-lite matting model.
 *
 * The dependency is optional: it is resolved at runtime through a computed
 * specifier so the bundler never tries to include it unless the project
 * actually installs it. Select it with `VITE_BG_ADAPTER=transformers` after
 * running `npm install @huggingface/transformers`.
 */
export class TransformersRemover implements BackgroundRemover {
  readonly id = 'transformers' as const;

  constructor(private modelId = 'onnx-community/BiRefNet_lite-ONNX') {}

  async remove(input: Blob, onProgress: ProgressFn, signal?: AbortSignal): Promise<Blob> {
    if (signal?.aborted) throw new RemovalAbortedError();
    onProgress({ stage: 'loading-model', ratio: null, detail: this.modelId });

    try {
      const specifier = ['@huggingface', 'transformers'].join('/');
      const lib: any = await import(/* @vite-ignore */ specifier);
      const { AutoModel, AutoProcessor, RawImage, env } = lib;
      env.allowLocalModels = false;

      const device = typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
      const model = await AutoModel.from_pretrained(this.modelId, {
        device,
        dtype: device === 'webgpu' ? 'fp16' : 'q8',
        progress_callback: (p: { status: string; progress?: number; file?: string }) => {
          if (p.status === 'progress') {
            onProgress({
              stage: 'loading-model',
              ratio: typeof p.progress === 'number' ? p.progress / 100 : null,
              detail: p.file,
            });
          }
        },
      });
      const processor = await AutoProcessor.from_pretrained(this.modelId);

      if (signal?.aborted) throw new RemovalAbortedError();
      onProgress({ stage: 'processing', ratio: null });

      const image = await RawImage.fromBlob(input);
      const { pixel_values } = await processor(image);
      const { output } = await model({ input: pixel_values });
      const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(
        image.width,
        image.height,
      );

      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image.toCanvas(), 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height);
      for (let i = 0; i < mask.data.length; i++) pixels.data[i * 4 + 3] = mask.data[i];
      ctx.putImageData(pixels, 0, 0);

      if (signal?.aborted) throw new RemovalAbortedError();
      onProgress({ stage: 'done', ratio: 1 });
      return canvas.convertToBlob({ type: 'image/png' });
    } catch (error) {
      if (signal?.aborted) throw new RemovalAbortedError();
      throw new RemovalFailedError(
        error instanceof Error ? error.message : 'Background removal failed',
        error,
      );
    }
  }
}
