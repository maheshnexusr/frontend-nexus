/**
 * router — React Router v6 createBrowserRouter configuration.
 *
 * All page components are lazy-loaded. The `sp()` helper wraps each lazy
 * component in a Suspense boundary with a full-page spinner fallback so every
 * route gets automatic code-splitting without repetitive JSX.
 *
 * Route tree:
 *   /                         → PublicLayout
 *   /signup …/forgot-password → AuthLayout
 *   /workspace                → ProtectedRoute (auth gate only)
 *   /cro                      → ProtectedRoute → CROLayout
 *   /sponsor/:studyId         → ProtectedRoute → SponsorLayout
 */

import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
} from 'react-router-dom';

import { useStorageSync } from '@/hooks/useStorageSync';
import ProtectedRoute from '@/components/navigation/ProtectedRoute';

// ─────────────────────────────────────────────────────────────────────────────
// Page loader (inline — no extra file needed)
// ─────────────────────────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-page, #f8fafc)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-subtle, #e2e8f0)',
          borderTopColor: 'var(--color-primary, #1d4ed8)',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suspense helper — wraps a lazy component once so the route element is clean
// ─────────────────────────────────────────────────────────────────────────────

/** @param {React.LazyExoticComponent} C */
function sp(C) {
  return (
    <Suspense fallback={<PageLoader />}>
      <C />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy page imports — Public
// ─────────────────────────────────────────────────────────────────────────────

const LandingPage         = lazy(() => import('@/features/public/pages/LandingPage'));
const PublicLayout        = lazy(() => import('@/layouts/PublicLayout'));
const HomePage            = lazy(() => import('@/features/public/pages/HomePage'));
const PrivacyPolicyPage   = lazy(() => import('@/features/public/pages/PrivacyPolicyPage'));
const TermsOfUsePage      = lazy(() => import('@/features/public/pages/TermsOfUsePage'));
const CookiePolicyPage    = lazy(() => import('@/features/public/pages/CookiePolicyPage'));

// ─────────────────────────────────────────────────────────────────────────────
// Lazy page imports — Auth
// ─────────────────────────────────────────────────────────────────────────────

const AuthLayout               = lazy(() => import('@/layouts/AuthLayout'));
const SignInPage               = lazy(() => import('@/features/auth/pages/SignInPage'));
const ForgotPasswordPage       = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const AccountActivationPage    = lazy(() => import('@/features/auth/pages/AccountActivationPage'));

// ─────────────────────────────────────────────────────────────────────────────
// Lazy page imports — Workspace selector
// ─────────────────────────────────────────────────────────────────────────────

const WorkspaceSelectorPage = lazy(() => import('@/features/workspace/pages/WorkspaceSelectorPage'));
const StudySelectorPage     = lazy(() => import('@/features/workspace/pages/StudySelectorPage'));

// ─────────────────────────────────────────────────────────────────────────────
// Lazy page imports — CRO
// ─────────────────────────────────────────────────────────────────────────────

const CROLayout          = lazy(() => import('@/layouts/CROLayout'));
const FormsListPage      = lazy(() => import('@/features/form-builder/pages/FormsListPage'));
const FormBuilderPage    = lazy(() => import('@/features/form-builder/pages/FormBuilderPage'));
const CRODashboardPage   = lazy(() => import('@/features/cro/pages/dashboard/CRODashboardPage'));
const CROProfilePage     = lazy(() => import('@/features/cro/pages/profile/CROProfilePage'));
const ChangePasswordPage = lazy(() => import('@/features/cro/pages/profile/ChangePasswordPage'));
const SponsorListPage    = lazy(() => import('@/features/cro/pages/sponsors/SponsorListPage'));
const SponsorNewPage     = lazy(() => import('@/features/cro/pages/sponsors/SponsorNewPage'));
const SponsorEditPage    = lazy(() => import('@/features/cro/pages/sponsors/SponsorEditPage'));
const StudyListPage      = lazy(() => import('@/features/cro/pages/studies/StudyListPage'));
const StudyNewPage       = lazy(() => import('@/features/cro/pages/studies/StudyNewPage'));
const StudyEditPage      = lazy(() => import('@/features/cro/pages/studies/StudyEditPage'));
const TeamMembersPage    = lazy(() => import('@/features/cro/pages/team/TeamMembersPage'));
const TeamMemberNewPage  = lazy(() => import('@/features/cro/pages/team/TeamMemberNewPage'));
const TeamRolesPage      = lazy(() => import('@/features/cro/pages/team/TeamRolesPage'));
const TeamRoleFormPage   = lazy(() => import('@/features/cro/pages/team/TeamRoleFormPage'));
const EmailTemplatesPage = lazy(() => import('@/features/cro/pages/masters/EmailTemplatesPage'));
const StudyPhasesPage    = lazy(() => import('@/features/cro/pages/masters/StudyPhasesPage'));
const CountryPage        = lazy(() => import('@/features/cro/pages/masters/CountryPage'));
const LocationsPage      = lazy(() => import('@/features/cro/pages/masters/LocationsPage'));
const RegionsPage        = lazy(() => import('@/features/cro/pages/masters/RegionsPage'));
const CROActivityLogPage = lazy(() => import('@/features/cro/pages/activity-log/ActivityLogPage'));

// ─────────────────────────────────────────────────────────────────────────────
// Lazy page imports — Sponsor
// ─────────────────────────────────────────────────────────────────────────────

const SponsorLayout              = lazy(() => import('@/layouts/SponsorLayout'));
const SponsorStudySelectorPage   = lazy(() => import('@/features/sponsor/pages/SponsorStudySelectorPage'));
const SponsorDashboardPage       = lazy(() => import('@/features/sponsor/pages/SponsorDashboardPage'));
const CapturePage            = lazy(() => import('@/features/sponsor/pages/CapturePage'));
const CaptureFormPage        = lazy(() => import('@/features/sponsor/pages/CaptureFormPage'));
const ConsentConfigPage      = lazy(() => import('@/features/sponsor/pages/ConsentConfigPage'));
const ConsentReviewPage      = lazy(() => import('@/features/sponsor/pages/ConsentReviewPage'));
const QueriesPage            = lazy(() => import('@/features/sponsor/pages/QueriesPage'));
const VerificationPage       = lazy(() => import('@/features/sponsor/pages/VerificationPage'));
const SitesPage              = lazy(() => import('@/features/sponsor/pages/SitesPage'));
const SiteFormPage           = lazy(() => import('@/features/sponsor/pages/SiteFormPage'));
const SiteRoleFormPage       = lazy(() => import('@/features/sponsor/pages/SiteRoleFormPage'));
const PersonnelPage          = lazy(() => import('@/features/sponsor/pages/PersonnelPage'));
const PersonnelFormPage      = lazy(() => import('@/features/sponsor/pages/PersonnelFormPage'));
const SitePersonnelActivationPage    = lazy(() => import('@/features/site/pages/SitePersonnelActivationPage'));
const SiteDashboardPage              = lazy(() => import('@/features/site/pages/SiteDashboardPage'));
const SiteLayout                     = lazy(() => import('@/layouts/SiteLayout'));
const SiteWorkspaceDashboardPage     = lazy(() => import('@/features/site/pages/SiteWorkspaceDashboardPage'));
const SiteCapturePage                = lazy(() => import('@/features/site/pages/SiteCapturePage'));
const SiteCaptureFormPage            = lazy(() => import('@/features/site/pages/SiteCaptureFormPage'));
const SiteSubjectFormPage            = lazy(() => import('@/features/site/pages/SiteSubjectFormPage'));
const SitePersonnelPage              = lazy(() => import('@/features/site/pages/SitePersonnelPage'));
const SiteFeaturePlaceholderPage     = lazy(() => import('@/features/site/pages/SiteFeaturePlaceholderPage'));
const RolesPage              = lazy(() => import('@/features/sponsor/pages/RolesPage'));
const ReportsPage            = lazy(() => import('@/features/sponsor/pages/ReportsPage'));
const SponsorActivityLogPage      = lazy(() => import('@/features/sponsor/pages/SponsorActivityLogPage'));
const MasterEmailTemplatesPage    = lazy(() => import('@/features/sponsor/pages/MasterEmailTemplatesPage'));
const MasterCountriesPage         = lazy(() => import('@/features/sponsor/pages/MasterCountriesPage'));
const MasterLocationsPage         = lazy(() => import('@/features/sponsor/pages/MasterLocationsPage'));
const MasterRegionsPage           = lazy(() => import('@/features/sponsor/pages/MasterRegionsPage'));
const MasterEmailTriggersPage     = lazy(() => import('@/features/sponsor/pages/MasterEmailTriggersPage'));
const SponsorProfilePage          = lazy(() => import('@/features/cro/pages/profile/CROProfilePage'));
const SponsorChangePasswordPage   = lazy(() => import('@/features/cro/pages/profile/ChangePasswordPage'));

// ─────────────────────────────────────────────────────────────────────────────
// Inline 404 page
// ─────────────────────────────────────────────────────────────────────────────

function NotFoundPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '12px',
        textAlign: 'center',
        padding: '24px',
        background: 'var(--bg-page, #f8fafc)',
      }}
    >
      <p
        style={{
          fontSize: '80px',
          fontWeight: 800,
          color: 'var(--color-primary, #1d4ed8)',
          lineHeight: 1,
          margin: 0,
          letterSpacing: '-4px',
        }}
      >
        404
      </p>
      <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
        Page Not Found
      </p>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-muted, #64748b)',
          maxWidth: '360px',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <a
        href="/"
        style={{
          marginTop: '8px',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-primary, #1d4ed8)',
          textDecoration: 'none',
        }}
      >
        ← Back to Home
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RootLayout — session restore + cross-tab logout sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mounted once at the top of the router tree.
 * - Restores the session on page refresh if a token is in sessionStorage.
 * - Wires cross-tab logout via useStorageSync.
 */
