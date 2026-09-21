export type RemovalStage = 'idle' | 'loading-model' | 'processing' | 'done' | 'error';

export interface RemovalProgress {
  stage: RemovalStage;
  /** 0..1 when known, otherwise null for an indeterminate step. */
  ratio: number | null;
  /** Free-form detail, e.g. the asset currently downloading. */
  detail?: string;
  bytesLoaded?: number;
  bytesTotal?: number;
}

export type ProgressFn = (progress: RemovalProgress) => void;

export type AdapterId = 'imgly' | 'transformers';

export interface BackgroundRemover {
  readonly id: AdapterId;
  /** Returns a PNG blob with a straight-alpha matte. */
  remove(input: Blob, onProgress: ProgressFn, signal?: AbortSignal): Promise<Blob>;
}

export class RemovalAbortedError extends Error {
  constructor() {
    super('Background removal was cancelled');
    this.name = 'RemovalAbortedError';
  }
}

export class RemovalFailedError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RemovalFailedError';
  }
}
