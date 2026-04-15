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
import { sponsorService } from '@/services/sponsorService';
import styles from './WorkspaceSelectorPage.module.css';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ── Sponsor card ────────────────────────────────────────────────────────── */
function SponsorCard({ sponsor, isActive, onSelect }) {
  const orgName  = sponsor.organizationName ?? sponsor.orgName ?? '';
  const count    = sponsor.activeStudies ?? sponsor.studyCount ?? null;
  const isOnline = sponsor.status?.toLowerCase() !== 'inactive';

  return (
    <button
      type="button"
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={() => onSelect(sponsor)}
      aria-label={`Open ${sponsor.name} workspace`}
    >
      {/* Avatar */}
      <div className={styles.cardAvatar}>
        {sponsor.photo || sponsor.photograph ? (
          <img
            src={sponsor.photo ?? sponsor.photograph}
            alt=""
            className={styles.cardAvatarImg}
          />
        ) : (
          <span className={styles.cardAvatarInitials}>{getInitials(sponsor.name)}</span>
        )}
      </div>

      {/* Info */}
      <div className={styles.cardInfo}>
        <div className={styles.cardNameRow}>
          <p className={styles.cardName}>{sponsor.name}</p>
          <span className={`${styles.statusDot} ${isOnline ? styles.statusDotOn : ''}`} />
        </div>
        {orgName && <p className={styles.cardOrg}>{orgName}</p>}
        {count !== null && (
          <div className={styles.cardMeta}>
            <FlaskConical size={12} />
            <span>{count} active {count === 1 ? 'study' : 'studies'}</span>
          </div>
        )}
        {isActive && <span className={styles.activeBadge}>Currently Active</span>}
      </div>

      <ChevronRight size={16} className={styles.cardChevron} />
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function WorkspaceSelectorPage() {
  const dispatch      = useAppDispatch();
  const navigate      = useNavigate();
  const activeSponsor = useAppSelector(selectActiveSponsor);

  const [sponsors, setSponsors] = useState([]);
  const [query,    setQuery]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    sponsorService
      .list()
      .then((data) => setSponsors(Array.isArray(data) ? data : (data?.items ?? data?.data ?? [])))
      .catch(() => setError('Failed to load workspaces. Please try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = sponsors.filter((s) => {
    const q = query.toLowerCase();
    return (
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.organizationName?.toLowerCase().includes(q) ||
      s.orgName?.toLowerCase().includes(q)
    );
  });

  const handleMainDashboard = () => {
    dispatch(switchWorkspace('cro'));
    navigate('/cro/dashboard');
  };

  const handleSelect = (sponsor) => {
    dispatch(selectSponsor({ id: sponsor.id, name: sponsor.name }));
    navigate(`/workspace/${sponsor.id}/studies`);
  };

  return (
    <div className={styles.page}>

      {/* ── Page heading ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Choose Workspace</h1>
        <p className={styles.sub}>
          Select a sponsor to browse their studies and open a study workspace.
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
              {filtered.length} of {sponsors.length}
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
            <button className={styles.retryBtn} onClick={load}>
              <RefreshCw size={13} /> Try again
            </button>
          </div>
        )}

        {/* Empty — no sponsors at all */}
        {!loading && !error && sponsors.length === 0 && (
          <div className={styles.stateBox}>
            <Building2 size={36} strokeWidth={1.25} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No sponsor workspaces available.</p>
            <p className={styles.emptySub}>
              Sponsors assigned to you will appear here.
            </p>
          </div>
        )}

        {/* Empty — search no results */}
        {!loading && !error && sponsors.length > 0 && filtered.length === 0 && (
          <div className={styles.stateBox}>
            <Search size={28} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No sponsors match &ldquo;{query}&rdquo;</p>
            <button className={styles.clearSearchBtn} onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        )}

        {/* Sponsor list */}
        {!loading && !error && filtered.length > 0 && (
          <div className={styles.list}>
            {filtered.map((sponsor) => (
              <SponsorCard
                key={sponsor.id}
                sponsor={sponsor}
                isActive={activeSponsor?.id === sponsor.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
