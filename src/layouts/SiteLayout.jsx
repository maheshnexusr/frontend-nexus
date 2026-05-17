/**
 * SiteLayout — workspace shell for the `site` auth scope.
 *
 * Mirrors SponsorLayout in look + behavior, but reads the study context from
 * the site authStore (siteStudyContext) instead of Redux activeStudy, and its
 * "Switch study" action bounces back to /site/studies — the site-specific
 * picker — rather than /sponsor/select-study.
 *
 * Sidebar gating (every leaf must satisfy BOTH):
 *   permissions[key].view === true              (role permission tree)
 *   resolveStudyConfig(context.config)[toggle]  (Step-3 study toggle)
 *
 * Step-3 toggles are not yet plumbed into the site choose() response, so
 * resolveStudyConfig falls back to "enabled" — matches studyConfigGating's
 * fail-open default. When the backend adds config to the response, the tree
 * filters automatically with no FE change here.
 *
 * Bounces:
 *   no site session    → /signin
 *   no study context   → /site/studies   (picker)
 */

import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Notebook,
  ClipboardList,
  FileCheck,
  ShieldCheck,
  MapPin,
  BookOpen,
  Activity,
  BarChart2,
  UserCircle,
  User,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react';
import Sidebar              from '@/components/layout/Sidebar';
import WorkspaceHeader      from './WorkspaceHeader';
import {
  getSiteStudyContext,
  hasSiteStudyContext,
  isSiteSession,
  clearSiteStudyContext,
} from '@/features/site/authStore';
import { resolveStudyConfig, canViewLeaf } from '@/features/cro/utils/studyConfigGating';
import styles from './SponsorLayout.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/** Convert the site context's scope flag triple into EDC|EPRO|SURVEY. */
function deriveScope(scope) {
  if (!scope || typeof scope !== 'object') return 'EDC';
  if (scope.epro)   return 'EPRO';
  if (scope.survey) return 'SURVEY';
  return 'EDC';
}

