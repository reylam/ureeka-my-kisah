import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes/router';
import { useAuthStore } from '@/stores/authStore';
import { registerServiceWorker } from '@/utils/registerServiceWorker';
// Self-hosted variable font, so the offline build keeps its typography and no
// request leaves the device. Referenced by `--font-sans` as 'Inter Variable'.
import '@fontsource-variable/inter/index.css';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root was not found in index.html');

const root = createRoot(container);

// Restore the Supabase session before the first render, so a reload on a
// protected page does not flash the sign-in screen first. If the check itself
// fails (server unreachable), the app still opens, signed out.
void useAuthStore
  .getState()
  .init()
  .catch(() => undefined)
  .finally(() => {
    root.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });

registerServiceWorker();
