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
import ConsentGate from '@/features/site/components/ConsentGate';
import {
  LayoutDashboard,
  Database,
  Notebook,
  ClipboardList,
  ClipboardCheck,
  FileCheck,
  ShieldCheck,
  MapPin,
  BookOpen,
  Activity,
  BarChart2,
  User,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react';
import Sidebar              from '@/components/layout/Sidebar';
import WorkspaceHeader      from './WorkspaceHeader';
import {
  getSiteStudyContext,
  setSiteStudyContext,
  getSiteStudies,
  hasSiteStudyContext,
  isSiteSession,
  clearSiteStudyContext,
} from '@/features/site/authStore';
import { siteWorkspaceClient } from '@/features/site/api/siteWorkspaceClient';
import { resolveStudyConfig, canViewLeaf } from '@/features/cro/utils/studyConfigGating';
import { resolveFileUrl } from '@/api/fileUrl';
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
  // Live role permissions, refreshed on entry so menu reflects role-permission
  // changes without a re-login (the login snapshot can be stale). null until the
  // refresh resolves — falls back to the cached context permissions meanwhile.
  const [livePerms, setLivePerms] = useState(null);
  // Live Step-3 study-config toggles, refreshed on entry alongside permissions so
  // optional-module menus (e.g. Consent Review) reflect the study config without
  // re-picking the study. null until the refresh resolves → cached config.
  const [liveConfig, setLiveConfig] = useState(null);

  // Close mobile drawer at desktop width. Declared up here so the hook order is
  // stable — the early-return Navigates below MUST come after all hooks.
  useEffect(() => {
    const sync = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  // Re-resolve current role permissions on workspace entry and cache them, so a
  // permission removed from the user's site role (e.g. consent) disappears from
  // the menu without requiring a sign-out/in.
  useEffect(() => {
    if (!isSiteSession() || !hasSiteStudyContext()) return undefined;
    let alive = true;
    siteWorkspaceClient.refreshContext()
      .then((res) => {
        if (!alive) return;
        const fresh = res?.permissions;
        const freshConfig = res?.config;
        if (freshConfig && typeof freshConfig === 'object') setLiveConfig(freshConfig);
        if (fresh && typeof fresh === 'object') {
          setLivePerms(fresh);
          const ctx = getSiteStudyContext();
          if (ctx) setSiteStudyContext({
            ...ctx,
            permissions: fresh,
            config: (freshConfig && typeof freshConfig === 'object') ? freshConfig : ctx.config,
          });
        }
      })
      .catch(() => { /* best-effort — keep cached permissions on failure */ });
    return () => { alive = false; };
  }, []);

  // No session at all → bounce to sign-in.
  if (!isSiteSession()) return <Navigate to="/signin" replace />;
  // Session but no chosen study → back to the picker.
  if (!hasSiteStudyContext()) return <Navigate to="/site/studies" replace />;

  const context = getSiteStudyContext();
  // Sponsor org logo for the sidebar brand. Prefer the chosen-study context;
  // fall back to the cached picker list (matched by studyId) so a context saved
  // before the logo was added still resolves without re-choosing the study.
  const siteLogo = context?.organizationLogo
    ?? getSiteStudies().find((st) => (st.studyId ?? st.study_id) === context?.studyId)?.organizationLogo
    ?? null;
  const scope   = deriveScope(context?.scope);
  const cfg     = resolveStudyConfig(liveConfig ?? context?.config);
  const perms   = livePerms ?? context?.permissions ?? {};
  const allowed = (leafKey) => canViewLeaf(perms, leafKey);
  // Show a menu when the role holds ANY of the listed actions on a leaf — not
  // strictly `.view`. A Consent Approver granted only Approve/Reject (no explicit
  // View) must still see the Consent Review menu (spec 13.iii). Mirrors
  // canViewLeaf's fail-open for '*'/null permission trees.
  const allowedAnyAction = (leafKey, ...actions) => {
    if (!perms || typeof perms !== 'object') return true;
    const leaf = perms[leafKey];
    return !!(leaf && actions.some((a) => leaf[a]));
  };

  /* ── Item 2 varies by study scope; gated by data_capture leaf only.
        The legacy `dataManager` toggle was removed (EDC studies always need
        capture). `cfg.dataManager` is undefined now and would otherwise null
        this out. ────────────────────────────────────────────────────────── */
  const captureItem = allowed('data_capture')
    ? (scope === 'EPRO'
        ? { key: 'diary',   label: 'My Diary',    icon: Notebook,      path: '/site/capture' }
        : scope === 'SURVEY'
        ? { key: 'survey',  label: 'Survey Submission', icon: ClipboardList, path: '/site/capture' }
        : { key: 'capture', label: 'Data Capture', icon: Database,     path: '/site/capture' })
    : null;

  /* ── Screening Report — Inclusion/Exclusion overview for this site. HIDDEN
        from the nav (route/page kept). Restore by reinstating the item below. ── */
  const screeningItem = null;
  // const screeningItem = (allowed('data_capture') && scope !== 'EPRO' && scope !== 'SURVEY')
  //   ? { key: 'screening-report', label: 'Screening Report', icon: ClipboardCheck, path: '/site/screening-report' }
  //   : null;

  // Site personnel SUBMIT consent (consent_submission). Consent Review only
  // shows when the study requires approval (cfg.consentApproval) AND the site
  // role is granted consent_review — Sponsor/CRO normally review in their own
  // workspace. Consent Builder stays a Sponsor/CRO authoring function.
  const consentChildren = [
    allowed('consent_builder')    && { key: 'consent-builder',    label: 'Consent Builder',           path: '/site/consent/config' },
    allowed('consent_submission') && { key: 'consent-submission', label: 'Submit Consent',            path: '/site/consent/submit' },
    cfg.consentApproval && allowedAnyAction('consent_review', 'view', 'approve', 'reject') && { key: 'consent-review', label: 'Consent Review & Approval', path: '/site/consent/review' },
  ].filter(Boolean);

  const qualityChildren = [
    cfg.queryManager        && allowed('query_manager')     && { key: 'queries',      label: 'Query Manager',             path: '/site/queries'      },
    cfg.verificationManager && allowed('data_verification') && { key: 'verification', label: 'Verification Manager', path: '/site/verification' },
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
    screeningItem,
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
    // Profile Settings removed from the left menu (spec) — now in the footer
    // ProfileCard (My Profile / Logout).
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
        notificationsPath={null}
        subtitle="Study Workspace"
        logoUrl={resolveFileUrl(siteLogo) || null}
        bigLogo
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
          <ConsentGate>
            <Outlet />
          </ConsentGate>
        </main>
      </div>
    </div>
  );
}
