import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { useProject } from './store/project';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support: the app shell and the matting model are cached after the
// first visit, so a returning visitor can work with no network at all.
registerSW({
  immediate: true,
  onOfflineReady() {
    useProject.getState().pushToast('success', 'toast.offlineReady');
  },
  onNeedRefresh() {
    useProject.getState().pushToast('info', 'toast.updated');
  },
});
