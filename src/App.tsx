import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Dropzone } from './components/upload/Dropzone';
import { MatteStep } from './components/bg/MatteStep';
import { AnimateStep } from './components/anim/AnimateStep';
import { RecentDialog } from './components/recent/RecentDialog';
import { Toasts } from './components/common/Toasts';
import { useProject } from './store/project';
import { useLocale } from './i18n';

export default function App() {
  const step = useProject((s) => s.step);
  const locale = useLocale((s) => s.locale);
  const [recentOpen, setRecentOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <>
      <AppShell onOpenRecent={() => setRecentOpen(true)}>
        {step === 'upload' ? (
          <div className="flex h-full items-center justify-center py-6">
            <Dropzone />
          </div>
        ) : null}
        {step === 'matte' ? <MatteStep /> : null}
        {step === 'animate' ? <AnimateStep /> : null}
      </AppShell>
      <RecentDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
      <Toasts />
    </>
  );
}