export default function SiteLayout() {
  const navigate = useNavigate();

  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer at desktop width. Declared up here so the hook order is
  // stable — the early-return Navigates below MUST come after all hooks.
  useEffect(() => {
    const sync = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  // No session at all → bounce to sign-in.
  if (!isSiteSession()) return <Navigate to="/signin" replace />;
  // Session but no chosen study → back to the picker.
  if (!hasSiteStudyContext()) return <Navigate to="/site/studies" replace />;

  const context = getSiteStudyContext();
  const scope   = deriveScope(context?.scope);
  const cfg     = resolveStudyConfig(context?.config);
  const perms   = context?.permissions ?? {};
  const allowed = (leafKey) => canViewLeaf(perms, leafKey);

  /* ── Item 2 varies by study scope; gated by dataManager + data_capture ── */
  const captureItem = cfg.dataManager && allowed('data_capture')
    ? (scope === 'EPRO'
        ? { key: 'diary',   label: 'My Diary',    icon: Notebook,      path: '/site/capture' }
        : scope === 'SURVEY'
        ? { key: 'survey',  label: 'Take Survey', icon: ClipboardList, path: '/site/capture' }
        : { key: 'capture', label: 'Data Capture', icon: Database,     path: '/site/capture' })
    : null;

  const consentChildren = [
    allowed('consent_builder') && { key: 'consent-builder', label: 'Consent Builder',           path: '/site/consent/config' },
    allowed('consent_review')  && { key: 'consent-review',  label: 'Consent Review & Approval', path: '/site/consent/review' },
  ].filter(Boolean);

  const qualityChildren = [
    cfg.queryManager        && allowed('query_manager')     && { key: 'queries',      label: 'Query Manager',             path: '/site/queries'      },
    cfg.verificationManager && allowed('data_verification') && { key: 'verification', label: 'Data Verification Manager', path: '/site/verification' },
  ].filter(Boolean);

  const siteMgmtChildren = [
    allowed('sites')          && { key: 'sites-list', label: 'Sites',          path: '/site/sites'     },
    allowed('site_personnel') && { key: 'personnel',  label: 'Site Personnel', path: '/site/personnel' },
    allowed('site_roles')     && { key: 'roles',      label: 'Site Role',      path: '/site/roles'     },
  ].filter(Boolean);

  const mastersChildren = [
    allowed('email_templates') && { key: 'masters-email',     label: 'Email Templates', path: '/site/masters/email-templates' },
    allowed('countries')       && { key: 'masters-countries', label: 'Country',         path: '/site/masters/countries'       },
    allowed('locations')       && { key: 'masters-locations', label: 'Locations',       path: '/site/masters/locations'       },
    allowed('regions')         && { key: 'masters-regions',   label: 'Regions',         path: '/site/masters/regions'         },
  ].filter(Boolean);

  const rawNav = [
    allowed('dashboard') && {
      key:   'dashboard',
      label: 'Dashboard',
      icon:  LayoutDashboard,
      path:  '/site/dashboard',
    },
    captureItem,
    cfg.consentManager && consentChildren.length > 0 && {
      key:   'consent',
      label: 'Consent Management',
      icon:  FileCheck,
      children: consentChildren,
    },
    qualityChildren.length > 0 && {
      key:   'quality',
      label: 'Quality Management',
      icon:  ShieldCheck,
      children: qualityChildren,
    },
    scope === 'EDC' && siteMgmtChildren.length > 0 && {
      key:   'sites',
      label: 'Site Management',
      icon:  MapPin,
      children: siteMgmtChildren,
    },
    mastersChildren.length > 0 && {
      key:   'masters',
      label: 'Masters',
      icon:  BookOpen,
      children: mastersChildren,
    },
  ];
  const navItems = rawNav.filter(Boolean);

  const bottomNav = [
    allowed('activity_log') && {
      key:   'activity-log',
      label: 'Activity Log',
      icon:  Activity,
      path:  '/site/activity-log',
    },
    allowed('reports') && {
      key:   'reports',
      label: 'Reports',
      icon:  BarChart2,
      path:  '/site/reports',
    },
    {
      key:   'profile',
      label: 'Profile Settings',
      icon:  UserCircle,
      children: [
        { key: 'profile-me', label: 'My Profile', icon: User,   path: '/site/profile' },
        { key: 'logout',     label: 'Logout',     icon: LogOut, path: '/logout'       },
      ],
    },
  ].filter(Boolean);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  };

  /** Switch study = drop the workspace context, return to the picker. */
  const handleSwitchStudy = () => {
    clearSiteStudyContext();
    navigate('/site/studies');
  };

  return (
    <div className={styles.layout}>
      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        items={navItems}
        bottomItems={bottomNav}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        profilePath="/site/profile"
        settingsPath="/site/profile"
        notificationsPath={null}
      />

      <div className={clx(styles.body, collapsed && styles.bodyCollapsed)}>
        <WorkspaceHeader
          onToggleSidebar={handleToggleSidebar}
          showBreadcrumb
          showEnvironmentBadge={false}
          showStudySwitcher={false}
          showGlobalSearch
          breadcrumb={[
            { key: 'study', label: context?.studyTitle || context?.protocolNumber || 'Study' },
            { key: 'env',   label: context?.environment || '' },
            { key: 'site',  label: context?.siteName    || '' },
          ].filter((c) => c.label)}
          rightActions={
            <button
              type="button"
              onClick={handleSwitchStudy}
              title="Switch study"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6,
                background: 'var(--bg-elevated, #fff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: 'var(--text-primary, #0f172a)',
              }}
            >
              <ArrowLeftRight size={13} />
              <span>{context?.protocolNumber || 'Study'}</span>
              <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 400 }}>
                · Switch
              </span>
            </button>
          }
        />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
