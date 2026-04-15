/**
 * CROLayout — main admin workspace shell
 *
 * Navigation groups:
 *   Dashboard | Sponsors & Studies | CRO Team Admin | Masters | Profile Settings
 *
 * Features:
 *   - Collapsible sidebar (Redux-persisted for desktop)
 *   - Overlay drawer on mobile/tablet (<1024 px)
 *   - Permission-filtered nav items
 *   - Global search + breadcrumb via WorkspaceHeader
 */

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  FlaskConical,
  Users,
  Building2,
  UserCircle,
  Activity,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  selectSidebarCollapsed,
  toggleSidebar,
} from '@/features/workspace/store/workspaceSlice';
import { selectPermissions } from '@/features/auth/authSlice';
import Sidebar         from '@/components/layout/Sidebar';
import WorkspaceHeader from './WorkspaceHeader';
import styles          from './CROLayout.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/* ── Nav definitions ──────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    key:   'dashboard',
    label: 'Dashboard',
    icon:  LayoutDashboard,
    path:  '/cro/dashboard',
  },
  {
    key:   'masters',
    label: 'Masters',
    icon:  Layers,
    children: [
      { key: 'email-templates', label: 'Email Templates', path: '/cro/masters/email-templates' },
      { key: 'study-phases',    label: 'Study Phases',    path: '/cro/masters/study-phases'    },
      { key: 'country',         label: 'Country',         path: '/cro/masters/country'         },
      { key: 'locations',       label: 'Locations',       path: '/cro/masters/locations'       },
      { key: 'regions',         label: 'Regions',         path: '/cro/masters/regions'         },
    ],
  },
  {
    key:   'clinical-programs',
    label: 'Clinical Programs',
    icon:  FlaskConical,
    children: [
      { key: 'sponsors', label: 'Sponsors', path: '/cro/sponsors' },
      { key: 'studies',  label: 'Studies',  path: '/cro/studies'  },
    ],
  },
  {
    key:   'team',
    label: 'CRO Team Administration',
    icon:  Users,
    children: [
      { key: 'team-members', label: 'Team Members',       path: '/cro/team/members' },
      { key: 'team-roles',   label: 'Roles & Permissions', path: '/cro/team/roles'  },
    ],
  },
  {
    key:   'activity-log',
    label: 'Activity Log',
    icon:  Activity,
    path:  '/cro/activity-log',
  },
  {
    key:   'workspace',
    label: 'Choose Sponsor Workspace',
    icon:  Building2,
    path:  '/cro/workspace',
  },
];

const BOTTOM_NAV = [
  {
    key:   'profile',
    label: 'Profile Settings',
    icon:  UserCircle,
    children: [
      { key: 'my-profile',      label: 'My Profile',      path: '/cro/profile'          },
      { key: 'change-password', label: 'Change Password',  path: '/cro/profile/password' },
    ],
  },
];

/* ── Layout component ─────────────────────────────────────────────────────── */
export default function CROLayout() {
  const dispatch    = useAppDispatch();
  const collapsed   = useAppSelector(selectSidebarCollapsed);
  const permissions = useAppSelector(selectPermissions);

  const [mobileOpen, setMobileOpen] = useState(false);

  /* Permission-filter a flat or nested items array */
  const filterItems = (items) =>
    items
      .filter((item) => !item.permission || permissions.includes(item.permission))
      .map((item) => ({
        ...item,
        children: item.children ? filterItems(item.children) : undefined,
      }));

  const navItems    = filterItems(NAV_ITEMS);
  const bottomItems = filterItems(BOTTOM_NAV);

  /* Close mobile drawer when viewport becomes desktop */
  useEffect(() => {
    const sync = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  /* Sidebar toggle: drawer on mobile, collapse on desktop */
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
        bottomItems={bottomItems}
        collapsed={collapsed}
        setCollapsed={() => dispatch(toggleSidebar())}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        profilePath="/cro/profile"
        settingsPath="/cro/profile"
        notificationsPath="/cro/activity-log"
      />

      {/* Main body shifts right by sidebar width on desktop */}
      <div className={clx(styles.body, collapsed && styles.bodyCollapsed)}>
        <WorkspaceHeader
          onToggleSidebar={handleToggleSidebar}
          showBreadcrumb
          showGlobalSearch
        />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
