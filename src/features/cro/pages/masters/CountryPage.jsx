import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Globe, Filter, Upload, Download, FileDown } from 'lucide-react';
import { countriesClient } from '@/features/cro/api/countriesClient';
import { addToast }        from '@/app/notificationSlice';
import DataTable           from '@/components/data-table/DataTable';
import StatusBadge         from '@/components/feedback/StatusBadge';
import ConfirmDialog       from '@/components/feedback/ConfirmDialog';
import CountryModal        from '@/features/cro/components/countries/CountryModal';
import { usePermissions }   from '@/features/auth/usePermissions';
import styles from './CountryPage.module.css';

// ── CSV helpers ───────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(data) {
  const headers = ['Country Name', 'Description', 'Status'];
  const rows    = data.map((c) => [
    `"${(c.countryName  ?? '').replace(/"/g, '""')}"`,
    `"${(c.description  ?? '').replace(/"/g, '""')}"`,
    `"${(c.status       ?? '').replace(/"/g, '""')}"`,
  ]);
  const csv  = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
               `countries_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Build and download a sample template matching the documented format:
 *   File: Countries.csv  (Sheet: Countries when saved as XLSX)
 *   Columns: Country Name, Description, Status
 */
function downloadSampleCSV() {
  const sample = [
    ['Country Name', 'Description', 'Status'],
    ['India',         'South Asian country',  'Active'],
    ['United States', 'North American country', 'Active'],
    ['Brazil',        '',                       'Inactive'],
  ];
  const csv = sample.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'Countries.csv');
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default function CountryPage() {
  const dispatch  = useDispatch();
  const fileRef   = useRef(null);
  const { has }   = usePermissions();
  const canCreate = has('country', 'create');
  const canEdit   = has('country', 'edit');
  const canDelete = has('country', 'delete');

  const [countries, setCountries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [statusFilter, setStatus] = useState('All');
  const [modalMode, setModalMode] = useState(null);   // 'create' | 'edit'
  const [selected, setSelected]   = useState(null);
  const [deleteTarget, setDelete] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState('');

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

    // Basic client-side validation: only CSV / XLSX per the documented format.
    const name = file.name.toLowerCase();
    const isCsv  = name.endsWith('.csv')  || file.type === 'text/csv';
    const isXlsx = name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!isCsv && !isXlsx) {
      dispatch(addToast({
        type: 'error',
        message: 'Unsupported file. Please upload a CSV (Countries.csv) or Excel (Countries.xlsx) file.',
      }));
      return;
    }

    setImporting(true);
    setImportFileName(file.name);
    setImportProgress(0);
    try {
      const { imported = 0, skipped = 0 } = await countriesClient.bulkImport(file, {
        onProgress: setImportProgress,
      });
      // Once upload completes, leave the bar at 100 briefly before closing.
      setImportProgress(100);
      dispatch(addToast({
        type:    imported > 0 ? 'success' : 'warning',
        message: `${imported} countr${imported !== 1 ? 'ies' : 'y'} imported successfully.${skipped > 0 ? ` ${skipped} record${skipped !== 1 ? 's' : ''} skipped (duplicate or missing name).` : ''}`,
        duration: 6000,
      }));
      load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to import countries. Please check file format and try again.' }));
    } finally {
      // Small hold so the user can see 100% before the modal disappears.
      setTimeout(() => {
        setImporting(false);
        setImportProgress(0);
        setImportFileName('');
      }, 400);
    }
  };

  const handleSampleDownload = () => {
    try {
      downloadSampleCSV();
      dispatch(addToast({ type: 'info', message: 'Sample template downloaded (Countries.csv).' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to download sample template.' }));
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
          {canEdit && (
            <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(row)}>
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              title="Delete"
              onClick={() => handleDeleteClick(row)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canEdit, canDelete]);

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
          {canCreate && (
            <button
              className={styles.btnSecondary}
              onClick={handleSampleDownload}
              title="Download sample template (Countries.csv)"
            >
              <FileDown size={14} />
              Sample Template
            </button>
          )}
          {canCreate && (
            <>
              <button
                className={styles.btnSecondary}
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                title="Import from CSV or Excel"
              >
                <Upload size={14} />
                {importing ? 'Importing…' : 'Import'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </>
          )}
          {canCreate && (
            <button className={styles.btnPrimary} onClick={openCreate}>
              <Plus size={15} />
              Add Country
            </button>
          )}
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

      {/* Import progress overlay */}
      {importing && (
        <div className={styles.importBackdrop} role="dialog" aria-label="Importing countries">
          <div className={styles.importDialog}>
            <div className={styles.importIcon}>
              <Upload size={18} />
            </div>
            <h3 className={styles.importTitle}>Importing countries…</h3>
            <p className={styles.importSub}>
              {importFileName ? `Uploading ${importFileName}` : 'Processing your file.'} Please don&apos;t close this window.
            </p>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.max(2, Math.min(100, importProgress))}%` }}
              />
            </div>
            <div className={styles.progressRow}>
              <span>{importProgress < 100 ? 'Uploading' : 'Saving records'}</span>
              <span className={styles.progressPct}>{importProgress}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
