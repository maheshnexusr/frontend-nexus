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
  UserCircle,
  Activity,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  selectSidebarCollapsed,
  toggleSidebar,
} from '@/features/workspace/store/workspaceSlice';
import { selectPermissions } from '@/features/auth/authSlice';
import Sidebar                 from '@/components/layout/Sidebar';
import WorkspaceHeader         from './WorkspaceHeader';
import SponsorWorkspacePicker  from '@/features/workspace/components/SponsorWorkspacePicker';
import styles                  from './CROLayout.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/* ── Nav definitions ──────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    key:        'dashboard',
    label:      'Dashboard',
    icon:       LayoutDashboard,
    path:       '/cro/dashboard',
    permission: 'dashboard.studyPortfolio.view',
  },
  {
    key:   'masters',
    label: 'Masters',
    icon:  Layers,
    children: [
      { key: 'email-templates', label: 'Email Templates', path: '/cro/masters/email-templates', permission: 'masters.emailTemplates.view' },
      { key: 'study-phases',    label: 'Study Phases',    path: '/cro/masters/study-phases',    permission: 'masters.studyPhases.view'    },
      { key: 'country',         label: 'Country',         path: '/cro/masters/country',         permission: 'masters.country.view'        },
      { key: 'locations',       label: 'Locations',       path: '/cro/masters/locations',       permission: 'masters.locations.view'      },
      { key: 'regions',         label: 'Regions',         path: '/cro/masters/regions'                                                   },
    ],
  },
  {
    key:   'clinical-programs',
    label: 'Clinical Programs',
    icon:  FlaskConical,
    children: [
      { key: 'sponsors', label: 'Sponsors', path: '/cro/sponsors', permission: 'clinicalPrograms.sponsors.view' },
      { key: 'studies',  label: 'Studies',  path: '/cro/studies',  permission: 'clinicalPrograms.studies.view'  },
    ],
  },
  {
    key:   'team',
    label: 'CRO Team Administration',
    icon:  Users,
    children: [
      { key: 'team-members', label: 'Team Members',        path: '/cro/team/members', permission: 'teamAdmin.teamMembers.view'      },
      { key: 'team-roles',   label: 'Roles & Permissions', path: '/cro/team/roles',   permission: 'teamAdmin.rolesPermissions.view' },
    ],
  },
  {
    key:        'activity-log',
    label:      'Activity Log',
    icon:       Activity,
    path:       '/cro/activity-log',
    permission: 'masters.activityLog.view',
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
  const isAdmin     = permissions.includes('*');

  const [mobileOpen, setMobileOpen] = useState(false);

  /* Permission-filter a flat or nested items array */
  const filterItems = (items) =>
    items
      .filter((item) => isAdmin || !item.permission || permissions.includes(item.permission))
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
          rightActions={<SponsorWorkspacePicker />}
        />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
