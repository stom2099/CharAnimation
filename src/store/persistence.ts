import { clear, del, get, keys, set } from 'idb-keyval';
import { normaliseParams, type AnimParams, type PresetId } from '../engine';
import { defaultExportOptions, type ExportOptions } from '../export';

/**
 * Local project storage.
 *
 * Everything lives in IndexedDB on the visitor's own machine — the app has no
 * server and never uploads an image anywhere.
 */

const PREFIX = 'charanim:project:';
export const MAX_PROJECTS = 12;

export interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  presetId: PresetId;
  params: AnimParams;
  exportOptions: ExportOptions;
  cutout: Blob;
  /** Subject bounds inside the stored cutout, so reopening keeps its margin. */
  subject?: { x: number; y: number; width: number; height: number };
  paddingRatio?: number;
  thumbnail: Blob | null;
  sourceName: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail: Blob | null;
}

export function newProjectId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveProject(project: StoredProject): Promise<void> {
  try {
    await set(PREFIX + project.id, project);
    await pruneOldProjects();
  } catch (error) {
    console.warn('[CharAnimation] Could not save the project locally:', error);
  }
}

export async function loadProject(id: string): Promise<StoredProject | null> {
  try {
    const raw = await get<StoredProject>(PREFIX + id);
    if (!raw) return null;
    return {
      ...raw,
      params: normaliseParams(raw.params),
      exportOptions: { ...defaultExportOptions(), ...(raw.exportOptions ?? {}) },
    };
  } catch (error) {
    console.warn('[CharAnimation] Could not read the project:', error);
    return null;
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  try {
    const all = await keys();
    const ids = all
      .filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length));

    const summaries = await Promise.all(
      ids.map(async (id) => {
        const p = await get<StoredProject>(PREFIX + id);
        if (!p) return null;
        return { id: p.id, name: p.name, updatedAt: p.updatedAt, thumbnail: p.thumbnail ?? null };
      }),
    );

    return summaries
      .filter((s): s is ProjectSummary => s !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.warn('[CharAnimation] Could not list projects:', error);
    return [];
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await del(PREFIX + id);
  } catch (error) {
    console.warn('[CharAnimation] Could not delete the project:', error);
  }
}

export async function clearProjects(): Promise<void> {
  try {
    await clear();
  } catch (error) {
    console.warn('[CharAnimation] Could not clear storage:', error);
  }
}

/** Keeps storage bounded so a long-running browser profile never fills up. */
async function pruneOldProjects(): Promise<void> {
  const summaries = await listProjects();
  if (summaries.length <= MAX_PROJECTS) return;
  await Promise.all(summaries.slice(MAX_PROJECTS).map((s) => deleteProject(s.id)));
}

export const PROJECT_FILE_VERSION = 1;

export interface ProjectFile {
  app: 'CharAnimation';
  version: number;
  name: string;
  presetId: PresetId;
  params: AnimParams;
  exportOptions: ExportOptions;
}

export function toProjectFile(project: {
  name: string;
  presetId: PresetId;
  params: AnimParams;
  exportOptions: ExportOptions;
}): ProjectFile {
  return {
    app: 'CharAnimation',
    version: PROJECT_FILE_VERSION,
    name: project.name,
    presetId: project.presetId,
    params: project.params,
    exportOptions: project.exportOptions,
  };
}

export const BUNDLE_JSON_ENTRY = 'project.json';
export const BUNDLE_IMAGE_ENTRY = 'cutout.png';

/**
 * Packs the parameters and the cut-out image into one shareable file.
 *
 * A bare JSON file only carries the settings, which is useless to someone who
 * does not already have the image. The zip is self-contained: open it on
 * another machine and the whole project is there.
 */
export async function packProjectBundle(file: ProjectFile, cutout: Blob): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const zipped = zipSync(
    {
      [BUNDLE_JSON_ENTRY]: new TextEncoder().encode(JSON.stringify(file, null, 2)),
      [BUNDLE_IMAGE_ENTRY]: new Uint8Array(await cutout.arrayBuffer()),
    },
    { level: 6 },
  );
  return new Blob([zipped.slice().buffer as ArrayBuffer], { type: 'application/zip' });
}

export interface LoadedBundle {
  file: ProjectFile;
  cutout: Blob | null;
}

/** Accepts either the zip bundle or a plain settings JSON. */
export async function readProjectBundle(input: Blob): Promise<LoadedBundle> {
  const head = new Uint8Array(await input.slice(0, 2).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;

  if (!isZip) return { file: parseProjectFile(await input.text()), cutout: null };

  const { unzipSync } = await import('fflate');
  const entries = unzipSync(new Uint8Array(await input.arrayBuffer()));
  const json = entries[BUNDLE_JSON_ENTRY];
  if (!json) throw new Error('The bundle has no project.json');
  const image = entries[BUNDLE_IMAGE_ENTRY];

  return {
    file: parseProjectFile(new TextDecoder().decode(json)),
    cutout: image ? new Blob([image.slice().buffer as ArrayBuffer], { type: 'image/png' }) : null,
  };
}

export function parseProjectFile(json: string): ProjectFile {
  const raw = JSON.parse(json) as Partial<ProjectFile>;
  if (raw.app !== 'CharAnimation') throw new Error('Not a CharAnimation project file');
  return {
    app: 'CharAnimation',
    version: typeof raw.version === 'number' ? raw.version : PROJECT_FILE_VERSION,
    name: typeof raw.name === 'string' ? raw.name : 'charanim',
    presetId: (raw.presetId ?? 'custom') as PresetId,
    params: normaliseParams(raw.params),
    exportOptions: { ...defaultExportOptions(), ...(raw.exportOptions ?? {}) },
  };
}
