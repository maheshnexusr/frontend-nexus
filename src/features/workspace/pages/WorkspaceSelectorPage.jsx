/**
 * WorkspaceSelectorPage — /workspace
 *
 * Displays a searchable grid of sponsor cards.
 * Selecting a card dispatches selectSponsor to Redux then navigates to the
 * study selector for that sponsor.
 *
 * NOTE: MOCK_SPONSORS will be replaced with an RTK Query hook once the
 *       sponsor-list API endpoint is wired up.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Building2, ArrowLeft, FlaskConical, ChevronRight } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { selectSponsor }  from '@/features/workspace/workspaceSlice';
import styles from './WorkspaceSelectorPage.module.css';

/* ── Mock data ───────────────────────────────────────────────────────────── */
const MOCK_SPONSORS = [
  { id: 'sp-001', name: 'Pfizer Clinical Research',   orgName: 'Pfizer Inc.',                    photo: null, activeStudies: 7  },
  { id: 'sp-002', name: 'Novartis AG',                orgName: 'Novartis International AG',       photo: null, activeStudies: 4  },
  { id: 'sp-003', name: 'Roche Pharma',               orgName: 'F. Hoffmann-La Roche Ltd',        photo: null, activeStudies: 3  },
  { id: 'sp-004', name: 'AstraZeneca R&D',            orgName: 'AstraZeneca PLC',                photo: null, activeStudies: 6  },
  { id: 'sp-005', name: 'Johnson & Johnson',          orgName: 'Janssen Research & Development', photo: null, activeStudies: 2  },
  { id: 'sp-006', name: 'Bristol Myers Squibb',       orgName: 'BMS Clinical Operations',        photo: null, activeStudies: 5  },
  { id: 'sp-007', name: 'Merck & Co.',                orgName: 'MSD International GmbH',         photo: null, activeStudies: 8  },
  { id: 'sp-008', name: 'Eli Lilly and Company',      orgName: 'Lilly Corporate Center',         photo: null, activeStudies: 1  },
  { id: 'sp-009', name: 'GlaxoSmithKline',            orgName: 'GSK plc',                        photo: null, activeStudies: 4  },
];

/* ── Sponsor card ────────────────────────────────────────────────────────── */
function SponsorCard({ sponsor, onSelect }) {
  const initials = sponsor.name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(sponsor)}
      aria-label={`Open ${sponsor.name} workspace`}
    >
      {/* Avatar */}
      <div className={styles.cardAvatar}>
        {sponsor.photo
          ? <img src={sponsor.photo} alt="" className={styles.cardAvatarImg} />
          : <span className={styles.cardAvatarInitials}>{initials}</span>
        }
      </div>

      {/* Info */}
      <div className={styles.cardInfo}>
        <p className={styles.cardName}>{sponsor.name}</p>
        <p className={styles.cardOrg}>{sponsor.orgName}</p>
        <div className={styles.cardMeta}>
          <FlaskConical size={12} aria-hidden="true" />
          <span>
            {sponsor.activeStudies} active{' '}
            {sponsor.activeStudies === 1 ? 'study' : 'studies'}
          </span>
        </div>
      </div>

      <ChevronRight size={16} className={styles.cardChevron} aria-hidden="true" />
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function WorkspaceSelectorPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [query,  setQuery]  = useState('');

  const filtered = MOCK_SPONSORS.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.orgName.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (sponsor) => {
    dispatch(selectSponsor({ id: sponsor.id, name: sponsor.name }));
    navigate(`/workspace/${sponsor.id}/studies`);
  };

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={styles.header}>
        <Link to="/cro/dashboard" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" />
          Return to Dashboard
        </Link>
        <h1 className={styles.title}>Choose Sponsor Workspace</h1>
        <p className={styles.sub}>
          Select a sponsor to browse their studies and open a study workspace.
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────────── */}
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search sponsors or organisations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search sponsors"
        />
      </div>

      {/* ── Grid ───────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((sponsor) => (
            <SponsorCard key={sponsor.id} sponsor={sponsor} onSelect={handleSelect} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Building2 size={40} strokeWidth={1.25} aria-hidden="true" />
          <p className={styles.emptyText}>
            No sponsors found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
