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
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  selectSidebarCollapsed,
  toggleSidebar,
  selectActiveStudy,
} from '@/features/workspace/workspaceSlice';
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
    { key: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, path: `${base}/dashboard`    },
    { key: 'capture',      label: 'Data Capture',  icon: Database,        path: `${base}/capture`      },
    ...(study?.config?.consentEnabled ? [
      { key: 'consent', label: 'Consent', icon: FileCheck, path: `${base}/consent/config` },
    ] : []),
    ...(study?.config?.queryEnabled ? [
      { key: 'queries', label: 'Queries', icon: MessageSquare, path: `${base}/queries` },
    ] : []),
    { key: 'verification', label: 'Verification', icon: ShieldCheck,     path: `${base}/verification` },
    { key: 'sites',        label: 'Sites',        icon: MapPin,          path: `${base}/sites`        },
    { key: 'personnel',    label: 'Personnel',    icon: Users,           path: `${base}/personnel`    },
    { key: 'reports',      label: 'Reports',      icon: BarChart2,       path: `${base}/reports`      },
  ];

  const bottomNav = [
    { key: 'activity-log', label: 'Activity Log', icon: Activity,    path: `${base}/activity-log` },
    { key: 'profile',      label: 'Profile',      icon: UserCircle,  path: `${base}/personnel`    },
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
        notificationsPath={`${base}/activity-log`}
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
