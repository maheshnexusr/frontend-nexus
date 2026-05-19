import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, MessageSquare, Filter, Upload, FileDown } from 'lucide-react';
import { annotationsClient } from '@/features/cro/api/annotationsClient';
import { addToast }          from '@/app/notificationSlice';
import DataTable             from '@/components/data-table/DataTable';
import StatusBadge           from '@/components/feedback/StatusBadge';
import ConfirmDialog         from '@/components/feedback/ConfirmDialog';
import AnnotationFormModal   from '@/features/cro/components/annotations/AnnotationFormModal';
import styles from './AnnotationsPage.module.css';

// ── CSV helpers ───────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(rows) {
  const headers = ['Annotation', 'Full Form', 'Description', 'Status'];
  const esc     = (v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...rows.map((r) => [esc(r.annotation), esc(r.fullForm), esc(r.description), esc(r.status)].join(',')),
  ].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
               `annotations_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Sample template per spec:
 *   File: Annotation List.csv   (Sheet: Annotations when saved as XLSX)
 *   Columns: Annotation, Full Form, Description.
 */
function downloadSampleCSV() {
  const sample = [
    ['Annotation', 'Full Form',             'Description'],
    ['AE',         'Adverse Event',         'Any untoward medical occurrence during the study'],
    ['SAE',        'Serious Adverse Event', 'AE resulting in death, hospitalisation, or disability'],
    ['DOB',        'Date of Birth',         'Subject date of birth'],
  ];
  const csv = sample.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'Annotation List.csv');
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnnotationsPage() {
  const dispatch = useDispatch();
  const fileRef  = useRef(null);

  const [rows, setRows]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState('');
  const [statusFilter, setStatus]     = useState('All');
  const [modalMode, setModalMode]     = useState(null);   // 'create' | 'edit'
  const [selected, setSelected]       = useState(null);
  const [deleteTarget, setDelete]     = useState(null);
  const [importing, setImporting]         = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState('');

  // pagination / sort
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey]   = useState('annotation');
  const [sortDir, setSortDir]   = useState('asc');

  const load = useCallback(() => {
    setLoading(true);
    annotationsClient.list()
      .then(setRows)
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load annotations.' })))
      .finally(() => setLoading(false));
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = rows.filter((a) => {
      const q     = query.toLowerCase();
      const matchQ = !q || [a.annotation, a.fullForm, a.description]
        .some((v) => (v ?? '').toLowerCase().includes(q));
      const matchS = statusFilter === 'All' || a.status === statusFilter;
      return matchQ && matchS;
    });
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return r;
  }, [rows, query, statusFilter, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, statusFilter, sortKey, sortDir]);

  // ── CRUD actions ──────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (a)  => { setSelected(a);  setModalMode('edit');   };
  const closeModal = ()   => { setModalMode(null); setSelected(null);    };

  const handleSave = (saved) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type:    'success',
      message: `Annotation '${saved.annotation}' ${isEdit ? 'updated' : 'created'} successfully.`,
    }));
    closeModal();
    load();
  };

  const handleDeleteClick = async (rec) => {
    const hasDeps = await annotationsClient.checkDependencies(rec.id);
    if (hasDeps) {
      dispatch(addToast({
        type:     'error',
        message:  `Cannot delete Annotation '${rec.annotation}'. It is associated with existing records. Consider deactivating it instead.`,
        duration: 7000,
      }));
      return;
    }
    setDelete(rec);
  };

  const handleDelete = () => {
    annotationsClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Annotation '${deleteTarget.annotation}' deleted successfully.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete Annotation. Please try again.' })));
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
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls')
                || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                || file.type === 'application/vnd.ms-excel';
    if (!isCsv && !isXlsx) {
      dispatch(addToast({
        type: 'error',
        message: 'Unsupported file. Please upload a CSV (Annotation List.csv) or Excel (Annotation List.xlsx) file.',
      }));
      return;
    }

    setImporting(true);
    setImportFileName(file.name);
    setImportProgress(0);
    try {
      const { imported = 0, skipped = 0 } = await annotationsClient.bulkImport(file, {
        onProgress: setImportProgress,
      });
      setImportProgress(100);
      dispatch(addToast({
        type:    imported > 0 ? 'success' : 'warning',
        message: `${imported} annotation${imported !== 1 ? 's' : ''} imported successfully.${skipped > 0 ? ` ${skipped} record${skipped !== 1 ? 's' : ''} skipped (duplicate or missing Annotation).` : ''}`,
        duration: 6000,
      }));
      load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to import annotations. Please check file format and try again.' }));
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress(0);
        setImportFileName('');
      }, 400);
    }
  };

  const handleSampleDownload = () => {
    downloadSampleCSV();
    dispatch(addToast({ type: 'info', message: 'Sample template downloaded (Annotation List.csv).' }));
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key:      'annotation',
      label:    'Annotation',
      sortable: true,
      width:    '180px',
      render:   (v) => <span className={styles.code}>{v}</span>,
    },
    {
      key:      'fullForm',
      label:    'Full Form',
      sortable: true,
      render:   (v) => v || <span className={styles.na}>—</span>,
    },
    {
      key:    'description',
      label:  'Description',
      render: (v) => v ? <span className={styles.desc}>{v}</span> : <span className={styles.na}>—</span>,
    },
    {
      key:      'status',
      label:    'Status',
      width:    '110px',
      sortable: true,
      render:   (v) => <StatusBadge status={v} />,
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
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Annotations</h1>
          <p className={styles.sub}>Clinical annotations and their full forms — used across study forms.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={handleSampleDownload} title="Download sample template (Annotation List.csv)">
            <FileDown size={14} /> Sample Template
          </button>
          <button className={styles.btnSecondary} onClick={() => fileRef.current?.click()} disabled={importing} title="Import from CSV or Excel">
            <Upload size={14} />
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button className={styles.btnPrimary} onClick={openCreate}>
            <Plus size={15} /> Add Annotation
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
          {filtered.length} of {rows.length} annotation{rows.length !== 1 ? 's' : ''}
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
        onExport={handleExport}
        searchPlaceholder="Search annotations…"
        emptyStateMessage={
          rows.length === 0
            ? 'No annotations yet. Click "Add Annotation" to create one.'
            : 'No annotations match your search or filter.'
        }
        emptyStateIllustration={<MessageSquare size={40} strokeWidth={1.25} />}
      />

      {modalMode && (
        <AnnotationFormModal
          mode={modalMode}
          annotation={selected}
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
        title="Delete Annotation"
        message={`Are you sure you want to delete '${deleteTarget?.annotation}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />

      {importing && (
        <div className={styles.importBackdrop} role="dialog" aria-label="Importing annotations">
          <div className={styles.importDialog}>
            <div className={styles.importIcon}><Upload size={18} /></div>
            <h3 className={styles.importTitle}>Importing annotations…</h3>
            <p className={styles.importSub}>
              {importFileName ? `Uploading ${importFileName}` : 'Processing your file.'} Please don&apos;t close this window.
            </p>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${Math.max(2, Math.min(100, importProgress))}%` }} />
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
