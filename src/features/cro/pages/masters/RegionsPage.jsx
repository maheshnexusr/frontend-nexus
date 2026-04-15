import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Globe2, Filter } from 'lucide-react';
import { regionsClient } from '@/features/cro/api/regionsClient';
import { addToast }      from '@/app/notificationSlice';
import DataTable         from '@/components/data-table/DataTable';
import StatusBadge       from '@/components/feedback/StatusBadge';
import ConfirmDialog     from '@/components/feedback/ConfirmDialog';
import RegionModal       from '@/features/cro/components/regions/RegionModal';
import styles from './RegionsPage.module.css';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function RegionsPage() {
  const dispatch = useDispatch();

  const [regions, setRegions]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [statusFilter, setStatus]   = useState('All');
  const [modalMode, setModalMode]   = useState(null);  // 'create' | 'edit'
  const [selected, setSelected]     = useState(null);
  const [deleteTarget, setDelete]   = useState(null);

  // pagination / sort
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    regionsClient.list().then((data) => { setRegions(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = regions.filter((r) => {
      const q      = query.toLowerCase();
      const matchQ = !q || r.regionName.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q);
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

  // ── actions ───────────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (r)  => { setSelected(r);  setModalMode('edit');   };
  const closeModal = ()   => { setModalMode(null); setSelected(null);    };

  const handleSave = (region) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type:    'success',
      message: `Region '${region.regionName}' ${isEdit ? 'updated' : 'created'} successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (region) => {
    const hasDeps = await regionsClient.checkDependencies(region.id);
    if (hasDeps) {
      dispatch(addToast({
        type:     'error',
        message:  `Cannot delete Region '${region.regionName}'. It is associated with existing records (Studies, Countries, etc.). Consider deactivating it instead.`,
        duration: 7000,
      }));
      return;
    }
    setDelete(region);
  };

  const handleDelete = () => {
    regionsClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Region '${deleteTarget.regionName}' deleted successfully.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete region. Please try again.' })));
  };

  // ── columns ───────────────────────────────────────────────────────────────
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
      key:      'createdAt',
      label:    'Created Date',
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
          <h1 className={styles.title}>Regions</h1>
          <p className={styles.sub}>Manage geographical regions for study coverage and organisational structuring.</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          <Plus size={15} />
          Add Region
        </button>
      </div>

      {/* Status filter */}
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
        searchPlaceholder="Search by region name or description…"
        emptyStateMessage={
          regions.length === 0
            ? 'No regions found. Click "Add Region" to create one.'
            : 'No regions match your search or filter.'
        }
        emptyStateIllustration={<Globe2 size={40} strokeWidth={1.25} />}
      />

      {modalMode && (
        <RegionModal
          mode={modalMode}
          region={selected}
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
