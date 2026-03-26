import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Pencil, Trash2, Eye, Copy, Mail, Filter } from 'lucide-react';
import { emailTemplatesClient } from '@/features/cro/api/emailTemplatesClient';
import { addToast }             from '@/features/notifications/notificationSlice';
import DataTable                from '@/components/data-table/DataTable';
import StatusBadge              from '@/components/feedback/StatusBadge';
import ConfirmDialog            from '@/components/feedback/ConfirmDialog';
import EmailTemplateModal       from '@/features/cro/components/email-templates/EmailTemplateModal';
import EmailPreviewModal        from '@/features/cro/components/email-templates/EmailPreviewModal';
import styles from './EmailTemplatesPage.module.css';

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EmailTemplatesPage() {
  const dispatch = useDispatch();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [statusFilter, setStatus] = useState('All');
  const [modalMode, setModalMode] = useState(null);   // 'create' | 'edit'
  const [selected, setSelected]   = useState(null);
  const [preview, setPreview]     = useState(null);
  const [deleteTarget, setDelete] = useState(null);   // template pending delete

  // pagination / sort
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    emailTemplatesClient.list().then((data) => {
      setTemplates(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = templates.filter((t) => {
      const matchQ =
        !query ||
        t.templateName.toLowerCase().includes(query.toLowerCase()) ||
        t.templateCode.toLowerCase().includes(query.toLowerCase()) ||
        (t.emailCategory || '').toLowerCase().includes(query.toLowerCase());
      const matchS = statusFilter === 'All' || t.status === statusFilter;
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
  }, [templates, query, statusFilter, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  // Reset to page 1 whenever filter / sort changes
  useEffect(() => { setPage(1); }, [query, statusFilter, sortKey, sortDir]);

  // ── actions ───────────────────────────────────────────────────────────────
  const openCreate = () => { setSelected(null); setModalMode('create'); };
  const openEdit   = (tpl) => { setSelected(tpl); setModalMode('edit'); };
  const closeModal = () => { setModalMode(null); setSelected(null); };

  const handleSave = (tpl) => {
    const isEdit = modalMode === 'edit';
    dispatch(addToast({
      type: 'success',
      message: `Email template '${tpl.templateName}' ${isEdit ? 'updated' : 'created'} successfully.`,
    }));
    closeModal();
    load();
  };

  const confirmDelete = (tpl) => setDelete(tpl);

  const handleDelete = () => {
    emailTemplatesClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Email template '${deleteTarget.templateName}' deleted successfully.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete email template. Please try again.' })));
  };

  const handleDuplicate = (tpl) => {
    const { id, createdAt, updatedAt, ...rest } = tpl;
    emailTemplatesClient
      .create({ ...rest, templateName: `${tpl.templateName} (Copy)`, templateCode: `${tpl.templateCode}_COPY`, status: 'Inactive' })
      .then((created) => {
        dispatch(addToast({ type: 'success', message: `Template duplicated as '${created.templateName}'.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to duplicate template.' })));
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'templateName',
      label: 'Template Name',
      sortable: true,
      render: (val, row) => (
        <>
          <span className={styles.tplName}>{val}</span>
          {row.description && <p className={styles.tplDesc}>{row.description}</p>}
        </>
      ),
    },
    {
      key: 'templateCode',
      label: 'Template Code',
      render: (val) => <code className={styles.code}>{val}</code>,
    },
    {
      key: 'emailCategory',
      label: 'Category',
      render: (val) => val || <span className={styles.na}>—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      sortable: true,
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      width: '130px',
      sortable: true,
      render: (val) => <span className={styles.date}>{fmt(val)}</span>,
    },
    {
      key: 'id',
      label: 'Actions',
      width: '120px',
      render: (_, row) => (
        <div className={styles.actions}>
          <button className={styles.actionBtn} title="Preview" onClick={() => setPreview(row)}>
            <Eye size={14} />
          </button>
          <button className={styles.actionBtn} title="Edit" onClick={() => openEdit(row)}>
            <Pencil size={14} />
          </button>
          <button className={styles.actionBtn} title="Duplicate" onClick={() => handleDuplicate(row)}>
            <Copy size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title="Delete"
            onClick={() => confirmDelete(row)}
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

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Email Templates</h1>
          <p className={styles.sub}>Manage automated email communication templates.</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>
          <Plus size={15} />
          Add Template
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
        searchPlaceholder="Search by name, code or category…"
        emptyStateMessage={
          templates.length === 0
            ? 'No email templates yet. Click "Add Template" to create your first template.'
            : 'No results match your search or filter.'
        }
        emptyStateIllustration={<Mail size={40} strokeWidth={1.25} />}
      />

      {/* Modals */}
      {modalMode && (
        <EmailTemplateModal
          mode={modalMode}
          template={selected}
          onSave={handleSave}
          onClose={closeModal}
          onError={(msg) => dispatch(addToast({ type: 'error', message: msg }))}
        />
      )}

      {preview && (
        <EmailPreviewModal
          template={preview}
          onClose={() => setPreview(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Email Template"
        message={`Are you sure you want to delete '${deleteTarget?.templateName}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
