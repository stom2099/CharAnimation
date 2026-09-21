import { create } from 'zustand';
import {
  cloneParams,
  getPreset,
  type AnimParams,
  type ModifierKey,
  type PresetId,
} from '../engine';
import {
  adoptCutout,
  buildCutout,
  decodeSource,
  EmptyCutoutError,
  ImageDecodeError,
  suggestPivot,
  type Cutout,
  type DecodedSource,
} from '../image/decode';
import { blobToImageData } from '../image/canvas';
import { decontaminateEdges, erodeAlpha, featherAlpha } from '../image/alpha';
import { removeBackground, RemovalAbortedError } from '../bg-removal/client';
import type { RemovalProgress } from '../bg-removal/types';
import { defaultExportOptions, type ExportOptions, type ExportProgress } from '../export';
import {
  loadProject,
  newProjectId,
  saveProject,
  type StoredProject,
} from './persistence';

export type Step = 'upload' | 'matte' | 'animate';

export interface MatteSettings {
  paddingRatio: number;
  erode: number;
  feather: number;
  decontaminate: boolean;
}

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
}

export interface ProjectState {
  id: string;
  step: Step;
  sourceName: string;

  source: DecodedSource | null;
  /** Straight-alpha RGBA after background removal (or the original if skipped). */
  matte: ImageData | null;
  cutout: Cutout | null;
  matteSettings: MatteSettings;
  skippedRemoval: boolean;

  removal: {
    running: boolean;
    progress: RemovalProgress | null;
    error: string | null;
    elapsedMs: number | null;
  };

  presetId: PresetId;
  params: AnimParams;

  playing: boolean;
  time: number;
  previewBackground: 'checker' | 'dark' | 'light' | 'color';
  previewColor: string;
  showPivot: boolean;
  /** Set once the user moves the pivot, so auto-suggestions stop overriding it. */
  dirtyPivot: boolean;

  exportOptions: ExportOptions;
  exporting: { running: boolean; progress: ExportProgress | null; error: string | null };

  toasts: Toast[];
  dirty: boolean;
}

export interface ProjectActions {
  reset(): void;
  loadFile(file: File | Blob, name: string): Promise<void>;
  runRemoval(): Promise<void>;
  cancelRemoval(): void;
  skipRemoval(): Promise<void>;
  rebuildCutout(patch?: Partial<MatteSettings>): Promise<void>;
  goToStep(step: Step): void;

  applyPreset(id: PresetId): void;
  patchParams(patch: Partial<AnimParams>): void;
  patchModifier<K extends ModifierKey>(key: K, patch: Partial<AnimParams[K]>): void;
  setPivot(pu: number, pv: number): void;
  resetPivot(): void;

  setPlaying(playing: boolean): void;
  setTime(time: number): void;
  setPreviewBackground(bg: ProjectState['previewBackground'], color?: string): void;
  toggleShowPivot(): void;

  patchExportOptions(patch: Partial<ExportOptions>): void;
  setExporting(state: Partial<ProjectState['exporting']>): void;

  pushToast(kind: Toast['kind'], message: string): void;
  dismissToast(id: number): void;

  persist(thumbnail?: Blob | null): Promise<void>;
  restore(id: string): Promise<boolean>;
}

export type ProjectStore = ProjectState & ProjectActions;

let removalController: AbortController | null = null;
let toastSeq = 1;

function initialState(): ProjectState {
  const preset = getPreset('sway')!;
  return {
    id: newProjectId(),
    step: 'upload',
    sourceName: 'charanim',
    source: null,
    matte: null,
    cutout: null,
    matteSettings: { paddingRatio: 0.18, erode: 0, feather: 1, decontaminate: true },
    skippedRemoval: false,
    removal: { running: false, progress: null, error: null, elapsedMs: null },
    presetId: preset.id,
    params: cloneParams(preset.params),
    playing: true,
    time: 0,
    previewBackground: 'checker',
    previewColor: '#0f766e',
    showPivot: true,
    dirtyPivot: false,
    exportOptions: defaultExportOptions(),
    exporting: { running: false, progress: null, error: null },
    toasts: [],
    dirty: false,
  };
}

