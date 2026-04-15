import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { studyPhasesClient } from '@/features/cro/api/studyPhasesClient';
import { addToast }          from '@/app/notificationSlice';
import DataTable             from '@/components/data-table/DataTable';
import StatusBadge           from '@/components/feedback/StatusBadge';
import ConfirmDialog         from '@/components/feedback/ConfirmDialog';
import StudyPhaseModal       from '@/features/cro/components/study-phases/StudyPhaseModal';
import styles from './StudyPhasesPage.module.css';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function StudyPhasesPage() {
  const dispatch = useDispatch();

  const [phases, setPhases]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [modalMode, setModalMode] = useState(null);  // 'create' | 'edit'
  const [selected, setSelected]   = useState(null);
  const [deleteTarget, setDelete] = useState(null);

  // pagination / sort
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    studyPhasesClient.list().then((data) => { setPhases(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = phases.filter((p) =>
      !query || p.phaseName.toLowerCase().includes(query.toLowerCase()),
    );
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [phases, query, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, sortKey, sortDir]);

  // ── actions ───────────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (p)  => { setSelected(p);  setModalMode('edit');   };
  const closeModal = ()   => { setModalMode(null); setSelected(null);    };

  const handleSave = (phase) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type: 'success',
      message: `Study Phase '${phase.phaseName}' ${isEdit ? 'updated' : 'created'} successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (phase) => {
    const hasDeps = await studyPhasesClient.checkDependencies(phase.id);
    if (hasDeps) {
      dispatch(addToast({
        type: 'error',
        message: `Cannot delete Study Phase '${phase.phaseName}'. It is associated with existing studies. Consider deactivating it instead.`,
        duration: 7000,
      }));
      return;
    }
    setDelete(phase);
  };

  const handleDelete = () => {
    studyPhasesClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Study Phase '${deleteTarget.phaseName}' deleted successfully.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete Study Phase. Please try again.' })));
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key:      'phaseName',
      label:    'Phase Name',
      sortable: true,
    },
    {
      key:      'status',
      label:    'Status',
      width:    '110px',
      sortable: true,
      render:   (val) => <StatusBadge status={val} />,
    },
    {
      key:   'createdBy',
      label: 'Created By',
      width: '130px',
    },
    {
      key:      'createdAt',
      label:    'Created At',
      width:    '130px',
      sortable: true,
      render:   (val) => <span className={styles.date}>{fmt(val)}</span>,
    },
    {
      key:      'updatedAt',
      label:    'Last Updated',
      width:    '130px',
      sortable: true,
      render:   (val) => <span className={styles.date}>{fmt(val)}</span>,
    },
    {
      key:   'id',
      label: 'Actions',
      width: '90px',
      render: (_, row) => (
        <div className={styles.actions}>
          <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(row)}>
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title="Delete"
            onClick={() => handleDeleteClick(row)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Study Phases</h1>
          <p className={styles.sub}>Manage clinical study phase classifications.</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          <Plus size={15} />
          Add Phase
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
        searchPlaceholder="Search phases…"
        emptyStateMessage={
          phases.length === 0
            ? 'No study phases found. Click "Add Phase" to create one.'
            : 'No phases match your search.'
        }
        emptyStateIllustration={<Layers size={40} strokeWidth={1.25} />}
      />

      {modalMode && (
        <StudyPhaseModal
          mode={modalMode}
          phase={selected}
          onSave={handleSave}
          onClose={closeModal}
          onError={(msg) => dispatch(addToast({ type: 'error', message: msg }))}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Study Phase"
        message={`Are you sure you want to delete '${deleteTarget?.phaseName}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
