/**
 * WorkspaceSelectorPage — /cro/workspace
 *
 * Rendered inside CROLayout (sidebar stays visible).
 * Two sections:
 *   1. Return to Main Dashboard
 *   2. Sponsor Workspaces — searchable, scrollable list
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Search,
  Building2,
  FlaskConical,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectSponsor,
  switchWorkspace,
  selectActiveSponsor,
} from '@/features/workspace/store/workspaceSlice';
import { enterSponsorWorkspaceAsync } from '@/features/workspace/store/sponsorViewSlice';
import { workspaceSponsorClient } from '@/features/workspace/api/workspaceSponsorClient';
import { addToast } from '@/app/notificationSlice';
import styles from './WorkspaceSelectorPage.module.css';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ── Sponsor card ────────────────────────────────────────────────────────── */
function SponsorCard({ sponsor, isActive, isEntering, onSelect }) {
  const displayName = sponsor.fullName || sponsor.organizationName || '(unnamed)';
  const orgName     = sponsor.organizationName ?? '';
  const count       = sponsor.activeStudies ?? sponsor.studyCount ?? null;
  const isOnline    = sponsor.status?.toLowerCase() !== 'inactive';

  return (
    <button
      type="button"
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={() => onSelect(sponsor)}
      disabled={isEntering}
      aria-label={`View ${displayName} workspace as read-only`}
    >
      {/* Avatar */}
      <div className={styles.cardAvatar}>
        {sponsor.photograph ? (
          <img
            src={sponsor.photograph}
            alt=""
            className={styles.cardAvatarImg}
          />
        ) : (
          <span className={styles.cardAvatarInitials}>{getInitials(displayName)}</span>
        )}
      </div>

      {/* Info */}
      <div className={styles.cardInfo}>
        <div className={styles.cardNameRow}>
          <p className={styles.cardName}>{displayName}</p>
          <span className={`${styles.statusDot} ${isOnline ? styles.statusDotOn : ''}`} />
        </div>
        {orgName && orgName !== displayName && <p className={styles.cardOrg}>{orgName}</p>}
        {count !== null && (
          <div className={styles.cardMeta}>
            <FlaskConical size={12} />
            <span>{count} active {count === 1 ? 'study' : 'studies'}</span>
          </div>
        )}
        {isActive && <span className={styles.activeBadge}>Currently Active</span>}
      </div>

      <span className={styles.viewBadge} aria-hidden="true">
        {isEntering ? <Loader2 size={14} className={styles.spinner} /> : 'View Workspace'}
        {!isEntering && <ChevronRight size={14} />}
      </span>
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function WorkspaceSelectorPage() {
  const dispatch      = useAppDispatch();
  const navigate      = useNavigate();
  const activeSponsor = useAppSelector(selectActiveSponsor);

  const [sponsors,    setSponsors]    = useState([]);
  const [query,       setQuery]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [enteringId,  setEnteringId]  = useState(null);
  const [reloadTick,  setReloadTick]  = useState(0);

  // Server-side search: re-fetches with ?search= when query changes (debounced).
  // Reload via setReloadTick(n => n + 1).
  useEffect(() => {
    const delay = query ? 250 : 0;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      workspaceSponsorClient
        .list({ search: query.trim() || undefined })
        .then((data) => setSponsors(data))
        .catch(() => setError('Failed to load workspaces. Please try again.'))
        .finally(() => setLoading(false));
    }, delay);
    return () => clearTimeout(handle);
  }, [query, reloadTick]);

  const reload = () => setReloadTick((n) => n + 1);

  const handleMainDashboard = () => {
    dispatch(switchWorkspace('cro'));
    navigate('/cro/dashboard');
  };

  const handleSelect = async (sponsor) => {
    if (!sponsor.id || enteringId) return;
    setEnteringId(sponsor.id);
    try {
      const action = await dispatch(enterSponsorWorkspaceAsync(sponsor.id));
      if (enterSponsorWorkspaceAsync.fulfilled.match(action)) {
        // Keep activeSponsor reflected for the selector UI.
        const name = sponsor.fullName || sponsor.organizationName || '';
        dispatch(selectSponsor({ id: sponsor.id, name }));
        navigate('/sponsor/select-study');
      } else {
        dispatch(addToast({
          type:     'error',
          message:  action.payload || 'Failed to open sponsor workspace. Please try again.',
          duration: 5000,
        }));
      }
    } finally {
      setEnteringId(null);
    }
  };

  return (
    <div className={styles.page}>

      {/* ── Page heading ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Choose Workspace</h1>
        <p className={styles.sub}>
          Open a sponsor workspace as a read-only viewer. Your CRO session stays active —
          return to the main dashboard at any time.
        </p>
      </div>

      {/* ══ Section 1: Return to Main Dashboard ══ */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Return to Main Dashboard</h2>
        <button
          type="button"
          className={`${styles.dashCard} ${!activeSponsor?.id ? styles.dashCardActive : ''}`}
          onClick={handleMainDashboard}
        >
          <div className={styles.dashIconWrap}>
            <Home size={22} />
          </div>
          <div className={styles.dashInfo}>
            <p className={styles.dashTitle}>Main Dashboard</p>
            <p className={styles.dashSub}>CRO Workspace Home</p>
          </div>
          {!activeSponsor?.id && (
            <span className={styles.currentBadge}>Current</span>
          )}
          <ChevronRight size={16} className={styles.dashChevron} />
        </button>
      </section>

      {/* ══ Section 2: Sponsor Workspaces ══ */}
      <section className={styles.section}>
        <div className={styles.sectionHeadRow}>
          <h2 className={styles.sectionHeading}>Sponsor Workspaces</h2>
          {!loading && !error && (
            <span className={styles.countBadge}>
              {sponsors.length} {sponsors.length === 1 ? 'sponsor' : 'sponsors'}
            </span>
          )}
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search sponsors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search sponsors"
          />
          {query && (
            <button className={styles.searchClear} onClick={() => setQuery('')} aria-label="Clear">
              ×
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className={styles.stateBox}>
            <Loader2 size={28} className={styles.spinner} />
            <p>Loading your workspaces...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className={styles.stateBox}>
            <AlertCircle size={28} className={styles.errorIcon} />
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={reload}>
              <RefreshCw size={13} /> Try again
            </button>
          </div>
        )}

        {/* Empty — no sponsors at all (or no results for current search) */}
        {!loading && !error && sponsors.length === 0 && (
          <div className={styles.stateBox}>
            {query ? (
              <>
                <Search size={28} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No sponsors match &ldquo;{query}&rdquo;</p>
                <button className={styles.clearSearchBtn} onClick={() => setQuery('')}>
                  Clear search
                </button>
              </>
            ) : (
              <>
                <Building2 size={36} strokeWidth={1.25} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No sponsor workspaces available.</p>
                <p className={styles.emptySub}>
                  Sponsors assigned to you will appear here.
                </p>
              </>
            )}
          </div>
        )}

        {/* Sponsor list */}
        {!loading && !error && sponsors.length > 0 && (
          <div className={styles.list}>
            {sponsors.map((sponsor) => (
              <SponsorCard
                key={sponsor.id}
                sponsor={sponsor}
                isActive={activeSponsor?.id === sponsor.id}
                isEntering={enteringId === sponsor.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
