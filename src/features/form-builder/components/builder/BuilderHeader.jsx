/**
 * BuilderHeader — sticky top bar.
 *
 * Composition (left → right):
 *   • Brand + product title
 *   • Global search (Ctrl+K)
 *   • Recent / Pinned shortcuts
 *   • Builder ⇄ Preview mode toggle
 *   • Publish button
 *   • Notifications bell
 *   • User chip
 */

import { useDispatch, useSelector } from 'react-redux';
import { Search, Bell, Clock, Bookmark, Edit3, Eye, Send } from 'lucide-react';
import { setMode, selectMode } from '@/features/form-builder/store/formSlice';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import s from './BuilderLayout.module.css';

function initials(name = '') {
  return name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '').join('') || 'PS';
}

export default function BuilderHeader() {
  const dispatch = useDispatch();
  const mode     = useSelector(selectMode);
  const user     = useAppSelector(selectCurrentUser);

  const fullName = user?.fullName || 'Prashant S.';
  const role     = user?.roleName || 'Data Manager';
  const inPreview = mode === 'preview';

  return (
    <header className={s.header}>
      {/* Brand */}
      <div className={s.brand}>
        <div className={s.brandLogo}>K</div>
        <div className={s.brandText}>
          <span className={s.brandTitle}>EDC</span>
          <span className={s.brandSub}>Form Builder</span>
        </div>
      </div>

      {/* Global search */}
      <div className={s.searchWrap}>
        <div className={s.search}>
          <Search size={14} className={s.searchIcon} />
          <input
            type="text"
            className={s.searchInput}
            placeholder="Search pages, blocks, fields, queries..."
          />
          <span className={s.searchKbd}>Ctrl + K</span>
        </div>
      </div>

      {/* Actions */}
      <div className={s.headerActions}>
        <button type="button" className={s.headerBtn}>
          <Clock size={14} /> Recent
        </button>
        <button type="button" className={s.headerBtn}>
          <Bookmark size={14} /> Pinned
        </button>

        {/* Mode toggle — segmented control */}
        <div className={s.modeSeg}>
          <button
            type="button"
            className={`${s.modeSegBtn} ${!inPreview ? s.modeSegBtnActive : ''}`}
            onClick={() => dispatch(setMode('editor'))}
          >
            <Edit3 size={13} /> Edit
          </button>
          <button
            type="button"
            className={`${s.modeSegBtn} ${inPreview ? s.modeSegBtnActive : ''}`}
            onClick={() => dispatch(setMode('preview'))}
          >
            <Eye size={13} /> Preview
          </button>
        </div>

        {/* Publish */}
        <button type="button" className={s.publishBtn}>
          <Send size={13} /> Publish
        </button>

        {/* Notifications */}
        <button type="button" className={s.notif} aria-label="Notifications">
          <Bell size={16} color="#475569" />
          <span className={s.notifBadge}>12</span>
        </button>

        {/* User */}
        <div className={s.user}>
          <div className={s.userAvatar}>{initials(fullName)}</div>
          <div className={s.userMeta}>
            <span className={s.userName}>{fullName}</span>
            <span className={s.userRole}>{role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
