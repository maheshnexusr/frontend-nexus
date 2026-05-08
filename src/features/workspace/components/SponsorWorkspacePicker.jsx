import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, ChevronDown, Search, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectSponsor } from '@/features/workspace/store/workspaceSlice';
import {
  enterSponsorWorkspaceAsync,
  selectIsSponsorReadOnly,
  selectSponsorViewSponsor,
} from '@/features/workspace/store/sponsorViewSlice';
import { workspaceSponsorClient } from '@/features/workspace/api/workspaceSponsorClient';
import { addToast } from '@/app/notificationSlice';
import styles from './SponsorWorkspacePicker.module.css';

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function SponsorWorkspacePicker() {
  const dispatch       = useAppDispatch();
  const navigate       = useNavigate();
  const isReadOnly     = useAppSelector(selectIsSponsorReadOnly);
  const viewingSponsor = useAppSelector(selectSponsorViewSponsor);
  const activeId       = isReadOnly ? viewingSponsor?.id : null;
  const activeName     = isReadOnly
    ? (viewingSponsor?.organizationName || viewingSponsor?.fullName || '')
    : '';

  const [open,       setOpen]       = useState(false);
  const [query,      setQuery]      = useState('');
  const [sponsors,   setSponsors]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [enteringId, setEnteringId] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const wrapRef   = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const delay = query ? 250 : 0;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      workspaceSponsorClient
        .list({ search: query.trim() || undefined })
        .then((data) => setSponsors(data))
        .catch(() => setError('Failed to load workspaces.'))
        .finally(() => setLoading(false));
    }, delay);
    return () => clearTimeout(handle);
  }, [open, query, reloadTick]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSelect = async (sponsor) => {
    if (!sponsor.id || enteringId) return;
    setEnteringId(sponsor.id);
    try {
      const action = await dispatch(enterSponsorWorkspaceAsync(sponsor.id));
      if (enterSponsorWorkspaceAsync.fulfilled.match(action)) {
        const name = sponsor.fullName || sponsor.organizationName || '';
        dispatch(selectSponsor({ id: sponsor.id, name }));
        setOpen(false);
        navigate('/sponsor/select-study');
      } else {
        dispatch(addToast({
          type:    'error',
          message: action.payload || 'Failed to open sponsor workspace.',
        }));
      }
    } finally {
      setEnteringId(null);
    }
  };

  const triggerLabel = activeName || 'Sponsor Workspace';

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Open a sponsor workspace as read-only"
      >
        <Building2 size={14} aria-hidden="true" />
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.panelHead}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                className={styles.searchInput}
                placeholder="Search sponsors…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search sponsors"
              />
            </div>
          </div>

          <div className={styles.body}>
            {loading && (
              <div className={styles.state}>
                <Loader2 size={18} className={styles.spinner} />
                <span>Loading…</span>
              </div>
            )}

            {!loading && error && (
              <div className={styles.state}>
                <AlertCircle size={18} className={styles.errorIcon} />
                <span>{error}</span>
                <button
                  type="button"
                  className={styles.retry}
                  onClick={() => setReloadTick((n) => n + 1)}
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}

            {!loading && !error && sponsors.length === 0 && (
              <div className={styles.state}>
                <Building2 size={20} strokeWidth={1.4} className={styles.emptyIcon} />
                <span>{query ? `No sponsors match "${query}"` : 'No sponsor workspaces available.'}</span>
              </div>
            )}

            {!loading && !error && sponsors.length > 0 && (
              <ul className={styles.list}>
                {sponsors.map((sponsor) => {
                  const displayName = sponsor.fullName || sponsor.organizationName || '(unnamed)';
                  const isActive    = activeId === sponsor.id;
                  const isEntering  = enteringId === sponsor.id;
                  return (
                    <li key={sponsor.id}>
                      <button
                        type="button"
                        className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                        onClick={() => handleSelect(sponsor)}
                        disabled={!!enteringId}
                      >
                        <span className={styles.avatar}>
                          {sponsor.photograph
                            ? <img src={sponsor.photograph} alt="" className={styles.avatarImg} />
                            : <span className={styles.avatarInitials}>{getInitials(displayName)}</span>
                          }
                        </span>
                        <span className={styles.itemBody}>
                          <span className={styles.itemName}>{displayName}</span>
                          {sponsor.organizationName && sponsor.organizationName !== displayName && (
                            <span className={styles.itemOrg}>{sponsor.organizationName}</span>
                          )}
                        </span>
                        {isEntering && <Loader2 size={14} className={styles.spinner} />}
                        {isActive && !isEntering && <span className={styles.activeBadge}>Active</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
