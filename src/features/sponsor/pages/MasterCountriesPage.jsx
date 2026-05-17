import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Globe, Filter } from 'lucide-react';
import { sponsorCountriesClient } from '@/features/sponsor/api/sponsorCountriesClient';
import { useReadOnlyView }        from '@/features/workspace/hooks/useReadOnlyView';
import { addToast }               from '@/app/notificationSlice';
import DataTable                  from '@/components/data-table/DataTable';
import StatusBadge                from '@/components/feedback/StatusBadge';
import ConfirmDialog              from '@/components/feedback/ConfirmDialog';
import SponsorCountryModal        from '@/features/sponsor/components/SponsorCountryModal';
import styles from './MasterCountriesPage.module.css';

export default function MasterCountriesPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();

  const [countries,     setCountries]   = useState([]);
  const [loading,       setLoading]     = useState(true);
  const [query,         setQuery]       = useState('');
  const [statusFilter,  setStatus]      = useState('All');
  const [modalMode,     setModalMode]   = useState(null);   // 'create' | 'edit'
  const [selected,      setSelected]    = useState(null);
  const [deleteTarget,  setDelete]      = useState(null);

  // sort + pagination
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey,  setSortKey]  = useState('countryName');
  const [sortDir,  setSortDir]  = useState('asc');

  const load = useCallback(() => {
    if (!studyId) return;
    setLoading(true);
    sponsorCountriesClient
      .list(studyId)
      .then((data) => setCountries(data))
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load countries.' })))
      .finally(() => setLoading(false));
  }, [studyId, dispatch]);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = countries.filter((c) => {
      const q = query.toLowerCase();
      const matchQ = !query
        || c.countryName.toLowerCase().includes(q)
        || c.countryCode.toLowerCase().includes(q)
        || (c.dialingCode ?? '').toLowerCase().includes(q);
      const matchS = statusFilter === 'All' || c.status === statusFilter;
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
  }, [countries, query, statusFilter, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, statusFilter, sortKey, sortDir]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (c) => { setSelected(c);   setModalMode('edit');   };
  const closeModal = ()  => { setModalMode(null); setSelected(null);     };

  const handleSave = (saved) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type:    'success',
      message: `Country '${saved.countryName}' ${isEdit ? 'updated' : 'created'} successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (country) => {
    const hasDeps = await sponsorCountriesClient.checkDependencies(studyId, country.id);
    if (hasDeps) {
      dispatch(addToast({
        type:     'error',
        message:  `Cannot delete country. It is in use by existing records (Sites, Locations, Personnel).`,
        duration: 7000,
      }));
      return;
    }
    setDelete(country);
  };

  const handleDelete = () => {
    sponsorCountriesClient
      .delete(studyId, deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Country '${deleteTarget.countryName}' deleted successfully.` }));
        setDelete(null);
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete country. Please try again.' })));
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key:      'countryName',
      label:    'Country Name',
      sortable: true,
    },
    {
      key:      'countryCode',
      label:    'Country Code',
      width:    '120px',
      sortable: true,
      render:   (val) => <span className={styles.code}>{val || '—'}</span>,
    },
    {
      key:    'dialingCode',
      label:  'Dialing Code',
      width:  '120px',
      render: (val) => val
        ? <span className={styles.code}>{val}</span>
        : <span className={styles.na}>—</span>,
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
            {...ro.disabledProps('Edit country')}
          >
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
            onClick={() => handleDeleteClick(row)}
            {...ro.disabledProps('Delete country')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ro.isReadOnly]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Country</h1>
          <p className={styles.sub}>Manage country records scoped to this study.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={openCreate} {...ro.disabledProps('Add country')}>
            <Plus size={15} />
            Add Country
          </button>
        </div>
      </div>

      {/* Toolbar */}
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
          {filtered.length} of {countries.length} countr{countries.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* Table */}
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
        searchPlaceholder="Search by name, code, dialing code…"
        emptyStateMessage={
          countries.length === 0
            ? 'No countries yet. Click "Add Country" to create one.'
            : 'No countries match your search or filter.'
        }
        emptyStateIllustration={<Globe size={40} strokeWidth={1.25} />}
      />

      {/* Modal */}
      {modalMode && (
        <SponsorCountryModal
          mode={modalMode}
          country={selected}
          studyId={studyId}
          onSave={handleSave}
          onClose={closeModal}
          onError={(msg) => dispatch(addToast({ type: 'error', message: msg }))}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Country"
        message={`Are you sure you want to delete '${deleteTarget?.countryName}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
