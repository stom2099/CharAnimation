import { zipSync } from 'fflate';
import type { ExportFile } from './types';

/** Triggers a browser download for a blob, cleaning up the object URL after. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadFiles(files: ExportFile[]): void {
  files.forEach((file, i) => {
    // Browsers throttle simultaneous downloads; stagger them slightly.
    setTimeout(() => downloadBlob(file.blob, file.name), i * 350);
  });
}

export async function zipFiles(files: ExportFile[], zipName: string): Promise<ExportFile> {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  const zipped = zipSync(entries, { level: 6 });
  return {
    name: zipName,
    blob: new Blob([zipped.slice().buffer as ArrayBuffer], { type: 'application/zip' }),
  };
}
