import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from './RequireAuth';
import { RouteError } from './RouteError';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { TraceLayout } from '@/trace/components/layout/TraceLayout';
import { TraceHome } from '@/trace/pages/Home';

/**
 * Route table.
 *
 * Three groups. The PULMO-TRACE research site is public and sits at the root.
 * The clinical prototype's own overview and sign-in screens are public too.
 * Everything else lives under a pathless layout route wrapped in `RequireAuth`,
 * so the application shell and its guard are declared once.
 *
 * The research home and login pages load eagerly because one of them is almost
 * always the first paint. Everything else is code-split, so a visitor who only
 * reads the overview never downloads the X-ray viewer, the report layout or the
 * research charts. `AppShell` and `TraceLayout` provide the Suspense
 * boundaries.
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

/**
 * PULMO-TRACE, the public research site, owns `/`, `/demo` and `/research`.
 *
 * The demo and research pages are code-split: both are long, and the research
 * page pulls in every chart in the project. A visitor who only reads the home
 * page should not download either.
 *
 * The clinical workflow prototype that previously sat at `/` is unchanged and
 * now served from `/platform`; its own routes under `/dashboard`, `/patients`
 * and so on are untouched.
 */
const TraceModelDemo = lazy(() =>
  import('@/trace/pages/ModelDemo').then((m) => ({ default: m.TraceModelDemo })),
);
const TraceResearch = lazy(() =>
  import('@/trace/pages/Research').then((m) => ({ default: m.TraceResearch })),
);

export const router = createBrowserRouter([
  {
    element: <TraceLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <TraceHome /> },
      { path: '/demo', element: <TraceModelDemo /> },
      { path: '/research', element: <TraceResearch /> },
    ],
  },
  {
    path: '/platform',
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
