import { lazy, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireRole, RoleHome } from './RequireAuth';
import { RouteError } from './RouteError';
import { LoginPage } from '@/pages/LoginPage';
import { TraceLayout } from '@/trace/components/layout/TraceLayout';
import { TraceHome } from '@/trace/pages/Home';
import type { AccountRole } from '@/types/account';

/**
 * Route table, in two halves.
 *
 * Public, no account: the explainer site, the model demo, and the patient's
 * two pages, the request form (`/daftar`) and the status page (`/hasil`).
 *
 * Staff, behind sign-in: the requests list, the queue, the radiologist's
 * examination, and the administrator's patient records.
 *
 * The home and sign-in pages load eagerly because one of them is almost always
 * the first paint; everything else is code-split. Each staff route carries a
 * `crumbs` handle that the top bar reads.
 */

const page = <T,>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((module) => ({ default: module[name] as React.ComponentType })));

const TraceHowItWorks = page(() => import('@/trace/pages/HowItWorks'), 'TraceHowItWorks');
const TraceModelDemo = page(() => import('@/trace/pages/ModelDemo'), 'TraceModelDemo');
const RequestFormPage = page(() => import('@/pages/RequestFormPage'), 'RequestFormPage');
const PatientResultPage = page(() => import('@/pages/PatientResultPage'), 'PatientResultPage');

const RequestsPage = page(() => import('@/pages/RequestsPage'), 'RequestsPage');
const QueuePage = page(() => import('@/pages/QueuePage'), 'QueuePage');
const ExaminePage = page(() => import('@/pages/ExaminePage'), 'ExaminePage');
const ScreeningResultPage = page(() => import('@/pages/ScreeningResultPage'), 'ScreeningResultPage');
const PatientsPage = page(() => import('@/pages/PatientsPage'), 'PatientsPage');
const PatientDetailPage = page(() => import('@/pages/PatientDetailPage'), 'PatientDetailPage');
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

const only = (roles: AccountRole[], element: ReactNode) => <RequireRole roles={roles}>{element}</RequireRole>;

export const router = createBrowserRouter([
  {
    element: <TraceLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <TraceHome /> },
      { path: '/how-it-works', element: <TraceHowItWorks /> },
      { path: '/demo', element: <TraceModelDemo /> },
      { path: '/daftar', element: <RequestFormPage /> },
      { path: '/hasil', element: <PatientResultPage /> },
    ],
  },
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  { path: '/app', element: <RoleHome />, errorElement: <RouteError /> },

  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { path: 'requests', element: <RequestsPage />, handle: { crumbs: [{ label: 'Pendaftaran' }] } },
      { path: 'queue', element: <QueuePage />, handle: { crumbs: [{ label: 'Antrean' }] } },
      {
        path: 'screenings/:screeningId',
        element: <ScreeningResultPage />,
        handle: { crumbs: [{ label: 'Antrean', to: '/queue' }, { label: 'Hasil screening' }] },
      },
      {
        path: 'screenings/:screeningId/examine',
        element: only(['radiologist'], <ExaminePage />),
        handle: { crumbs: [{ label: 'Pendaftaran', to: '/requests' }, { label: 'Pemeriksaan' }] },
      },
      {
        path: 'patients',
        element: only(['admin'], <PatientsPage />),
        handle: { crumbs: [{ label: 'Pasien' }] },
      },
      {
        path: 'patients/:patientId',
        element: only(['admin'], <PatientDetailPage />),
        handle: { crumbs: [{ label: 'Pasien', to: '/patients' }, { label: 'Riwayat rontgen' }] },
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
