/**
 * SponsorLayout — study-context-aware workspace shell
 *
 * Dynamic nav is built from studyConfig flags:
 *   consentEnabled → shows Consent link
 *   queryEnabled   → shows Queries link
 *
 * Header shows:
 *   - Study title + environment badge (UAT=amber, LIVE=green)
 *   - Switch Study button
 *   - Global search
 */

import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  FileCheck,
  MessageSquare,
  ShieldCheck,
  MapPin,
  Users,
  BarChart2,
  Activity,
  UserCircle,
  BookOpen,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  selectSidebarCollapsed,
  toggleSidebar,
  selectActiveStudy,
} from '@/features/workspace/store/workspaceSlice';
import Sidebar         from '@/components/layout/Sidebar';
import WorkspaceHeader from './WorkspaceHeader';
import styles          from './SponsorLayout.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/* ── Layout component ─────────────────────────────────────────────────────── */
export default function SponsorLayout() {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const { studyId } = useParams();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const study     = useAppSelector(selectActiveStudy);

  const [mobileOpen, setMobileOpen] = useState(false);

  const base = `/sponsor/${studyId}`;

  /* Build dynamic nav from studyConfig */
  const navItems = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: `${base}/dashboard`,
    },
    {
      key: 'capture',
      label: 'Data Capture',
      icon: Database,
      path: `${base}/capture`,
    },
    {
      key: 'masters',
      label: 'Masters',
      icon: BookOpen,
      children: [
        { key: 'masters-email',     label: 'Email Templates', path: `${base}/masters/email-templates` },
        { key: 'masters-countries', label: 'Country',         path: `${base}/masters/countries`       },
        { key: 'masters-locations', label: 'Locations',       path: `${base}/masters/locations`       },
      ],
    },
    ...(study?.config?.consentEnabled !== false ? [{
      key: 'consent',
      label: 'Consent Management',
      icon: FileCheck,
      children: [
        { key: 'consent-builder', label: 'Consent Builder',           path: `${base}/consent/config` },
        { key: 'consent-review',  label: 'Consent Review & Approval', path: `${base}/consent/review` },
      ],
    }] : []),
    {
      key: 'queries',
      label: 'Query Management',
      icon: MessageSquare,
      path: `${base}/queries`,
    },
    {
      key: 'verification',
      label: 'Data Verification Management',
      icon: ShieldCheck,
      path: `${base}/verification`,
    },
    {
      key: 'sites',
      label: 'Site Management',
      icon: MapPin,
      children: [
        { key: 'sites-list', label: 'Sites',          path: `${base}/sites`     },
        { key: 'personnel',  label: 'Site Personnel', path: `${base}/personnel` },
        { key: 'roles',      label: 'Site Role',      path: `${base}/roles`     },
      ],
    },
  ];

  const bottomNav = [
    { key: 'activity-log', label: 'Activity Log', icon: Activity,   path: `${base}/activity-log` },
    { key: 'reports',      label: 'Reports',      icon: BarChart2,  path: `${base}/reports`      },
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
        profilePath={`${base}/personnel`}
        settingsPath={`${base}/personnel`}
        notificationsPath={null}
      />

      <div className={clx(styles.body, collapsed && styles.bodyCollapsed)}>
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
