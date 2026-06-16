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
  Activity,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  selectSidebarCollapsed,
  toggleSidebar,
} from '@/features/workspace/store/workspaceSlice';
import { selectPermissions, selectPermissionsTree } from '@/features/auth/authSlice';
import Sidebar                 from '@/components/layout/Sidebar';
import brandLogo               from '@/assets/images/SclinNexus_color_logo.png';
import WorkspaceHeader         from './WorkspaceHeader';
import SponsorWorkspacePicker  from '@/features/workspace/components/SponsorWorkspacePicker';
import styles                  from './CROLayout.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

/* ── Nav definitions ──────────────────────────────────────────────────────
 *
 * `permission` values are snake_case `{leaf}.{action}` keys that match the
 * backend's resolved permission tree from /api/v1/profile/me/permissions
 * exactly. Do NOT use the canonical PUT-side feature_name keys (e.g.
 * "Dashboard.StudyPortfolioOverview") here — that vocabulary is only for
 * the role-editor's PUT body. The consumer side reads the snake_case tree.
 *
 * Dashboard sub-pages (Study Portfolio Overview, CRO Team Utilization)
 * both collapse into ONE leaf `dashboard` on the consumer side — there's
 * no per-sub-feature gating from /profile/me/permissions.
 *
 * Activity Log and Workspace are top-level leaves (no group prefix). */
const NAV_ITEMS = [
  {
    key:        'dashboard',
    label:      'Dashboard',
    icon:       LayoutDashboard,
    path:       '/cro/dashboard',
    permission: 'dashboard.view',
  },
  {
    key:   'masters',
    label: 'Masters',
    icon:  Layers,
    children: [
      { key: 'email-templates', label: 'Email Templates', path: '/cro/masters/email-templates', permission: 'email_templates.view' },
      { key: 'study-phases',    label: 'Study Phases',    path: '/cro/masters/study-phases',    permission: 'study_phases.view'    },
      { key: 'country',         label: 'Country',         path: '/cro/masters/country',         permission: 'countries.view'       },
      { key: 'locations',       label: 'Locations',       path: '/cro/masters/locations',       permission: 'locations.view'       },
      { key: 'regions',         label: 'Regions',         path: '/cro/masters/regions',         permission: 'regions.view'         },
      { key: 'annotations',     label: 'Annotations',     path: '/cro/masters/annotations',     permission: 'annotations.view'     },
    ],
  },
  {
    key:   'clinical-programs',
    label: 'Clinical Programs',
    icon:  FlaskConical,
    children: [
      { key: 'sponsors', label: 'Sponsors', path: '/cro/sponsors', permission: 'sponsors.view' },
      { key: 'studies',  label: 'Studies',  path: '/cro/studies',  permission: 'studies.view'  },
    ],
  },
  {
    key:   'team',
    label: 'CRO Team Administration',
    icon:  Users,
    children: [
      { key: 'team-members',  label: 'Team Members',        path: '/cro/team/members',  permission: 'team_members.view' },
      { key: 'team-roles',    label: 'Roles & Permissions', path: '/cro/team/roles',    permission: 'roles.view'        },
    ],
  },
  {
    key:        'activity-log',
    label:      'Activity Log',
    icon:       Activity,
    path:       '/cro/activity-log',
    permission: 'activity_log.view',
  },
];

// Profile Settings is no longer a left-menu group — it lives in the footer
// ProfileCard (My Profile / Change Password / Logout). See Sidebar.ProfileCard.

/* ── Layout component ─────────────────────────────────────────────────────── */
export default function CROLayout() {
  const dispatch    = useAppDispatch();
  const collapsed   = useAppSelector(selectSidebarCollapsed);
  const permsArr    = useAppSelector(selectPermissions);
  const permsTree   = useAppSelector(selectPermissionsTree);
  const isAdmin     = permsTree === '*' || (Array.isArray(permsArr) && permsArr.includes('*'));

  const [mobileOpen, setMobileOpen] = useState(false);

  /* Permission check — read directly from the backend's leaf tree.
     `permission` strings are "leaf.action" snake_case (e.g. "dashboard.view"),
     matching the shape of /api/v1/profile/me/permissions. Missing keys are
     treated as false (deny by default). */
  const can = (permissionStr) => {
    if (!permissionStr)   return true;       // unrestricted item
    if (isAdmin)          return true;       // super-admin
    if (!permsTree)       return false;      // logged out / not loaded
    const [leaf, action] = permissionStr.split('.');
    const node = permsTree[leaf];
    if (!node) return false;
    if (node === true || node === '*') return true;
    return Boolean(node[action]);
  };

  /* Permission-filter a flat or nested items array.
     A group (item with `children`) is dropped if filtering empties it out —
     otherwise we'd render orphan group headers (Masters, Clinical Programs…)
     even when the user has no permission for any item underneath them. */
  const filterItems = (items) =>
    items
      .filter((item) => can(item.permission))
      .map((item) => ({
        ...item,
        children: item.children ? filterItems(item.children) : undefined,
      }))
      .filter((item) => !item.children || item.children.length > 0);

  const navItems    = filterItems(NAV_ITEMS);
  // Profile Settings removed from the left menu (spec) — My Profile / Change
  // Password / Logout now live only in the footer ProfileCard.
  const bottomItems = [];

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
        changePasswordPath="/cro/profile/password"
        notificationsPath="/cro/activity-log"
        logoUrl={brandLogo}
        subtitle="CRO Workspace"
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
