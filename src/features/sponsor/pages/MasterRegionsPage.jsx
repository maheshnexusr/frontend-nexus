import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Globe2, Filter } from 'lucide-react';
import { sponsorRegionsClient } from '@/features/sponsor/api/sponsorRegionsClient';
import { useReadOnlyView }      from '@/features/workspace/hooks/useReadOnlyView';
import { addToast }             from '@/app/notificationSlice';
import DataTable                from '@/components/data-table/DataTable';
import StatusBadge              from '@/components/feedback/StatusBadge';
import ConfirmDialog            from '@/components/feedback/ConfirmDialog';
import SponsorRegionModal       from '@/features/sponsor/components/SponsorRegionModal';
import styles from './MasterRegionsPage.module.css';

export default function MasterRegionsPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();

  const [regions,      setRegions]    = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [query,        setQuery]      = useState('');
  const [statusFilter, setStatus]     = useState('All');
  const [modalMode,    setModalMode]  = useState(null);
  const [selected,     setSelected]   = useState(null);
  const [deleteTarget, setDelete]     = useState(null);

  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey,  setSortKey]  = useState('regionName');
  const [sortDir,  setSortDir]  = useState('asc');

  const load = useCallback(() => {
    if (!studyId) return;
    setLoading(true);
    sponsorRegionsClient
      .list(studyId)
      .then((data) => setRegions(data))
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load regions.' })))
      .finally(() => setLoading(false));
  }, [studyId, dispatch]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let rows = regions.filter((r) => {
      const q      = query.toLowerCase();
      const matchQ = !query
        || r.regionName.toLowerCase().includes(q)
        || (r.description ?? '').toLowerCase().includes(q);
      const matchS = statusFilter === 'All' || r.status === statusFilter;
      return matchQ && matchS;
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [regions, query, statusFilter, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, statusFilter, sortKey, sortDir]);

  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (r)  => { setSelected(r);  setModalMode('edit');   };
  const closeModal = ()   => { setModalMode(null); setSelected(null);    };

  const handleSave = (saved) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type:    'success',
      message: `Region '${saved.regionName}' ${isEdit ? 'updated' : 'created'} successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (region) => {
    const hasDeps = await sponsorRegionsClient.checkDependencies(studyId, region.id);
    if (hasDeps) {
      dispatch(addToast({
        type:     'error',
        message:  `Cannot delete Region '${region.regionName}'. It is associated with existing records. Consider deactivating it instead.`,
        duration: 7000,
      }));
      return;
    }
    setDelete(region);
  };

  const handleDelete = () => {
    sponsorRegionsClient
      .delete(studyId, deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Region '${deleteTarget.regionName}' deleted successfully.` }));
        setDelete(null);
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete region. Please try again.' })));
  };

  const columns = useMemo(() => [
    {
      key:      'regionName',
      label:    'Region Name',
      sortable: true,
    },
    {
      key:    'description',
      label:  'Description',
      render: (val) => val
        ? <span className={styles.desc}>{val}</span>
        : <span className={styles.na}>—</span>,
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
            title={ro.isReadOnly ? ro.readOnlyMessage : 'Edit'}
            onClick={() => openEdit(row)}
            {...ro.disabledProps('Edit region')}
          >
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
            onClick={() => handleDeleteClick(row)}
            {...ro.disabledProps('Delete region')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ro.isReadOnly]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Regions</h1>
          <p className={styles.sub}>Manage geographical regions scoped to this study.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={openCreate} {...ro.disabledProps('Add region')}>
            <Plus size={15} />
            Add Region
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterWrap}>
          <Filter size={14} className={styles.filterIcon} />
          {['All', 'Active', 'Inactive'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className={styles.count}>
          {filtered.length} of {regions.length} region{regions.length !== 1 ? 's' : ''}
        </span>
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
        onSort={(key, dir) => { setSortKey(dir ? key : null); setSortDir(dir || 'asc'); }}
        onSearch={setQuery}
        searchPlaceholder="Search by region name or description…"
        emptyStateMessage={
          regions.length === 0
            ? 'No regions yet. Click "Add Region" to create one.'
            : 'No regions match your search or filter.'
        }
        emptyStateIllustration={<Globe2 size={40} strokeWidth={1.25} />}
      />

      {modalMode && (
        <SponsorRegionModal
          mode={modalMode}
          region={selected}
          studyId={studyId}
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
        title="Delete Region"
        message={`Are you sure you want to delete '${deleteTarget?.regionName}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