/** Applies the matte clean-up settings to a fresh copy of the raw matte. */
function cleanMatte(raw: ImageData, settings: MatteSettings): ImageData {
  const copy = new ImageData(new Uint8ClampedArray(raw.data), raw.width, raw.height);
  const img = { data: copy.data, width: copy.width, height: copy.height };
  if (settings.decontaminate) decontaminateEdges(img, 2);
  if (settings.erode > 0) erodeAlpha(img, settings.erode);
  if (settings.feather > 0) featherAlpha(img, settings.feather);
  return copy;
}

export const useProject = create<ProjectStore>((set, get) => ({
  ...initialState(),

  reset() {
    removalController?.abort();
    removalController = null;
    set({ ...initialState() });
  },

  async loadFile(file, name) {
    try {
      const source = await decodeSource(file);
      set({
        source,
        sourceName: name || 'charanim',
        matte: null,
        cutout: null,
        skippedRemoval: false,
        removal: { running: false, progress: null, error: null, elapsedMs: null },
        step: 'matte',
        dirty: true,
      });
      if (source.downscaled) {
        get().pushToast(
          'info',
          `toast.downscaled|${source.originalWidth}x${source.originalHeight}|${source.width}x${source.height}`,
        );
      }
    } catch (error) {
      get().pushToast('error', describeError(error));
      throw error;
    }
  },

  async runRemoval() {
    const { source } = get();
    if (!source) return;

    removalController?.abort();
    removalController = new AbortController();
    const started = performance.now();
    set({ removal: { running: true, progress: null, error: null, elapsedMs: null } });

    try {
      const sourceBlob = await new Promise<Blob>((resolve, reject) => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = source.width;
          canvas.height = source.height;
          const ctx = canvas.getContext('2d')!;
          ctx.putImageData(source.image, 0, 0);
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
        } catch (error) {
          reject(error);
        }
      });

      const result = await removeBackground(
        sourceBlob,
        (progress) => set({ removal: { ...get().removal, progress } }),
        removalController.signal,
      );

      const matte = await blobToImageData(result);
      set({
        matte,
        skippedRemoval: false,
        removal: {
          running: false,
          progress: { stage: 'done', ratio: 1 },
          error: null,
          elapsedMs: performance.now() - started,
        },
      });
      await get().rebuildCutout();
    } catch (error) {
      if (error instanceof RemovalAbortedError) {
        set({ removal: { running: false, progress: null, error: null, elapsedMs: null } });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      set({ removal: { running: false, progress: null, error: message, elapsedMs: null } });
      get().pushToast('error', message);
    } finally {
      removalController = null;
    }
  },

  cancelRemoval() {
    removalController?.abort();
    removalController = null;
    set({ removal: { running: false, progress: null, error: null, elapsedMs: null } });
  },

  async skipRemoval() {
    const { source } = get();
    if (!source) return;
    set({
      matte: source.image,
      skippedRemoval: true,
      removal: { running: false, progress: null, error: null, elapsedMs: null },
    });
    await get().rebuildCutout();
  },

  async rebuildCutout(patch) {
    const state = get();
    const settings = { ...state.matteSettings, ...patch };
    const raw = state.matte;
    if (!raw) {
      set({ matteSettings: settings });
      return;
    }

    try {
      const cleaned = state.skippedRemoval ? raw : cleanMatte(raw, settings);
      const cutout = await buildCutout(cleaned, settings.paddingRatio);
      const params = cloneParams(state.params);
      const suggested = suggestPivot(cutout);
      // Keep a user-placed pivot; otherwise follow the subject.
      if (!state.dirtyPivot) {
        params.pivot =
          state.presetId === 'pendulum'
            ? { pu: suggested.pu, pv: 0 }
            : state.presetId === 'float'
              ? { pu: suggested.pu, pv: 0.5 }
              : suggested;
      }
      set({ cutout, matteSettings: settings, params, dirty: true });
    } catch (error) {
      set({ matteSettings: settings });
      get().pushToast('error', describeError(error));
    }
  },

  goToStep(step) {
    set({ step });
  },

  applyPreset(id) {
    const preset = getPreset(id);
    if (!preset) return;
    const state = get();
    const params = cloneParams(preset.params);
    if (state.cutout) {
      const suggested = suggestPivot(state.cutout);
      params.pivot = {
        pu: suggested.pu,
        pv: preset.params.pivot.pv === 1 ? suggested.pv : preset.params.pivot.pv,
      };
    }
    set({ presetId: id, params, time: 0, dirty: true, dirtyPivot: false });
  },

  patchParams(patch) {
    set({ params: { ...get().params, ...patch }, presetId: 'custom', dirty: true });
  },

  patchModifier(key, patch) {
    const params = get().params;
    set({
      params: { ...params, [key]: { ...params[key], ...patch } },
      presetId: 'custom',
      dirty: true,
    });
  },

  setPivot(pu, pv) {
    const params = get().params;
    set({
      params: { ...params, pivot: { pu: clamp01(pu), pv: clamp01(pv) } },
      dirty: true,
      dirtyPivot: true,
    });
  },

  resetPivot() {
    const { cutout, params } = get();
    if (!cutout) return;
    set({ params: { ...params, pivot: suggestPivot(cutout) }, dirtyPivot: false, dirty: true });
  },

  setPlaying(playing) {
    set({ playing });
  },

  setTime(time) {
    set({ time });
  },

  setPreviewBackground(previewBackground, color) {
    set({ previewBackground, ...(color ? { previewColor: color } : {}) });
  },

  toggleShowPivot() {
    set({ showPivot: !get().showPivot });
  },

  patchExportOptions(patch) {
    set({ exportOptions: { ...get().exportOptions, ...patch } });
  },

  setExporting(state) {
    set({ exporting: { ...get().exporting, ...state } });
  },

  pushToast(kind, message) {
    const toast: Toast = { id: toastSeq++, kind, message };
    set({ toasts: [...get().toasts, toast] });
    setTimeout(() => get().dismissToast(toast.id), kind === 'error' ? 8000 : 4500);
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  async persist(thumbnail = null) {
    const s = get();
    if (!s.cutout) return;
    const project: StoredProject = {
      id: s.id,
      name: s.sourceName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      presetId: s.presetId,
      params: s.params,
      exportOptions: s.exportOptions,
      cutout: s.cutout.blob,
      subject: s.cutout.subject,
      paddingRatio: s.cutout.paddingRatio,
      thumbnail,
      sourceName: s.sourceName,
    };
    await saveProject(project);
    set({ dirty: false });
  },

  async restore(id) {
    const stored = await loadProject(id);
    if (!stored) return false;
    try {
      const image = await blobToImageData(stored.cutout);
      const cutout = await adoptCutout(image, stored.subject, stored.paddingRatio);
      set({
        ...initialState(),
        id: stored.id,
        sourceName: stored.sourceName || stored.name,
        matte: image,
        cutout,
        skippedRemoval: true,
        presetId: stored.presetId,
        params: stored.params,
        exportOptions: stored.exportOptions,
        step: 'animate',
        dirtyPivot: true,
      });
      return true;
    } catch (error) {
      get().pushToast('error', error instanceof Error ? error.message : String(error));
      return false;
    }
  },
}));

/** Maps known failures onto message keys; anything else keeps its own text. */
function describeError(error: unknown): string {
  if (error instanceof ImageDecodeError) return `error.${error.code}`;
  if (error instanceof EmptyCutoutError) return 'matte.empty';
  return error instanceof Error ? error.message : String(error);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
