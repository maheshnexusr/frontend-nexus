/**
 * StudySelectorPage — /workspace/:sponsorId/studies
 *
 * Shows studies for the selected sponsor.
 * CRO role is required (enforced by a UI guard — routing-level protection
 * is handled by ProtectedRoute on the workspace parent).
 *
 * Clicking a study card:
 *   1. Dispatches selectStudy to Redux (sets context for SponsorLayout)
 *   2. Navigates to /sponsor/:studyId/dashboard
 *
 * NOTE: MOCK_STUDIES will be replaced with an RTK Query hook.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search, FlaskConical, ChevronRight } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { selectStudy }    from '@/features/workspace/store/workspaceSlice';
import StatusBadge            from '@/components/feedback/StatusBadge';
import styles                 from './StudySelectorPage.module.css';

/* ── Mock data ───────────────────────────────────────────────────────────── */
const MOCK_STUDIES = {
  'sp-001': [
    { id: 'st-101', title: 'Phase III Oncology Trial',    protocolId: 'PFZ-ONC-2024-001', scope: 'EDC',    status: 'Active',    environments: ['UAT', 'LIVE'], config: { consentEnabled: true,  queryEnabled: true,  dataManagerEnabled: true,  navBarEnabled: true  } },
    { id: 'st-102', title: 'Cardiac Safety Study',        protocolId: 'PFZ-CAR-2024-002', scope: 'EDC',    status: 'Draft',     environments: ['UAT'],          config: { consentEnabled: false, queryEnabled: true,  dataManagerEnabled: false, navBarEnabled: true  } },
    { id: 'st-103', title: 'Patient Reported Outcomes',   protocolId: 'PFZ-PRO-2023-015', scope: 'ePRO',   status: 'Completed', environments: ['LIVE'],         config: { consentEnabled: true,  queryEnabled: false, dataManagerEnabled: true,  navBarEnabled: true  } },
    { id: 'st-104', title: 'Rare Disease Biomarker Study',protocolId: 'PFZ-BIO-2024-008', scope: 'Survey',  status: 'Active',    environments: ['UAT'],          config: { consentEnabled: false, queryEnabled: false, dataManagerEnabled: false, navBarEnabled: false } },
  ],
  'sp-002': [
    { id: 'st-201', title: 'Immunology Phase II',         protocolId: 'NVS-IMM-2024-001', scope: 'EDC',    status: 'Active',    environments: ['UAT', 'LIVE'], config: { consentEnabled: true,  queryEnabled: true,  dataManagerEnabled: true,  navBarEnabled: true  } },
    { id: 'st-202', title: 'Rare Disease Survey',         protocolId: 'NVS-SUR-2024-002', scope: 'Survey', status: 'Active',    environments: ['UAT'],          config: { consentEnabled: false, queryEnabled: false, dataManagerEnabled: false, navBarEnabled: false } },
  ],
  'sp-003': [
    { id: 'st-301', title: 'Neurology Phase I',           protocolId: 'ROC-NEU-2024-001', scope: 'EDC',    status: 'Draft',     environments: ['UAT'],          config: { consentEnabled: true,  queryEnabled: true,  dataManagerEnabled: true,  navBarEnabled: true  } },
  ],
};

/* ── Scope + Environment badge helpers ──────────────────────────────────── */
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
function StudyCard({ study, onSelect }) {
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(study)}
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
export default function StudySelectorPage() {
  const { sponsorId } = useParams();
  const dispatch      = useAppDispatch();
  const navigate      = useNavigate();
  const [query, setQuery] = useState('');

  const studies  = MOCK_STUDIES[sponsorId] ?? [];
  const filtered = studies.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.protocolId.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (study) => {
    dispatch(
      selectStudy({
        id:     study.id,
        title:  study.title,
        scope:  study.scope,
        config: study.config,
      }),
    );
    navigate(`/sponsor/${study.id}/dashboard`);
  };

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.header}>
        <Link to="/workspace" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" />
          Back to Sponsors
        </Link>
        <h1 className={styles.title}>Select Study</h1>
        <p className={styles.sub}>
          Choose a study to open its data-capture workspace. The study context
          and environment will be applied for your session.
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────────── */}
      {studies.length > 0 && (
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
      )}

      {/* ── Grid ───────────────────────────────────────────────── */}
      {studies.length === 0 ? (
        <div className={styles.empty}>
          <FlaskConical size={40} strokeWidth={1.25} aria-hidden="true" />
          <p className={styles.emptyText}>No studies found for this sponsor.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <Search size={40} strokeWidth={1.25} aria-hidden="true" />
          <p className={styles.emptyText}>No studies match &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((study) => (
            <StudyCard key={study.id} study={study} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
