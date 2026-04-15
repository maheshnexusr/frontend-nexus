import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useDispatch }  from 'react-redux';
import { Plus, Pencil, Trash2, FlaskConical } from 'lucide-react';
import { studiesClient } from '@/features/cro/api/studiesClient';
import { addToast }      from '@/app/notificationSlice';
import { resetWizard }   from '@/features/cro/store/studyWizardSlice';
import DataTable         from '@/components/data-table/DataTable';
import StatusBadge       from '@/components/feedback/StatusBadge';
import ConfirmDialog     from '@/components/feedback/ConfirmDialog';
import styles from './StudyListPage.module.css';

export default function StudyListPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [studies, setStudies]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [deleteTarget, setDel]  = useState(null);

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

  const columns = useMemo(() => [
    {
      key:      'studyId',
      label:    'Study ID',
      sortable: true,
      render:   (val) => <span className={styles.studyId}>{val}</span>,
    },
    {
      key:      'studyTitle',
      label:    'Study Title',
      sortable: true,
    },
    {
      key:      'studyPhaseName',
      label:    'Phase',
      sortable: true,
      width:    '140px',
    },
    {
      key:      'sponsorName',
      label:    'Sponsor',
      sortable: true,
    },
    {
      key:      'scope',
      label:    'Scope',
      width:    '130px',
      render:   (val) => (
        <span className={styles.scopeTags}>
          {(Array.isArray(val) ? val : []).map((s) => (
            <span key={s} className={styles.scopeTag}>{s}</span>
          ))}
        </span>
      ),
    },
    {
      key:      'status',
      label:    'Status',
      width:    '110px',
      sortable: true,
      render:   (val) => <StatusBadge status={val} />,
    },
    {
      key:   'id',
      label: 'Actions',
      width: '90px',
      render: (_, row) => (
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            title="Edit"
            onClick={(e) => { e.stopPropagation(); navigate(`/cro/studies/${row.id}/edit`); }}
          >
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Studies</h1>
          <p className={styles.sub}>Manage all clinical studies across sponsors.</p>
        </div>
        <button className={styles.btnPrimary} onClick={handleCreateNew}>
          <Plus size={15} />
          Add Study
        </button>
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
            ? 'No studies yet. Click "Add Study" to get started.'
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
    </div>
  );
}
