import { useState, useRef, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout, selectCurrentUser } from "@/features/auth/authSlice";
import {
  LayoutGrid,
  User,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import styles from "./Sidebar.module.css";

const clx = (...a) => a.filter(Boolean).join(" ");

// ─── WorkspaceSwitcher (top header) ──────────────────────────────────────────
function WorkspaceSwitcher({ collapsed }) {
  return (
    <div className={styles.wsArea}>
      <div className={clx(styles.wsHeader, collapsed && styles.isCollapsed)}>
        <div className={styles.wsLogo}>
          <LayoutGrid size={16} strokeWidth={2} />
        </div>
        <div className={clx(styles.wsInfo, collapsed && styles.wsInfoHidden)}>
          <p className={styles.wsTitle}>Clinical Trials</p>
          <p className={styles.wsSubtitle}>Admin Dashboard</p>
        </div>
      </div>
    </div>
  );
}

// ─── ProfileCard ─────────────────────────────────────────────────────────────
function ProfileCard({ collapsed, profilePath, settingsPath }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const navigate        = useNavigate();
  const dispatch        = useAppDispatch();
  const user            = useAppSelector(selectCurrentUser);

  const handleLogout = () => {
    dispatch(logout());
    setOpen(false);
    navigate("/");
  };

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div ref={ref} className={styles.profileWrap}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={clx(
          styles.profileTrigger,
          collapsed && styles.triggerCollapsed,
          open && styles.profileOpen,
        )}
      >
        <div className={styles.profileAvatar}>
          <div className={styles.avatarCircle}>
            <span className={styles.avatarInitial}>{initials}</span>
          </div>
          <span className={styles.statusDot} />
        </div>
        <div className={clx(styles.profileInfo, collapsed && styles.profileInfoHidden)}>
          <p className={styles.profileName}>{user?.fullName ?? "User"}</p>
          <p className={styles.profileEmail}>{user?.email ?? ""}</p>
        </div>
      </button>

      {open && (
        <div className={styles.profileDropdown}>
          <Link to={profilePath} onClick={() => setOpen(false)} className={styles.pdLink}>
            <User size={16} className={styles.pdIcon} />
            Profile
          </Link>
          <Link to={settingsPath} onClick={() => setOpen(false)} className={styles.pdLink}>
            <Settings size={16} className={styles.pdIcon} />
            Settings
          </Link>
          <div className={styles.pdDivider} />
          <button onClick={handleLogout} className={styles.pdBtn}>
            <LogOut size={16} className={styles.pdIcon} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CollapseTooltip ──────────────────────────────────────────────────────────
function CollapseTooltip({ label }) {
  return <div className={styles.tooltip}>{label}</div>;
}

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({ item, collapsed }) {
  const Icon        = item.icon;
  const hasChildren = Boolean(item.children?.length);
  const [open, setOpen] = useState(false);

  if (hasChildren && !collapsed) {
    return (
      <div>
        <button onClick={() => setOpen((v) => !v)} className={styles.navGroup}>
          <div className={styles.navGroupLeft}>
            {Icon && <Icon size={17} />}
            <span className={styles.navGroupLabel}>{item.label}</span>
          </div>
          <ChevronRight
            size={14}
            className={clx(styles.navGroupChevron, open && styles.chevronOpen)}
          />
        </button>
        {open && (
          <div className={styles.navSublist}>
            {item.children.map((child) => (
              <NavLink
                key={child.key}
                to={child.path}
                end
                className={({ isActive }) =>
                  clx(styles.navSubItem, isActive && styles.subItemActive)
                }
              >
                <span className={styles.navBullet} />
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (hasChildren && collapsed) {
    return (
      <NavLink
        to={item.children[0]?.path ?? item.path ?? "#"}
        className={({ isActive }) =>
          clx(styles.navGroupIcon, isActive && styles.childIsActive)
        }
      >
        {Icon && <Icon size={17} />}
        <CollapseTooltip label={item.label} />
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        clx(styles.navItem, isActive && styles.navActive, collapsed && styles.navCollapsed)
      }
    >
      {Icon && <Icon size={17} />}
      {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
      {collapsed && <CollapseTooltip label={item.label} />}
    </NavLink>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({
  items,
  bottomItems,
  collapsed,
  setCollapsed,
  mobileOpen,
  onMobileClose,
  profilePath,
  settingsPath,
  notificationsPath,
}) {
  return (
    <aside
      className={clx(
        styles.sidebar,
        collapsed  && styles.collapsed,
        mobileOpen && styles.mobileOpen,
      )}
    >
      <button onClick={onMobileClose} className={styles.mobileCloseBtn} aria-label="Close sidebar">
        <X size={18} />
      </button>

      <WorkspaceSwitcher collapsed={collapsed} />

      <nav className={styles.navScroll}>
        <div className={styles.navSection}>
          <div className={styles.sectionItems}>
            {items.map((item) => (
              <NavItem key={item.key} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {bottomItems?.length > 0 && (
          <div className={clx(styles.navSection, styles.navSectionGap)}>
            {!collapsed && <p className={styles.sectionLabel}>Account</p>}
            {collapsed   && <div className={styles.sectionDivider} />}
            <div className={styles.sectionItems}>
              {bottomItems.map((item) => (
                <NavItem key={item.key} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className={styles.footer}>
        <NavLink
          to={notificationsPath ?? "#"}
          className={({ isActive }) =>
            clx(
              styles.footerLink,
              isActive && notificationsPath && styles.footerActive,
              collapsed && styles.footerCollapsed,
            )
          }
        >
          <Bell size={17} />
          {!collapsed && <span className={styles.footerLinkLabel}>Notifications</span>}
          {collapsed   && <CollapseTooltip label="Notifications" />}
        </NavLink>

        <ProfileCard
          collapsed={collapsed}
          profilePath={profilePath  ?? "#"}
          settingsPath={settingsPath ?? "#"}
        />

        <button
          onClick={() => setCollapsed((v) => !v)}
          className={clx(collapsed ? styles.collapseBtnIcon : styles.collapseBtn)}
        >
          {collapsed
            ? <ChevronsRight size={17} />
            : <><ChevronsLeft size={17} /><span className={styles.collapseLabel}>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}
