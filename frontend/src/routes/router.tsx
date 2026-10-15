import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireRole, RoleHome } from './RequireAuth';
import { RouteError } from './RouteError';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
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
 * The public home and login pages load eagerly because one of them is almost
 * always the first paint. Everything else is code-split, so a visitor who only
 * reads the overview never downloads the screening demo or the X-ray viewer.
 * `AppShell` and `TraceLayout` provide the Suspense boundaries.
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

/* Patient workspace */
const OnboardingPage = lazy(() =>
  import('@/pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const PatientOverviewPage = lazy(() =>
  import('@/pages/patient/PatientOverviewPage').then((m) => ({ default: m.PatientOverviewPage })),
);
const PatientScreeningsPage = lazy(() =>
  import('@/pages/patient/PatientScreeningsPage').then((m) => ({
    default: m.PatientScreeningsPage,
  })),
);
const PatientFollowUpPage = lazy(() =>
  import('@/pages/patient/PatientFollowUpPage').then((m) => ({ default: m.PatientFollowUpPage })),
);
const PatientLearningPage = lazy(() =>
  import('@/pages/patient/PatientLearningPage').then((m) => ({ default: m.PatientLearningPage })),
);
const PatientProfilePage = lazy(() =>
  import('@/pages/patient/PatientProfilePage').then((m) => ({ default: m.PatientProfilePage })),
);

/* Administration */
const AdminOverviewPage = lazy(() =>
  import('@/pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })),
);
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminFacilitiesPage = lazy(() =>
  import('@/pages/admin/AdminFacilitiesPage').then((m) => ({ default: m.AdminFacilitiesPage })),
);
const AdminScreeningsPage = lazy(() =>
  import('@/pages/admin/AdminScreeningsPage').then((m) => ({ default: m.AdminScreeningsPage })),
);
const AdminAuditPage = lazy(() =>
  import('@/pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })),
);

/**
 * PULMO-TRACE, the public site, owns `/`, `/how-it-works` and `/demo`.
 *
 * The explainer and the demo are code-split. The demo carries the upload and
 * preview code, which a visitor who only reads the home page should not have
 * to download.
 *
 * The clinical workflow prototype that previously sat at `/` is unchanged and
 * now served from `/platform`; its own routes under `/dashboard`, `/patients`
 * and so on are untouched.
 */
const TraceModelDemo = lazy(() =>
  import('@/trace/pages/ModelDemo').then((m) => ({ default: m.TraceModelDemo })),
);
const TraceHowItWorks = lazy(() =>
  import('@/trace/pages/HowItWorks').then((m) => ({ default: m.TraceHowItWorks })),
);

export const router = createBrowserRouter([
  {
    element: <TraceLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <TraceHome /> },
      { path: '/how-it-works', element: <TraceHowItWorks /> },
      { path: '/demo', element: <TraceModelDemo /> },
    ],
  },
  {
    path: '/platform',
    element: <LandingPage />,
    errorElement: <RouteError />,
  },
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  { path: '/register', element: <RegisterPage />, errorElement: <RouteError /> },

  // One link for "take me to my workspace", resolved from the role.
  { path: '/app', element: <RoleHome />, errorElement: <RouteError /> },

  // Onboarding sits outside the shell: it has its own chrome, and a patient
  // who has not finished it has no navigation to offer yet.
  {
    path: '/onboarding',
    element: (
      <Suspense fallback={null}>
        <OnboardingPage />
      </Suspense>
    ),
    errorElement: <RouteError />,
  },

  /* ── Patient workspace ─────────────────────────────────────────────────── */
  {
    element: (
      <RequireAuth>
        <RequireRole roles={['patient']}>
          <AppShell />
        </RequireRole>
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { path: 'me', element: <PatientOverviewPage />, handle: { crumbs: [{ label: 'Overview' }] } },
      {
        path: 'me/screenings',
        element: <PatientScreeningsPage />,
        handle: { crumbs: [{ label: 'My screenings' }] },
      },
      {
        path: 'me/followup',
        element: <PatientFollowUpPage />,
        handle: { crumbs: [{ label: 'Follow-up' }] },
      },
      {
        path: 'me/learn',
        element: <PatientLearningPage />,
        handle: { crumbs: [{ label: 'Health learning' }] },
      },
      {
        path: 'me/facilities',
        element: <FacilitiesPage />,
        handle: { crumbs: [{ label: 'Healthcare facilities' }] },
      },
      {
        path: 'me/profile',
        element: <PatientProfilePage />,
        handle: { crumbs: [{ label: 'My profile' }] },
      },
    ],
  },

  /* ── Administration ────────────────────────────────────────────────────── */
  {
    element: (
      <RequireAuth>
        <RequireRole roles={['admin']}>
          <AppShell />
        </RequireRole>
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      {
        path: 'admin',
        element: <AdminOverviewPage />,
        handle: { crumbs: [{ label: 'Administration' }] },
      },
      {
        path: 'admin/users',
        element: <AdminUsersPage />,
        handle: { crumbs: [{ label: 'Administration', to: '/admin' }, { label: 'Accounts' }] },
      },
      {
        path: 'admin/facilities',
        element: <AdminFacilitiesPage />,
        handle: { crumbs: [{ label: 'Administration', to: '/admin' }, { label: 'Facilities' }] },
      },
      {
        path: 'admin/screenings',
        element: <AdminScreeningsPage />,
        handle: {
          crumbs: [{ label: 'Administration', to: '/admin' }, { label: 'Screening records' }],
        },
      },
      {
        path: 'admin/audit',
        element: <AdminAuditPage />,
        handle: { crumbs: [{ label: 'Administration', to: '/admin' }, { label: 'Audit log' }] },
      },
    ],
  },

  /* ── Healthcare professional workspace ─────────────────────────────────── */
  {
    element: (
      <RequireAuth>
        <RequireRole roles={['professional']}>
          <AppShell />
        </RequireRole>
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
