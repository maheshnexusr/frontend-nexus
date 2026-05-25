import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useDispatch }  from 'react-redux';
import {
  Plus, Pencil, Trash2, FlaskConical, LayoutTemplate,
  Calendar, Building2, Users, Rocket,
} from 'lucide-react';
import { studiesClient } from '@/features/cro/api/studiesClient';
import { addToast }      from '@/app/notificationSlice';
import { resetWizard }   from '@/features/cro/store/studyWizardSlice';
import { usePermissions } from '@/features/auth/usePermissions';
import DataTable         from '@/components/data-table/DataTable';
import StatusBadge       from '@/components/feedback/StatusBadge';
import ConfirmDialog     from '@/components/feedback/ConfirmDialog';
import PublishSettingsModal from './PublishSettingsModal';
import { formatDate }       from '@/utils/formatDate';
import styles from './StudyListPage.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) => formatDate(iso) || null;

/**
 * Progress % for a study based on its timeline (start → expectedEnd).
 *   - Completed status / past end date → 100
 *   - Not started yet / no dates → 0
 *   - Otherwise → linear elapsed/total clipped to [0, 100]
 */
function studyProgress(row) {
  if ((row.status ?? '').toLowerCase() === 'completed') return 100;
  const start = row.startDate       ? new Date(row.startDate).getTime()       : null;
  const end   = row.expectedEndDate ? new Date(row.expectedEndDate).getTime() : null;
  if (!start || !end || end <= start) return 0;
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end)   return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function progressColor(pct, status) {
  if ((status ?? '').toLowerCase() === 'completed' || pct >= 100) return '#16a34a';   // green
  if (pct >= 75) return '#f59e0b';   // amber
  if (pct >= 1)  return '#2563eb';   // blue
  return '#94a3b8';                  // gray (not started)
}

