import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, MapPin, Filter, Upload } from 'lucide-react';
import { sponsorLocationsClient } from '@/features/sponsor/api/sponsorLocationsClient';
import { sponsorCountriesClient } from '@/features/sponsor/api/sponsorCountriesClient';
import { useReadOnlyView }        from '@/features/workspace/hooks/useReadOnlyView';
import { usePermissions }         from '@/features/auth/usePermissions';
import { addToast }               from '@/app/notificationSlice';
import DataTable                  from '@/components/data-table/DataTable';
import StatusBadge                from '@/components/feedback/StatusBadge';
import ConfirmDialog              from '@/components/feedback/ConfirmDialog';
import SearchableDropdown         from '@/components/form/SearchableDropdown';
import SponsorLocationModal       from '@/features/sponsor/components/SponsorLocationModal';
import LocationsImportModal       from '@/features/sponsor/components/locations/LocationsImportModal';
import styles from './MasterLocationsPage.module.css';

export default function MasterLocationsPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();
  const { has }     = usePermissions();
  const canCreate   = has('locations', 'create');
  const canEdit     = has('locations', 'edit');
  const canDelete   = has('locations', 'delete');
  const canImport   = has('locations', 'import');

  const [locations,    setLocations]  = useState([]);
  const [countryOpts,  setCountryOpts] = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [query,        setQuery]      = useState('');
  const [statusFilter, setStatus]     = useState('All');
  const [countryFilter,setCountryF]   = useState('');
  const [modalMode,    setModalMode]  = useState(null);
  const [selected,     setSelected]   = useState(null);
  const [deleteTarget, setDelete]     = useState(null);
  const [importOpen,   setImportOpen] = useState(false);

  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey,  setSortKey]  = useState(null);
  const [sortDir,  setSortDir]  = useState(null);

  const load = useCallback(() => {
    if (!studyId) return;
    setLoading(true);
    Promise.all([
      sponsorLocationsClient.list(studyId),
      sponsorCountriesClient.list(studyId),
    ]).then(([locs, cnts]) => {
      setLocations(locs);
      setCountryOpts(
        cnts
          .filter((c) => c.status === 'Active')
          .sort((a, b) => a.countryName.localeCompare(b.countryName))
          .map((c) => ({ value: c.id, label: c.countryName })),
      );
    })
    .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load locations.' })))
    .finally(() => setLoading(false));
  }, [studyId, dispatch]);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = locations.filter((l) => {
      const q      = query.toLowerCase();
      const matchQ = !q || [l.countryName, l.state, l.district, l.city, l.postalCode]
        .some((v) => (v ?? '').toLowerCase().includes(q));
      const matchS  = statusFilter === 'All' || l.status === statusFilter;
      const matchCn = !countryFilter || l.countryId === countryFilter;
      return matchQ && matchS && matchCn;
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [locations, query, statusFilter, countryFilter, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, statusFilter, countryFilter, sortKey, sortDir]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (l) => { setSelected(l);   setModalMode('edit');   };
  const closeModal = ()  => { setModalMode(null); setSelected(null);    };

  const handleSave = (saved) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type:    'success',
      message: isEdit
        ? 'Location updated successfully.'
        : `Location ${saved.city}, ${saved.state}, ${saved.countryName} created successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (loc) => {
    const hasDeps = await sponsorLocationsClient.checkDependencies(studyId, loc.id);
    if (hasDeps) {
      dispatch(addToast({
        type:     'error',
        message:  'Cannot delete Location. This location is associated with existing records. Consider deactivating it instead.',
        duration: 7000,
      }));
      return;
    }
    setDelete(loc);
  };

  const handleDelete = () => {
    sponsorLocationsClient
      .delete(studyId, deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: 'Location deleted successfully.' }));
        setDelete(null);
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete location. Please try again.' })));
  };

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    { key: 'countryName', label: 'Country Name', sortable: true, width: '160px' },
    { key: 'state',       label: 'State',       sortable: true },
    {
      key:    'district',
      label:  'District',
      render: (val) => val || <span className={styles.na}>—</span>,
    },
    { key: 'city',       label: 'City',        sortable: true },
    { key: 'postalCode', label: 'Postal Code', sortable: true, width: '120px' },
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
          {canEdit && (
            <button
              className={styles.actionBtn}
              title={ro.isReadOnly ? ro.readOnlyMessage : 'Edit'}
              onClick={() => openEdit(row)}
              {...ro.disabledProps('Edit location')}
            >
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
              onClick={() => handleDeleteClick(row)}
              {...ro.disabledProps('Delete location')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ro.isReadOnly, canEdit, canDelete]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Locations</h1>
          <p className={styles.sub}>Manage geographical locations scoped to this study.</p>
        </div>
        <div className={styles.headerActions}>
          {canImport && (
            <button
              className={styles.btnSecondary}
              onClick={() => !ro.isReadOnly && setImportOpen(true)}
              disabled={ro.isReadOnly}
              aria-disabled={ro.isReadOnly}
              title={ro.isReadOnly ? ro.readOnlyMessage : 'Import locations from Excel/CSV'}
            >
              <Upload size={14} />
              Import Locations
            </button>
          )}
          {canCreate && (
            <button className={styles.btnPrimary} onClick={openCreate} {...ro.disabledProps('Add location')}>
              <Plus size={15} />
              Add Location
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterLeft}>
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
          <div className={styles.countryFilter}>
            <SearchableDropdown
              options={countryOpts}
              value={countryFilter}
              onChange={(v) => setCountryF(v ?? '')}
              placeholder="All Countries"
              searchPlaceholder="Search country…"
            />
          </div>
        </div>
        <span className={styles.count}>
          {filtered.length} of {locations.length} location{locations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <DataTable flat
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
        searchPlaceholder="Search by country, state, district, city, postal code…"
        emptyStateMessage={
          locations.length === 0
            ? 'No locations yet. Click "Add Location" to create one.'
            : 'No locations match your search or filter.'
        }
        emptyStateIllustration={<MapPin size={40} strokeWidth={1.25} />}
      />

      {/* Modal */}
      {modalMode && (
        <SponsorLocationModal
          mode={modalMode}
          location={selected}
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
        title="Delete Location"
        message="Are you sure you want to delete this location? This action cannot be undone."
        confirmLabel="Delete"
      />

      {/* Import modal */}
      {importOpen && (
        <LocationsImportModal
          studyId={studyId}
          countryNames={countryOpts.map((o) => o.label)}
          onClose={() => setImportOpen(false)}
          onImported={load}
        />
      )}
    </div>
  );
}
