/**
 * SponsorStudySelectorPage — /sponsor/select-study
 *
 * Shown when a sponsor user is assigned to one or more studies and needs to
 * pick one before entering the study workspace.
 *
 * Data flow:
 *   1. On mount: GET /api/v1/sponsor/studies (sponsorStudiesService.list())
 *      — returns the assignments the sponsor user can open.
 *   2. On select: POST /api/v1/sponsor/studies/choose — backend issues a
 *      studyContextToken that sponsorAxiosClient auto-attaches to subsequent
 *      /sponsor/workspace/* calls (handled inside sponsorStudiesService.choose).
 *   3. Redux activeStudy is populated via selectStudy so the sponsor layout's
 *      scope + config-driven sidebar has data to filter by.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FlaskConical, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';

const REMEMBER_KEY = 'sponsor.rememberedStudyId';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectStudy }          from '@/features/workspace/store/workspaceSlice';
import { selectCurrentUser }    from '@/features/auth/authSlice';
import { sponsorStudiesService }  from '@/services/sponsorAuthService';
import StatusBadge               from '@/components/feedback/StatusBadge';
import ReadOnlySponsorBanner     from '@/features/workspace/components/ReadOnlySponsorBanner';
import styles                    from './SponsorStudySelectorPage.module.css';

/* ── Badge helpers ───────────────────────────────────────────────────────── */
const SCOPE_STYLE = {
  EDC:    { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
  Survey: { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
  ePRO:   { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' },
};
const ENV_STYLE = {
  UAT:  { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
  LIVE: { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' },
};
const BADGE_BASE = { padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.4 };

const ScopeBadge = ({ scope }) => (
  <span style={{ ...BADGE_BASE, ...(SCOPE_STYLE[scope] ?? { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }) }}>
    {scope}
  </span>
);
const EnvBadge = ({ env }) => (
  <span style={{ ...BADGE_BASE, textTransform: 'uppercase', letterSpacing: 0.6, ...(ENV_STYLE[env] ?? {}) }}>
    {env}
  </span>
);

/* ── Study card ──────────────────────────────────────────────────────────── */
function StudyCard({ study, onSelect, busy }) {
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(study)}
      disabled={busy}
      aria-label={`Open study: ${study.title}`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <FlaskConical size={18} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className={styles.cardBadgeRow}>
          <ScopeBadge scope={study.scope} />
          <StatusBadge status={study.status} />
        </div>
        <ChevronRight size={15} className={styles.cardChevron} aria-hidden="true" />
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{study.title}</p>
        <p className={styles.cardProtocol}>{study.protocolId}</p>
      </div>

      {study.environments.length > 0 && (
        <div className={styles.cardEnvs}>
          {study.environments.map((env) => (
            <EnvBadge key={env} env={env} />
          ))}
        </div>
      )}
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function SponsorStudySelectorPage() {
  const dispatch    = useAppDispatch();
  const navigate    = useNavigate();
  const currentUser = useAppSelector(selectCurrentUser);
  const [query,    setQuery]    = useState('');
  const [studies,  setStudies]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selectingId, setSelectingId] = useState(null);
  const [remember, setRemember] = useState(() => {
    try { return Boolean(localStorage.getItem(REMEMBER_KEY)); } catch { return false; }
  });

  /* ── Fetch assignments on mount ──────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await sponsorStudiesService.list();
        if (cancelled) return;
        setStudies(list);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load studies. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Auto-redirect for "remember my choice" once studies are loaded ── */
  useEffect(() => {
    if (loading || studies.length === 0) return;
    let rememberedId = null;
    try { rememberedId = localStorage.getItem(REMEMBER_KEY); } catch { /* ignore */ }
    if (!rememberedId) return;
    const match = studies.find((s) => s.id === rememberedId);
    if (!match) {
      try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
      return;
    }
    handleSelect(match, { replace: true });
  }, [loading, studies]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = studies.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.protocolId.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = async (study, { replace = false } = {}) => {
    if (selectingId) return;
    setSelectingId(study.id);
    setError(null);
    try {
      try {
        if (remember || replace) localStorage.setItem(REMEMBER_KEY, study.id);
        else                     localStorage.removeItem(REMEMBER_KEY);
      } catch { /* ignore */ }

      // Tell the backend which study + environment to scope subsequent calls to.
      // sponsorStudiesService.choose() persists the returned studyContextToken
      // so sponsorAxiosClient can attach it automatically.
      await sponsorStudiesService.choose(study.id, { environment: study.environment });

      dispatch(
        selectStudy({
          id:     study.id,
          title:  study.title,
          scope:  study.scope,
          config: study.config,
        }),
      );
      navigate(`/sponsor/${study.id}/dashboard`, { replace });
    } catch (err) {
      setError(err?.message ?? 'Failed to open the selected study.');
      setSelectingId(null);
    }
  };

  const displayName = currentUser?.fullName ?? currentUser?.email ?? 'Sponsor';

  return (
    <div className={styles.page}>
      <ReadOnlySponsorBanner />
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.header}>
        <p className={styles.greeting}>Welcome back, {displayName}</p>
        <h1 className={styles.title}>Select a Study</h1>
        <p className={styles.sub}>
          Choose a study to open its data-capture workspace. The study context
          and environment will be applied for your session.
        </p>
      </div>

      {/* ── Error banner ───────────────────────────────────────── */}
      {error && (
        <div className={styles.empty} role="alert">
          <AlertTriangle size={32} strokeWidth={1.5} aria-hidden="true" />
          <p className={styles.emptyText}>{error}</p>
        </div>
      )}

      {/* ── Search (hidden while loading or empty) ─────────────── */}
      {!loading && !error && studies.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by title or protocol ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search studies"
            />
          </div>
          <label className={styles.remember}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                if (!e.target.checked) {
                  try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
                }
              }}
            />
            <span>Remember my choice</span>
          </label>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────── */}
      {loading ? (
        <div className={styles.empty}>
          <Loader2 size={32} strokeWidth={1.5} aria-hidden="true" />
          <p className={styles.emptyText}>Loading your studies…</p>
        </div>
      ) : !error && studies.length === 0 ? (
        <div className={styles.empty}>
          <FlaskConical size={40} strokeWidth={1.25} aria-hidden="true" />
          <p className={styles.emptyText}>No studies have been assigned to your account.</p>
          <p className={styles.emptyHint}>Contact your CRO administrator if you believe this is an error.</p>
        </div>
      ) : !error && filtered.length === 0 ? (
        <div className={styles.empty}>
          <Search size={40} strokeWidth={1.25} aria-hidden="true" />
          <p className={styles.emptyText}>No studies match &ldquo;{query}&rdquo;</p>
        </div>
      ) : !error ? (
        <div className={styles.grid}>
          {filtered.map((study) => (
            <StudyCard
              key={study.assignmentId ?? `${study.id}-${study.environment}`}
              study={study}
              onSelect={handleSelect}
              busy={selectingId === study.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