export default function StudyListPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Per-action gates — mirror the backend authorize("ClinicalPrograms.Studies", …)
  // checks so the UI never offers an action the API will reject with a 403.
  const { has }      = usePermissions();
  const canCreate    = has('studies', 'create');
  const canEdit      = has('studies', 'edit');
  const canConfigure = has('studies', 'configure');
  const canDelete    = has('studies', 'delete');
  const canPublish   = has('studies', 'publish');
  const showActions  = canEdit || canConfigure || canDelete || canPublish;

  const [studies, setStudies]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [deleteTarget, setDel]  = useState(null);
  const [publishTarget, setPublishTarget] = useState(null);

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    studiesClient.list().then((data) => { setStudies(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let rows = studies.filter((s) => {
      const q = query.toLowerCase();
      return !q || [s.studyId, s.studyTitle, s.sponsorName, s.studyPhaseName]
        .some((v) => (v ?? '').toLowerCase().includes(q));
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [studies, query, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, sortKey, sortDir]);

  const handleDeleteClick = (s) => setDel(s);

  const handleDelete = () => {
    studiesClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Study '${deleteTarget.studyTitle}' deleted successfully.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete study. Please try again.' })));
  };

  const handleCreateNew = () => {
    dispatch(resetWizard());
    navigate('/cro/studies/new');
  };

  const columns = useMemo(() => {
    const cols = [
    {
      key:      'studyId',
      label:    'Study Details',
      sortable: true,
      render:   (_, row) => (
        <div className={styles.studyCell}>
          <code className={styles.studyId}>{row.studyId}</code>
          <span className={styles.studyTitle} title={row.studyTitle}>{row.studyTitle}</span>
        </div>
      ),
    },
    {
      key:      'studyPhaseName',
      label:    'Phase',
      sortable: true,
      width:    '120px',
    },
    {
      key:      'sponsorName',
      label:    'Sponsor',
      sortable: true,
    },
    {
      key:      'scope',
      label:    'Scope',
      width:    '110px',
      render:   (val) => {
        const list = Array.isArray(val) ? val : (val ? [val] : []);
        return (
          <span className={styles.scopeTags}>
            {list.map((sc) => <span key={sc} className={styles.scopeTag}>{sc}</span>)}
          </span>
        );
      },
    },
    {
      key:    'startDate',
      label:  'Timeline',
      width:  '210px',
      render: (_, row) => {
        const start = fmtDate(row.startDate);
        const end   = fmtDate(row.expectedEndDate);
        if (!start && !end) return <span className={styles.na}>—</span>;
        return (
          <div className={styles.timeline}>
            <Calendar size={12} className={styles.timelineIcon} aria-hidden="true" />
            <span className={styles.timelineDates}>
              {start || '—'} <span className={styles.timelineArrow}>→</span> {end || '—'}
            </span>
          </div>
        );
      },
    },
    {
      key:    'progress',
      label:  'Progress',
      width:  '150px',
      render: (_, row) => {
        const pct   = studyProgress(row);
        const color = progressColor(pct, row.status);
        return (
          <div className={styles.progressCell}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className={styles.progressPct} style={{ color }}>{pct}%</span>
          </div>
        );
      },
    },
    {
      key:    'maxSites',
      label:  'Capacity',
      width:  '160px',
      render: (_, row) => (
        <div className={styles.capacity}>
          <span className={styles.capacityItem} title="Max Sites">
            <Building2 size={11} aria-hidden="true" />
            {row.maxSites ?? '—'}
          </span>
          <span className={styles.capacityDivider} />
          <span className={styles.capacityItem} title="Max Enrollments">
            <Users size={11} aria-hidden="true" />
            {row.maxEnrollments ?? '—'}
          </span>
        </div>
      ),
    },
    {
      key:      'status',
      label:    'Status',
      width:    '180px',
      sortable: true,
      render:   (val, row) => (
        <>
          <StatusBadge status={val} />
          {(row.publishedUat || row.publishedLive) && (
            <span className={styles.envChips}>
              {row.publishedUat && (
                <span
                  className={`${styles.envChip} ${styles.envChipUat}`}
                  title={row.uatVersion ? `UAT v${row.uatVersion}` : 'Published to UAT'}
                >UAT</span>
              )}
              {row.publishedLive && (
                <span
                  className={`${styles.envChip} ${styles.envChipLive}`}
                  title={row.liveVersion ? `Production v${row.liveVersion}` : 'Published to Production'}
                >LIVE</span>
              )}
            </span>
          )}
        </>
      ),
    },
    ];

    // Actions column — only the per-row buttons the role is allowed to use.
    // Dropped entirely when the role can do none of edit / design / delete.
    if (showActions) {
      cols.push({
        key:   'id',
        label: 'Actions',
        width: '160px',
        render: (_, row) => (
          <div className={styles.actions}>
            {canEdit && (
              <button
                className={styles.actionBtn}
                title="Edit"
                onClick={(e) => { e.stopPropagation(); navigate(`/cro/studies/${row.id}/edit`); }}
              >
                <Pencil size={14} />
              </button>
            )}
            {canConfigure && (
              <button
                className={styles.actionBtn}
                title="Design Study"
                onClick={(e) => { e.stopPropagation(); navigate(`/cro/studies/${row.id}/design`); }}
              >
                <LayoutTemplate size={14} />
              </button>
            )}
            {canPublish && (
              <button
                className={styles.actionBtn}
                title="Publish Settings"
                onClick={(e) => { e.stopPropagation(); setPublishTarget(row); }}
              >
                <Rocket size={14} />
              </button>
            )}
            {canDelete && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                title="Delete"
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      });
    }

    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showActions, canEdit, canConfigure, canDelete, canPublish]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Studies</h1>
          <p className={styles.sub}>Manage all clinical studies across sponsors.</p>
        </div>
        {canCreate && (
          <button className={styles.btnPrimary} onClick={handleCreateNew}>
            <Plus size={15} />
            Add Study
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        loading={loading}
        totalCount={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        onSort={(key, dir) => { setSortKey(dir ? key : null); setSortDir(dir); }}
        onSearch={setQuery}
        searchPlaceholder="Search by Study ID, title, sponsor, phase…"
        emptyStateMessage={
          studies.length === 0
            ? (canCreate
                ? 'No studies yet. Click "Add Study" to get started.'
                : 'No studies yet.')
            : 'No studies match your search.'
        }
        emptyStateIllustration={<FlaskConical size={40} strokeWidth={1.25} />}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDel(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Study"
        message={`Are you sure you want to delete '${deleteTarget?.studyTitle}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />

      <PublishSettingsModal
        open={!!publishTarget}
        study={publishTarget}
        onClose={() => setPublishTarget(null)}
        onPublished={load}
      />
    </div>
  );
}
