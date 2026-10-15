import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes/router';
import { registerServiceWorker } from '@/utils/registerServiceWorker';
// Self-hosted variable font, so the offline build keeps its typography and no
// request leaves the device. Referenced by `--font-sans` as 'Inter Variable'.
import '@fontsource-variable/inter/index.css';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root was not found in index.html');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

registerServiceWorker();
