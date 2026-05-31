/**
 * SponsorLayout — study-context-aware workspace shell
 *
 * The sponsor sidebar is filtered by TWO signals coming from the selected
 * study (see workspaceSlice.selectActiveStudy):
 *
 *   study.scope   ∈ { 'EDC' | 'ePRO' | 'Survey' }
 *     EDC    → item 2 = "Data Capture"           (+ Site Management enabled)
 *     ePRO   → item 2 = "My Diary"               (Site Management hidden)
 *     Survey → item 2 = "Take Survey"            (Site Management hidden)
 *
 *   study.config  — Step-3 module toggles from the study wizard
 *     consentManager      (legacy: consentEnabled)     → Consent Management section
 *     queryManager        (legacy: queryEnabled)       → Quality Management → Query Manager
 *     dataManager         (legacy: dataManagerEnabled) → Data Capture menu (EDC scope)
 *     verificationManager                              → Quality Management → Verification Manager
 *     navigationBar       (legacy: navBarEnabled)      → reserved (not yet wired to a nav item)
 *
 * A section with no remaining children after filtering is dropped entirely.
 *
 * On mount, if the URL's :studyId doesn't match the Redux activeStudy (e.g.
 * direct nav, hard refresh, or bookmark), the layout dispatches
 * fetchStudyAsync so the filter has real config/scope to work with.
 */

