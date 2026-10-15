import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from './RequireAuth';
import { RouteError } from './RouteError';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';

/**
 * Route table.
 *
 * Two public routes sit at the top: the overview at `/`, which explains the
 * project without requiring an account, and the sign-in screen. Everything
 * else lives under a pathless layout route wrapped in `RequireAuth`, so the
 * application shell and its guard are declared once.
 *
 * The landing and login pages load eagerly because one of them is always the
 * first paint. The application screens are code-split so a visitor who only
 * reads the overview never downloads the X-ray viewer, the report layout or the
 * animation library. `AppShell` provides the Suspense boundary.
 *
 * Each app route carries a `crumbs` handle that the top bar reads, so
 * breadcrumbs are declared next to the route rather than reconstructed from
 * the URL.
 */

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const PatientsPage = lazy(() =>
  import('@/pages/PatientsPage').then((m) => ({ default: m.PatientsPage })),
);
const PatientDetailPage = lazy(() =>
  import('@/pages/PatientDetailPage').then((m) => ({ default: m.PatientDetailPage })),
);
const NewScreeningPage = lazy(() =>
  import('@/pages/NewScreeningPage').then((m) => ({ default: m.NewScreeningPage })),
);
const ScreeningResultPage = lazy(() =>
  import('@/pages/ScreeningResultPage').then((m) => ({ default: m.ScreeningResultPage })),
);
const ReportViewPage = lazy(() =>
  import('@/pages/ReportViewPage').then((m) => ({ default: m.ReportViewPage })),
);
const ReferralsPage = lazy(() =>
  import('@/pages/ReferralsPage').then((m) => ({ default: m.ReferralsPage })),
);
const FollowUpsPage = lazy(() =>
  import('@/pages/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })),
);
const FacilitiesPage = lazy(() =>
  import('@/pages/FacilitiesPage').then((m) => ({ default: m.FacilitiesPage })),
);
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const OfflineQueuePage = lazy(() =>
  import('@/pages/OfflineQueuePage').then((m) => ({ default: m.OfflineQueuePage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <RouteError />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteError />,
  },
  {
    // Pathless layout: children resolve against the root.
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      {
        path: 'dashboard',
        element: <DashboardPage />,
        handle: { crumbs: [{ label: 'Dashboard' }] },
      },
      {
        path: 'patients',
        element: <PatientsPage />,
        handle: { crumbs: [{ label: 'Patients' }] },
      },
      {
        path: 'patients/:patientId',
        element: <PatientDetailPage />,
        handle: { crumbs: [{ label: 'Patients', to: '/patients' }, { label: 'Patient record' }] },
      },
      {
        path: 'screenings/new',
        element: <NewScreeningPage />,
        handle: { crumbs: [{ label: 'Screenings' }, { label: 'New screening' }] },
      },
      {
        path: 'screenings/:screeningId',
        element: <ScreeningResultPage />,
        handle: {
          crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Screening result' }],
        },
      },
      {
        path: 'screenings/:screeningId/report',
        element: <ReportViewPage />,
        handle: {
          crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Explainable report' }],
        },
      },
      {
        path: 'referrals',
        element: <ReferralsPage />,
        handle: { crumbs: [{ label: 'Referrals' }] },
      },
      {
        path: 'followups',
        element: <FollowUpsPage />,
        handle: { crumbs: [{ label: 'Follow-ups' }] },
      },
      {
        path: 'facilities',
        element: <FacilitiesPage />,
        handle: { crumbs: [{ label: 'Healthcare facilities' }] },
      },
      {
        path: 'reports',
        element: <ReportsPage />,
        handle: { crumbs: [{ label: 'Reports' }] },
      },
      {
        path: 'offline',
        element: <OfflineQueuePage />,
        handle: { crumbs: [{ label: 'Offline queue' }] },
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        handle: { crumbs: [{ label: 'Settings' }] },
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
