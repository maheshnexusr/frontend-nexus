import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, MapPin, Filter, Upload, FileDown } from 'lucide-react';
import { locationsClient } from '@/features/cro/api/locationsClient';
import { countriesClient } from '@/features/cro/api/countriesClient';
import { addToast }        from '@/app/notificationSlice';
import DataTable           from '@/components/data-table/DataTable';
import StatusBadge         from '@/components/feedback/StatusBadge';
import ConfirmDialog       from '@/components/feedback/ConfirmDialog';
import SearchableDropdown  from '@/components/form/SearchableDropdown';
import LocationModal       from '@/features/cro/components/locations/LocationModal';
import styles from './LocationsPage.module.css';

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
  const headers = ['Country Name', 'State/Province', 'District/County', 'City', 'Postal Code', 'Status'];
  const escape  = (v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
  const rows    = data.map((r) => [
    escape(r.countryName), escape(r.state), escape(r.district),
    escape(r.city), escape(r.postalCode), escape(r.status),
  ]);
  const csv  = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
               `locations_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Build and download a sample template matching the documented format:
 *   File: Locations.csv  (Sheet: Locations when saved as XLSX)
 *   Columns: Country Name, State/Province, District/County, City,
 *            Postal Code, Status
 *
 * The Country Name column is seeded with countries that already exist in the
 * user's master so the file imports cleanly without "unknown_country" errors.
 * Pass an array of country names from the Countries master.
 */
function downloadSampleCSV(countryNames = []) {
  const active = countryNames.filter(Boolean);
  const examples = active.length > 0
    ? [
        [active[0],                    'State / Province name', 'District / County',  'City name 1', '560001',    'Active'  ],
        [active[1] ?? active[0],       'State / Province name', '',                   'City name 2', '94103',     'Active'  ],
        [active[2] ?? active[0],       'State / Province name', '',                   'City name 3', '01000-000', 'Inactive'],
      ]
    : [
        // No countries in the master yet — generate a single instructional
        // row. The user must add countries first or the import will fail
        // the "country must exist" check.
        ['<add country from Countries master>', 'State / Province', 'District / County', 'City', 'Postal Code', 'Active'],
      ];
  const sample = [
    ['Country Name', 'State/Province', 'District/County', 'City', 'Postal Code', 'Status'],
    ...examples,
  ];
  const csv = sample.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'Locations.csv');
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const dispatch = useDispatch();
  const fileRef  = useRef(null);

  const [locations, setLocations]     = useState([]);
  const [countries, setCountries]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState('');
  const [statusFilter, setStatus]     = useState('All');
  const [countryFilter, setCountryF]  = useState('');    // countryId or ''
  const [modalMode, setModalMode]     = useState(null);  // 'create' | 'edit'
  const [selected, setSelected]       = useState(null);
  const [deleteTarget, setDelete]     = useState(null);
  const [importing, setImporting]         = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState('');

  // pagination / sort
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      locationsClient.list(),
      countriesClient.list(),
    ]).then(([locs, cnts]) => {
      setLocations(locs);
      setCountries(cnts);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Country filter options (all countries present in locations + "All")
  const countryFilterOptions = useMemo(() => {
    const seen = new Map();
    locations.forEach((l) => { if (!seen.has(l.countryId)) seen.set(l.countryId, l.countryName); });
    return [...seen.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [locations]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = locations.filter((l) => {
      const q     = query.toLowerCase();
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

  // ── CRUD actions ──────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (l)  => { setSelected(l);  setModalMode('edit');   };
  const closeModal = ()   => { setModalMode(null); setSelected(null);    };

  const handleSave = (loc) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type:    'success',
      message: isEdit
        ? 'Location updated successfully.'
        : `Location ${loc.city}, ${loc.state}, ${loc.countryName} created successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (loc) => {
    const hasDeps = await locationsClient.checkDependencies(loc.id);
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
    locationsClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: 'Location deleted successfully.' }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete location. Please try again.' })));
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
    e.target.value = '';

    const name   = file.name.toLowerCase();
    const isCsv  = name.endsWith('.csv')  || file.type === 'text/csv';
    const isXlsx = name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!isCsv && !isXlsx) {
      dispatch(addToast({
        type: 'error',
        message: 'Unsupported file. Please upload a CSV (Locations.csv) or Excel (Locations.xlsx) file.',
      }));
      return;
    }

    setImporting(true);
    setImportFileName(file.name);
    setImportProgress(0);
    try {
      const { imported = 0, skipped = 0 } = await locationsClient.bulkImport(file, {
        onProgress: setImportProgress,
      });
      setImportProgress(100);
      dispatch(addToast({
        type:    imported > 0 ? 'success' : 'warning',
        message: `${imported} location${imported !== 1 ? 's' : ''} imported successfully.${skipped > 0 ? ` ${skipped} record${skipped !== 1 ? 's' : ''} skipped (duplicate, unknown country, or missing fields).` : ''}`,
        duration: 6000,
      }));
      load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to import locations. Please check file format and try again.' }));
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress(0);
        setImportFileName('');
      }, 400);
    }
  };

  const handleSampleDownload = () => {
    try {
      const names = countries
        .filter((c) => (c.status ?? 'Active') === 'Active')
        .map((c) => c.countryName);
      downloadSampleCSV(names);
      const msg = names.length === 0
        ? 'Sample template downloaded. Add countries to the Countries master before importing — rows with unknown countries are skipped.'
        : 'Sample template downloaded (Locations.csv).';
      dispatch(addToast({ type: 'info', message: msg, duration: 6000 }));
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
      width:    '150px',
    },
    {
      key:      'state',
      label:    'State',
      sortable: true,
    },
    {
      key:    'district',
      label:  'District',
      render: (val) => val || <span className={styles.na}>—</span>,
    },
    {
      key:      'city',
      label:    'City',
      sortable: true,
    },
    {
      key:      'postalCode',
      label:    'Postal Code',
      width:    '120px',
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
          <h1 className={styles.title}>Locations</h1>
          <p className={styles.sub}>Manage geographical locations used across sites, sponsors, and studies.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            onClick={handleSampleDownload}
            title="Download sample template (Locations.csv)"
          >
            <FileDown size={14} />
            Sample Template
          </button>
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
          <button className={styles.btnPrimary} onClick={openCreate}>
            <Plus size={15} />
            Add Location
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.toolbar}>
        <div className={styles.filterLeft}>
          {/* Status pills */}
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

          {/* Country filter dropdown */}
          <div className={styles.countryFilter}>
            <SearchableDropdown
              options={countryFilterOptions}
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
        onExport={handleExport}
        searchPlaceholder="Search by country, state, city, postal code…"
        emptyStateMessage={
          locations.length === 0
            ? 'No locations yet. Click "Add Location" to create one.'
            : 'No locations match your search or filter.'
        }
        emptyStateIllustration={<MapPin size={40} strokeWidth={1.25} />}
      />

      {/* Modals */}
      {modalMode && (
        <LocationModal
          mode={modalMode}
          location={selected}
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
        title="Delete Location"
        message="Are you sure you want to delete this location? This action cannot be undone."
        confirmLabel="Delete"
      />

      {importing && (
        <div className={styles.importBackdrop} role="dialog" aria-label="Importing locations">
          <div className={styles.importDialog}>
            <div className={styles.importIcon}>
              <Upload size={18} />
            </div>
            <h3 className={styles.importTitle}>Importing locations…</h3>
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
