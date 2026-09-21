import { useEffect, useRef, useState } from 'react';
import { FileDown, FileUp, Trash2 } from 'lucide-react';
import {
  deleteProject,
  listProjects,
  packProjectBundle,
  readProjectBundle,
  toProjectFile,
  type ProjectSummary,
} from '../../store/persistence';
import { downloadBlob } from '../../export';
import { useProject } from '../../store/project';
import { useT } from '../../i18n';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface Props {
  open: boolean;
  onClose(): void;
}

export function RecentDialog({ open, onClose }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const restore = useProject((s) => s.restore);
  const hasCutout = useProject((s) => s.cutout !== null);
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listProjects().then((list) => {
      if (cancelled) return;
      setProjects(list);
      const map: Record<string, string> = {};
      for (const p of list) if (p.thumbnail) map[p.id] = URL.createObjectURL(p.thumbnail);
      setUrls(map);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(
    () => () => {
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    },
    [urls],
  );

  return (
    <Modal open={open} title={t('recent.title')} onClose={onClose} width="max-w-xl">
      {projects.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">{t('recent.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-800 p-2"
            >
              <span className="checker h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                {urls[project.id] ? (
                  <img src={urls[project.id]} alt="" className="h-full w-full object-contain" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{project.name}</span>
                <span className="block text-[11px] text-ink-500">
                  {new Date(project.updatedAt).toLocaleString()}
                </span>
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  if (await restore(project.id)) onClose();
                }}
              >
                {t('recent.open')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label={t('recent.delete')}
                icon={<Trash2 size={14} />}
                onClick={async () => {
                  await deleteProject(project.id);
                  setProjects((list) => list.filter((p) => p.id !== project.id));
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
        <Button
          size="sm"
          variant="secondary"
          data-testid="save-project-file"
          icon={<FileDown size={14} />}
          disabled={!hasCutout}
          onClick={async () => {
            const s = useProject.getState();
            if (!s.cutout) return;
            const file = toProjectFile({
              name: s.sourceName,
              presetId: s.presetId,
              params: s.params,
              exportOptions: s.exportOptions,
            });
            const stem = s.sourceName.replace(/\.[a-z0-9]+$/i, '') || 'charanim';
            downloadBlob(await packProjectBundle(file, s.cutout.blob), `${stem}.charanim.zip`);
          }}
        >
          {t('project.export')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          data-testid="open-project-file"
          icon={<FileUp size={14} />}
          onClick={() => fileRef.current?.click()}
        >
          {t('project.import')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const store = useProject.getState();
            try {
              await store.adoptBundle(await readProjectBundle(file));
              store.pushToast('success', t('project.imported'));
              onClose();
            } catch (error) {
              store.pushToast('error', error instanceof Error ? error.message : String(error));
            }
          }}
        />
      </div>
      <p className="mt-3 text-[11px] text-ink-500">
        {t('project.exportHint')} {t('recent.note')}
      </p>
    </Modal>
  );
}
