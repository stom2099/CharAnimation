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