function RootLayout() {
  // Broadcast logout across tabs
  useStorageSync();

  return <Outlet />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route configuration
// ─────────────────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    // Root layout: session restore + storage sync — wraps everything
    element: <RootLayout />,
    children: [

      // ── Landing page — served at "/" without any layout wrapper ──────────
      { index: true, element: sp(LandingPage) },

      // ── Public routes ────────────────────────────────────────────────────
      {
        element: sp(PublicLayout),
        children: [
          { path: 'privacy-policy',   element: sp(PrivacyPolicyPage) },
          { path: 'terms-of-use',     element: sp(TermsOfUsePage) },
          { path: 'cookie-policy',    element: sp(CookiePolicyPage) },
        ],
      },

      // ── Auth routes ──────────────────────────────────────────────────────
      {
        element: sp(AuthLayout),
        children: [
          { path: 'signin',            element: sp(SignInPage) },
          { path: 'forgot-password',   element: sp(ForgotPasswordPage) },
          { path: 'activate',          element: sp(AccountActivationPage) },
        ],
      },

      // ── Site portal (auth scope: site, separate from CRO/sponsor) ────────
      // Sign-in is the SHARED /signin page — the backend dispatches by
      // auth_identities and the response's `scope: 'site'` routes here.
      //
      //   /site/invite/:token  — activation (Pending account → Active)
      //   /site/studies        — STUDY PICKER (no shell, no sidebar)
      //   /site/...            — SiteLayout shell (sidebar gated by the
      //                          user's role permissions in siteStudyContext;
      //                          bounces to /site/studies if no chosen study)
      { path: 'site/invite/:token',  element: sp(SitePersonnelActivationPage) },
      { path: 'site/studies',        element: sp(SiteDashboardPage) },
      {
        path: 'site',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SiteLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },

          { path: 'dashboard',     element: sp(SiteWorkspaceDashboardPage) },

          // Sidebar features — placeholder until a real page is built.
          // SiteLayout's nav links straight here; replacing a placeholder
          // with a real page is a one-line element swap.
          { path: 'capture',                                element: sp(SiteCapturePage) },
          { path: 'capture/subjects/new',                   element: sp(SiteSubjectFormPage) },
          { path: 'capture/subjects/:subjectId/edit',       element: sp(SiteSubjectFormPage) },
          { path: 'capture/form',                           element: sp(SiteCaptureFormPage) },
          { path: 'queries',                 element: sp(SiteFeaturePlaceholderPage) },
          { path: 'verification',            element: sp(SiteFeaturePlaceholderPage) },
          { path: 'consent/config',          element: sp(SiteFeaturePlaceholderPage) },
          { path: 'consent/review',          element: sp(SiteFeaturePlaceholderPage) },
          { path: 'reports',                 element: sp(SiteFeaturePlaceholderPage) },
          { path: 'sites',                   element: sp(SiteFeaturePlaceholderPage) },
          { path: 'personnel',               element: sp(SitePersonnelPage) },
          { path: 'roles',                   element: sp(SiteFeaturePlaceholderPage) },
          { path: 'masters/email-templates', element: sp(SiteFeaturePlaceholderPage) },
          { path: 'masters/countries',       element: sp(SiteFeaturePlaceholderPage) },
          { path: 'masters/locations',       element: sp(SiteFeaturePlaceholderPage) },
          { path: 'masters/regions',         element: sp(SiteFeaturePlaceholderPage) },
          { path: 'activity-log',            element: sp(SiteFeaturePlaceholderPage) },
          { path: 'profile',                 element: sp(SiteFeaturePlaceholderPage) },
        ],
      },

      // ── Workspace selector routes ────────────────────────────────────────
      {
        path: 'workspace',
        element: (
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          { index: true,                           element: sp(WorkspaceSelectorPage) },
          { path: ':sponsorId/studies',            element: sp(StudySelectorPage) },
        ],
      },

      // ── CRO routes ───────────────────────────────────────────────────────
      {
        path: 'cro',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CROLayout />
            </Suspense>
          </ProtectedRoute>
        ),
        children: [
          // Redirect /cro → /cro/dashboard
          { index: true, element: <Navigate to="dashboard" replace /> },

          { path: 'dashboard',   element: sp(CRODashboardPage) },

          // Sponsors
          { path: 'sponsors',              element: sp(SponsorListPage) },
          { path: 'sponsors/new',          element: sp(SponsorNewPage) },
          { path: 'sponsors/:sponsorId',   element: sp(SponsorEditPage) },

          // Studies list + edit
          { path: 'studies',               element: sp(StudyListPage) },
          { path: 'studies/:studyId/edit', element: sp(StudyEditPage) },

          // Study creation wizard — tab-based, no sub-routes
          { path: 'studies/new', element: sp(StudyNewPage) },

          // Team
          { path: 'team/members',              element: sp(TeamMembersPage) },
          { path: 'team/members/new',          element: sp(TeamMemberNewPage) },
          { path: 'team/members/:memberId',    element: sp(TeamMemberNewPage) },
          { path: 'team/roles',                element: sp(TeamRolesPage) },
          { path: 'team/roles/new',           element: sp(TeamRoleFormPage) },
          { path: 'team/roles/:roleId',       element: sp(TeamRoleFormPage) },

          // Masters
          { path: 'masters/email-templates', element: sp(EmailTemplatesPage) },
          { path: 'masters/study-phases',    element: sp(StudyPhasesPage) },
          { path: 'masters/country',         element: sp(CountryPage) },
          { path: 'masters/locations',       element: sp(LocationsPage) },
          { path: 'masters/regions',         element: sp(RegionsPage) },

          // Form builder
          { path: 'forms',           element: sp(FormsListPage) },
          { path: 'forms/new',       element: sp(FormBuilderPage) },
          { path: 'forms/:formId',   element: sp(FormBuilderPage) },

          // Activity log
          { path: 'activity-log', element: sp(CROActivityLogPage) },

          // Choose Sponsor Workspace
          { path: 'workspace', element: sp(WorkspaceSelectorPage) },

          // Profile
          { path: 'profile',           element: sp(CROProfilePage) },
          { path: 'profile/password',  element: sp(ChangePasswordPage) },
        ],
      },

      // ── Sponsor study selector (multi-study sponsors, no studyId yet) ────
      {
        path: 'sponsor/select-study',
        element: (
          <ProtectedRoute scope="sponsor">
            {sp(SponsorStudySelectorPage)}
          </ProtectedRoute>
        ),
      },

      // ── Sponsor / study-context routes ───────────────────────────────────
      {
        path: 'sponsor/:studyId',
        element: (
          <ProtectedRoute scope="sponsor">
            <Suspense fallback={<PageLoader />}>
              <SponsorLayout />
            </Suspense>
          </ProtectedRoute>
        ),
        children: [
          // Redirect /sponsor/:studyId → /sponsor/:studyId/dashboard
          { index: true, element: <Navigate to="dashboard" replace /> },

          { path: 'dashboard',      element: sp(SponsorDashboardPage) },
          { path: 'capture',        element: sp(CapturePage) },
          { path: 'capture/form',   element: sp(CaptureFormPage) },
          { path: 'consent/config', element: sp(ConsentConfigPage) },
          { path: 'consent/review', element: sp(ConsentReviewPage) },
          { path: 'queries',        element: sp(QueriesPage) },
          { path: 'verification',   element: sp(VerificationPage) },
          { path: 'sites',                 element: sp(SitesPage)     },
          { path: 'sites/new',             element: sp(SiteFormPage)  },
          { path: 'sites/:siteId/edit',    element: sp(SiteFormPage)  },
          { path: 'personnel',                     element: sp(PersonnelPage)     },
          { path: 'personnel/new',                 element: sp(PersonnelFormPage) },
          { path: 'personnel/:personnelId/edit',   element: sp(PersonnelFormPage) },
          { path: 'roles',                 element: sp(RolesPage)         },
          { path: 'roles/new',             element: sp(SiteRoleFormPage)  },
          { path: 'roles/:roleId/edit',    element: sp(SiteRoleFormPage)  },
          { path: 'reports',        element: sp(ReportsPage) },
          { path: 'activity-log',              element: sp(SponsorActivityLogPage)   },
          { path: 'masters/email-templates',   element: sp(MasterEmailTemplatesPage) },
          { path: 'masters/countries',         element: sp(MasterCountriesPage)      },
          { path: 'masters/locations',         element: sp(MasterLocationsPage)      },
          { path: 'masters/regions',           element: sp(MasterRegionsPage)        },
          { path: 'masters/email-triggers',    element: sp(MasterEmailTriggersPage)  },
          { path: 'profile',                   element: sp(SponsorProfilePage)       },
          { path: 'change-password',           element: sp(SponsorChangePasswordPage) },
        ],
      },

      // ── 404 catch-all ────────────────────────────────────────────────────
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