import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
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
  KeyRound,
  LogOut,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  selectSidebarCollapsed,
  toggleSidebar,
  selectActiveStudy,
  fetchStudyAsync,
} from '@/features/workspace/store/workspaceSlice';
import Sidebar              from '@/components/layout/Sidebar';
import WorkspaceHeader      from './WorkspaceHeader';
import ReadOnlySponsorBanner from '@/features/workspace/components/ReadOnlySponsorBanner';
import { sponsorStudiesService } from '@/services/sponsorAuthService';
import { resolveStudyConfig, canViewLeaf } from '@/features/cro/utils/studyConfigGating';
import { useSiteRolePermissions } from '@/features/site/hooks/useSiteRolePermissions';
import styles               from './SponsorLayout.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/* ── Layout component ─────────────────────────────────────────────────────── */
export default function SponsorLayout() {
  const dispatch   = useAppDispatch();
  const navigate   = useNavigate();
  const { studyId } = useParams();
  const collapsed  = useAppSelector(selectSidebarCollapsed);
  const study      = useAppSelector(selectActiveStudy);

  const [mobileOpen, setMobileOpen] = useState(false);

  // The "switch study" control is only meaningful with more than one assigned
  // study — with a single study there is nothing to switch to. studyCount is
  // null while loading / on error, in which case the control stays visible.
  const [studyCount, setStudyCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    sponsorStudiesService.list()
      .then((list) => {
        if (!cancelled) setStudyCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => { /* leave null — keep the switcher visible */ });
    return () => { cancelled = true; };
  }, []);

  /* Hydrate activeStudy from :studyId on direct navigation / refresh so the
     sidebar filter below has real scope/config instead of falling back to
     defaults. */
  useEffect(() => {
    if (studyId && study?.id !== studyId) {
      dispatch(fetchStudyAsync(studyId));
    }
  }, [studyId, study?.id, dispatch]);

  const base   = `/sponsor/${studyId}`;
  const scope  = (study?.scope ?? 'EDC').toUpperCase(); // 'EDC' | 'EPRO' | 'SURVEY'
  // resolveStudyConfig handles both new (consentManager…) and legacy
  // (consentEnabled…) keys, defaulting missing flags to enabled.
  const cfg    = resolveStudyConfig(study?.config);
  // Logged-in user's role permission tree (null = unrestricted, e.g. CRO
  // admin with no per-study assignment). Resolution order:
  //   1. siteAuthUser.permissions    (PI / Coordinator / Nurse / etc.)
  //   2. sponsorAuthUser.permissions (direct sponsor login)
  //   3. CRO user.assignedStudies[].sponsorPermissions matched on this studyId
  // Tree keys match FEATURE_TREE leaf keys.
  const perms  = useSiteRolePermissions(studyId);
  // Convenience: gates a leaf by BOTH study config AND role permissions.
  const allowed = (leafKey) => canViewLeaf(perms, leafKey);

  /* ── Item 2 varies by study scope; gated by data_capture leaf only.
        The legacy `dataManager` step-3 toggle was removed in studyConfigGating
        (EDC studies always need data capture), so `cfg.dataManager` is now
        always undefined and would otherwise short-circuit this to null. ─── */
  const captureItem = allowed('data_capture')
    ? (scope === 'EPRO'
        ? { key: 'diary',   label: 'My Diary',    icon: Notebook,      path: `${base}/capture` }
        : scope === 'SURVEY'
        ? { key: 'survey',  label: 'Take Survey', icon: ClipboardList, path: `${base}/capture` }
        : { key: 'capture', label: 'Data Capture', icon: Database,     path: `${base}/capture` })
    : null;

  /* ── Primary nav: each leaf must be allowed by BOTH study.config AND
        the active user's role permissions. ─────────────────────────────── */
  const consentChildren = [
    allowed('consent_builder')    && { key: 'consent-builder',    label: 'Consent Builder',           path: `${base}/consent/config` },
    allowed('consent_submission') && { key: 'consent-submission', label: 'Consent Submission',        path: `${base}/consent/submit` },
    allowed('consent_review')     && { key: 'consent-review',     label: 'Consent Review & Approval', path: `${base}/consent/review` },
  ].filter(Boolean);

  const qualityChildren = [
    cfg.queryManager        && allowed('query_manager')     && { key: 'queries',      label: 'Query Manager',             path: `${base}/queries`      },
    cfg.verificationManager && allowed('data_verification') && { key: 'verification', label: 'Verification Manager', path: `${base}/verification` },
  ].filter(Boolean);

  const siteMgmtChildren = [
    allowed('sites')          && { key: 'sites-list', label: 'Sites',          path: `${base}/sites`     },
    allowed('site_personnel') && { key: 'personnel',  label: 'Site Personnel', path: `${base}/personnel` },
    allowed('site_roles')     && { key: 'roles',      label: 'Site Role',      path: `${base}/roles`     },
  ].filter(Boolean);

  const mastersChildren = [
    allowed('email_templates') && { key: 'masters-email',     label: 'Email Templates', path: `${base}/masters/email-templates` },
    allowed('countries')       && { key: 'masters-countries', label: 'Country',         path: `${base}/masters/countries`       },
    allowed('locations')       && { key: 'masters-locations', label: 'Locations',       path: `${base}/masters/locations`       },
    allowed('regions')         && { key: 'masters-regions',   label: 'Regions',         path: `${base}/masters/regions`         },
  ].filter(Boolean);

  const rawNav = [
    allowed('dashboard') && {
      key:   'dashboard',
      label: 'Dashboard',
      icon:  LayoutDashboard,
      path:  `${base}/dashboard`,
    },

    /* 2 — scope-driven */
    captureItem,

    /* 3 — Consent Management (gated by config.consentManager + perms) */
    cfg.consentManager && consentChildren.length > 0 && {
      key:   'consent',
      label: 'Consent Management',
      icon:  FileCheck,
      children: consentChildren,
    },

    /* 4 — Quality Management (dropped if both children are disabled) */
    qualityChildren.length > 0 && {
      key:   'quality',
      label: 'Quality Management',
      icon:  ShieldCheck,
      children: qualityChildren,
    },

    /* 5 — Site Management (EDC scope, gated by per-leaf perms) */
    scope === 'EDC' && siteMgmtChildren.length > 0 && {
      key:   'sites',
      label: 'Site Management',
      icon:  MapPin,
      children: siteMgmtChildren,
    },

    /* 6 — Masters (gated by per-leaf perms) */
    mastersChildren.length > 0 && {
      key:   'masters',
      label: 'Masters',
      icon:  BookOpen,
      children: mastersChildren,
    },
  ];

  const navItems = rawNav.filter(Boolean);

  /* ── Bottom nav ───────────────────────────────────────────────────────── */
  const bottomNav = [
    allowed('activity_log') && {
      key:   'activity-log',
      label: 'Activity Log',
      icon:  Activity,
      path:  `${base}/activity-log`,
    },
    allowed('reports') && {
      key:   'reports',
      label: 'Reports',
      icon:  BarChart2,
      path:  `${base}/reports`,
    },
    {
      key:   'profile',
      label: 'Profile Settings',
      icon:  UserCircle,
      children: [
        { key: 'profile-me',  label: 'My Profile',      icon: User,     path: `${base}/profile`         },
        { key: 'profile-pwd', label: 'Change Password', icon: KeyRound, path: `${base}/change-password` },
        { key: 'logout',      label: 'Logout',          icon: LogOut,   path: '/logout'                 },
      ],
    },
  ].filter(Boolean);

  /* Close mobile drawer at desktop width */
  useEffect(() => {
    const sync = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileOpen((o) => !o);
    } else {
      dispatch(toggleSidebar());
    }
  };

  return (
    <div className={styles.layout}>
      {/* Mobile/tablet overlay */}
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
        setCollapsed={() => dispatch(toggleSidebar())}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        profilePath={`${base}/profile`}
        settingsPath={`${base}/profile`}
        notificationsPath={null}
      />

      <div className={clx(styles.body, collapsed && styles.bodyCollapsed)}>
        <ReadOnlySponsorBanner />
        <WorkspaceHeader
          onToggleSidebar={handleToggleSidebar}
          showBreadcrumb
          showEnvironmentBadge
          showStudySwitcher={studyCount === null || studyCount > 1}
          showGlobalSearch
          onSwitchStudy={() => navigate('/sponsor/select-study')}
        />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
