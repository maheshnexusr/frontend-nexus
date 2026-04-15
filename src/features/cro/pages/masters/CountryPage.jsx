import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Globe, Filter, Upload, Download } from 'lucide-react';
import { countriesClient } from '@/features/cro/api/countriesClient';
import { addToast }        from '@/app/notificationSlice';
import DataTable           from '@/components/data-table/DataTable';
import StatusBadge         from '@/components/feedback/StatusBadge';
import ConfirmDialog       from '@/components/feedback/ConfirmDialog';
import CountryModal        from '@/features/cro/components/countries/CountryModal';
import styles from './CountryPage.module.css';

// ── CSV helpers ───────────────────────────────────────────────────────────────

function exportCSV(data) {
  const headers = ['Country Name', 'Description', 'Status'];
  const rows    = data.map((c) => [
    `"${(c.countryName  ?? '').replace(/"/g, '""')}"`,
    `"${(c.description  ?? '').replace(/"/g, '""')}"`,
    `"${(c.status       ?? '').replace(/"/g, '""')}"`,
  ]);
  const csv  = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `countries_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default function CountryPage() {
  const dispatch  = useDispatch();
  const fileRef   = useRef(null);

  const [countries, setCountries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [statusFilter, setStatus] = useState('All');
  const [modalMode, setModalMode] = useState(null);   // 'create' | 'edit'
  const [selected, setSelected]   = useState(null);
  const [deleteTarget, setDelete] = useState(null);
  const [importing, setImporting] = useState(false);

  // pagination / sort
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey]   = useState('countryName');
  const [sortDir, setSortDir]   = useState('asc');

  const load = useCallback(() => {
    setLoading(true);
    countriesClient.list().then((data) => { setCountries(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = countries.filter((c) => {
      const matchQ = !query || c.countryName.toLowerCase().includes(query.toLowerCase());
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

  // ── CRUD actions ──────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (c)  => { setSelected(c);  setModalMode('edit');   };
  const closeModal = ()   => { setModalMode(null); setSelected(null);    };

  const handleSave = (country) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type:    'success',
      message: `Country '${country.countryName}' ${isEdit ? 'updated' : 'created'} successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (country) => {
    const hasDeps = await countriesClient.checkDependencies(country.id);
    if (hasDeps) {
      dispatch(addToast({
        type:     'error',
        message:  `Cannot delete Country '${country.countryName}'. It is associated with existing records (Sponsors, Studies, Locations). Consider deactivating it instead.`,
        duration: 7000,
      }));
      return;
    }
    setDelete(country);
  };

  const handleDelete = () => {
    countriesClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Country '${deleteTarget.countryName}' deleted successfully.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete Country. Please try again.' })));
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    try {
      exportCSV(filtered);
      dispatch(addToast({ type: 'success', message: 'Export completed successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export data. Please try again.' }));
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';   // allow re-selecting same file
    setImporting(true);
    try {
      const { imported, skipped } = await countriesClient.bulkImport(file);
      dispatch(addToast({
        type:    imported > 0 ? 'success' : 'warning',
        message: `${imported} countr${imported !== 1 ? 'ies' : 'y'} imported successfully.${skipped > 0 ? ` ${skipped} record${skipped !== 1 ? 's' : ''} skipped (duplicate or missing name).` : ''}`,
        duration: 6000,
      }));
      load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to import countries. Please check file format and try again.' }));
    } finally {
      setImporting(false);
    }
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key:      'countryName',
      label:    'Country Name',
      sortable: true,
    },
    {
      key:      'description',
      label:    'Description',
      render:   (val) => val
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Countries</h1>
          <p className={styles.sub}>Manage countries used across sponsors, studies, and locations.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            title="Import from CSV"
          >
            <Upload size={14} />
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button className={styles.btnPrimary} onClick={openCreate}>
            <Plus size={15} />
            Add Country
          </button>
        </div>
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
        <span className={styles.count}>
          {filtered.length} of {countries.length} countr{countries.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* Table — DataTable's onExport shows its own Export button in toolbar */}
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
        onExport={handleExport}
        searchPlaceholder="Search countries…"
        emptyStateMessage={
          countries.length === 0
            ? 'No countries found. Click "Add Country" to create one.'
            : 'No countries match your search or filter.'
        }
        emptyStateIllustration={<Globe size={40} strokeWidth={1.25} />}
      />

      {/* Modals */}
      {modalMode && (
        <CountryModal
          mode={modalMode}
          country={selected}
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
        title="Delete Country"
        message={`Are you sure you want to delete '${deleteTarget?.countryName}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
