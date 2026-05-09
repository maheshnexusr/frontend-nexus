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
 *     verificationManager                              → Quality Management → Data Verification Manager
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
import { resolveStudyConfig } from '@/features/cro/utils/studyConfigGating';
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

  /* ── Item 2 varies by study scope; gated by the dataManager toggle ────── */
  const captureItem = cfg.dataManager
    ? (scope === 'EPRO'
        ? { key: 'diary',   label: 'My Diary',    icon: Notebook,      path: `${base}/capture` }
        : scope === 'SURVEY'
        ? { key: 'survey',  label: 'Take Survey', icon: ClipboardList, path: `${base}/capture` }
        : { key: 'capture', label: 'Data Capture', icon: Database,     path: `${base}/capture` })
    : null;

  /* ── Primary nav (unfiltered) ─────────────────────────────────────────── */
  const qualityChildren = [
    cfg.queryManager        && { key: 'queries',      label: 'Query Manager',             path: `${base}/queries`      },
    cfg.verificationManager && { key: 'verification', label: 'Data Verification Manager', path: `${base}/verification` },
  ].filter(Boolean);

  const rawNav = [
    {
      key:   'dashboard',
      label: 'Dashboard',
      icon:  LayoutDashboard,
      path:  `${base}/dashboard`,
    },

    /* 2 — scope-driven */
    captureItem,

    /* 3 — Consent Management (gated by config.consentManager) */
    cfg.consentManager && {
      key:   'consent',
      label: 'Consent Management',
      icon:  FileCheck,
      children: [
        { key: 'consent-builder', label: 'Consent Builder',           path: `${base}/consent/config` },
        { key: 'consent-review',  label: 'Consent Review & Approval', path: `${base}/consent/review` },
      ],
    },

    /* 4 — Quality Management (dropped if both children are disabled) */
    qualityChildren.length > 0 && {
      key:   'quality',
      label: 'Quality Management',
      icon:  ShieldCheck,
      children: qualityChildren,
    },

    /* 5 — Site Management (only meaningful for EDC scope) */
    scope === 'EDC' && {
      key:   'sites',
      label: 'Site Management',
      icon:  MapPin,
      children: [
        { key: 'sites-list', label: 'Sites',          path: `${base}/sites`     },
        { key: 'personnel',  label: 'Site Personnel', path: `${base}/personnel` },
        { key: 'roles',      label: 'Site Role',      path: `${base}/roles`     },
      ],
    },

    /* 6 — Masters (always visible) */
    {
      key:   'masters',
      label: 'Masters',
      icon:  BookOpen,
      children: [
        { key: 'masters-email',     label: 'Email Templates', path: `${base}/masters/email-templates` },
        { key: 'masters-countries', label: 'Country',         path: `${base}/masters/countries`       },
        { key: 'masters-locations', label: 'Locations',       path: `${base}/masters/locations`       },
      ],
    },
  ];

  const navItems = rawNav.filter(Boolean);

  /* ── Bottom nav ───────────────────────────────────────────────────────── */
  const bottomNav = [
    {
      key:   'activity-log',
      label: 'Activity Log',
      icon:  Activity,
      path:  `${base}/activity-log`,
    },
    {
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
  ];

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
          showStudySwitcher
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
