/**
 * WorkspaceHeader — top navigation bar for all layout shells
 *
 * Props:
 *   onToggleSidebar    () => void
 *   showBreadcrumb     boolean
 *   showEnvironmentBadge boolean
 *   showStudySwitcher  boolean
 *   showGlobalSearch   boolean
 *   rightActions       ReactNode — extra buttons injected by the layout
 *   breadcrumb         Array<{ key, label, href? }>
 *   onSwitchStudy      () => void
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Menu,
  Search,
  X,
  ChevronDown,
  LogOut,
  User,
  Settings,
  ArrowLeftRight,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { selectCurrentUser, logout }      from '@/features/auth/authSlice';
import {
  selectActiveStudy,
  selectEnvironment,
} from '@/features/workspace/workspaceSlice';
import styles from './WorkspaceHeader.module.css';

const clx = (...a) => a.filter(Boolean).join(' ');

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function WorkspaceHeader({
  onToggleSidebar,
  showBreadcrumb,
  showEnvironmentBadge,
  showStudySwitcher,
  showGlobalSearch,
  rightActions,
  breadcrumb,
  onSwitchStudy,
}) {
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();
  const user        = useAppSelector(selectCurrentUser);
  const study       = useAppSelector(selectActiveStudy);
  const environment = useAppSelector(selectEnvironment);

  const [searchOpen, setSearchOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef  = useRef(null);
  const searchRef  = useRef(null);
  const searchInputRef = useRef(null);

  /* Close avatar menu on outside click */
  useEffect(() => {
    if (!avatarOpen) return;
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [avatarOpen]);

  /* Focus search input when it opens */
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  /* ESC closes search */
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') setSearchOpen(false);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <header className={styles.header}>
      {/* ── Left ────────────────────────────────────────────────── */}
      <div className={styles.left}>
        {/* Hamburger — visible below 1024 px */}
        <button
          type="button"
          className={styles.hamburger}
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        {showBreadcrumb && breadcrumb && breadcrumb.length > 0 && (
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.key ?? i} className={styles.breadcrumbItem}>
                {i > 0 && <span className={styles.breadcrumbSep} aria-hidden="true">/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className={styles.breadcrumbLink}>{crumb.label}</a>
                ) : (
                  <span className={styles.breadcrumbCurrent}>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* ── Right ───────────────────────────────────────────────── */}
      <div className={styles.right}>
        {/* Global search */}
        {showGlobalSearch && (
          <div
            className={clx(styles.searchWrap, searchOpen && styles.searchExpanded)}
            ref={searchRef}
          >
            {searchOpen ? (
              <>
                <Search size={16} className={styles.searchIcon} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search…"
                  onKeyDown={handleSearchKeyDown}
                />
                <button
                  type="button"
                  className={styles.searchClose}
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.searchToggle}
                onClick={() => setSearchOpen(true)}
                aria-label="Open search"
              >
                <Search size={18} />
              </button>
            )}
          </div>
        )}

        {/* Environment badge */}
        {showEnvironmentBadge && environment && (
          <span className={clx(styles.envBadge, styles[`env${environment}`])}>
            {environment}
          </span>
        )}

        {/* Study switcher */}
        {showStudySwitcher && (
          <button
            type="button"
            className={styles.studySwitcher}
            onClick={onSwitchStudy}
            title="Switch study"
          >
            <ArrowLeftRight size={14} aria-hidden="true" />
            <span className={styles.studyTitle}>
              {study?.title || 'Select Study'}
            </span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        )}

        {/* Injected right actions */}
        {rightActions}

        {/* Avatar / user menu */}
        <div className={styles.avatarWrap} ref={avatarRef}>
          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => setAvatarOpen((o) => !o)}
            aria-label="Open user menu"
            aria-expanded={avatarOpen}
            aria-haspopup="menu"
          >
            {user?.photograph ? (
              <img
                src={user.photograph}
                alt={user.fullName}
                className={styles.avatarImg}
              />
            ) : (
              <span className={styles.avatarInitials}>
                {getInitials(user?.fullName)}
              </span>
            )}
            <span className={styles.avatarName}>{user?.fullName}</span>
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={clx(styles.avatarChevron, avatarOpen && styles.avatarChevronOpen)}
            />
          </button>

          {avatarOpen && (
            <div className={styles.dropdown} role="menu">
              {/* User info */}
              <div className={styles.dropdownHeader}>
                {user?.photograph ? (
                  <img src={user.photograph} alt="" className={styles.dropdownAvatar} />
                ) : (
                  <span className={clx(styles.avatarInitials, styles.dropdownAvatarLg)}>
                    {getInitials(user?.fullName)}
                  </span>
                )}
                <div className={styles.dropdownUserInfo}>
                  <p className={styles.dropdownName}>{user?.fullName}</p>
                  <p className={styles.dropdownEmail}>{user?.email}</p>
                </div>
              </div>

              <div className={styles.dropdownDivider} />

              <button
                type="button"
                role="menuitem"
                className={styles.dropdownItem}
                onClick={() => { navigate('/profile'); setAvatarOpen(false); }}
              >
                <User size={15} aria-hidden="true" />
                Profile
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownItem}
                onClick={() => { navigate('/settings'); setAvatarOpen(false); }}
              >
                <Settings size={15} aria-hidden="true" />
                Settings
              </button>

              <div className={styles.dropdownDivider} />

              <button
                type="button"
                role="menuitem"
                className={clx(styles.dropdownItem, styles.dropdownItemDanger)}
                onClick={handleLogout}
              >
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

WorkspaceHeader.propTypes = {
  onToggleSidebar:      PropTypes.func.isRequired,
  showBreadcrumb:       PropTypes.bool,
  showEnvironmentBadge: PropTypes.bool,
  showStudySwitcher:    PropTypes.bool,
  showGlobalSearch:     PropTypes.bool,
  rightActions:         PropTypes.node,
  breadcrumb:           PropTypes.arrayOf(
    PropTypes.shape({
      key:   PropTypes.string,
      label: PropTypes.string.isRequired,
      href:  PropTypes.string,
    }),
  ),
  onSwitchStudy: PropTypes.func,
};

WorkspaceHeader.defaultProps = {
  showBreadcrumb:       false,
  showEnvironmentBadge: false,
  showStudySwitcher:    false,
  showGlobalSearch:     false,
  rightActions:         null,
  breadcrumb:           [],
  onSwitchStudy:        () => {},
};
