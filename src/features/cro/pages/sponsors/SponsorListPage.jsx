import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate }   from 'react-router-dom';
import { useDispatch }   from 'react-redux';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { sponsorsClient, exportSponsorsCSV } from '@/features/cro/api/sponsorsClient';
import { addToast }      from '@/app/notificationSlice';
import DataTable         from '@/components/data-table/DataTable';
import StatusBadge       from '@/components/feedback/StatusBadge';
import ConfirmDialog     from '@/components/feedback/ConfirmDialog';
import SponsorViewModal  from '@/features/cro/components/sponsors/SponsorViewModal';
import styles from './SponsorListPage.module.css';

// ── Avatar cell ───────────────────────────────────────────────────────────────
function Avatar({ photo, name }) {
  const initials = (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className={styles.avatarCell}>
      {photo
        ? <img src={photo} alt={name} className={styles.avatarImg} />
        : <div className={styles.avatarInitials}>{initials}</div>
      }
      <span className={styles.avatarName}>{name}</span>
    </div>
  );
}

export default function SponsorListPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [sponsors, setSponsors]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [viewTarget, setView]       = useState(null);
  const [deleteTarget, setDelete]   = useState(null);

  // pagination / sort
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    sponsorsClient.list().then((data) => { setSponsors(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = sponsors.filter((s) => {
      const q = query.toLowerCase();
      return !q || [s.fullName, s.email, s.contactNumber, s.organizationName]
        .some((v) => (v ?? '').toLowerCase().includes(q));
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [sponsors, query, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, sortKey, sortDir]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleDeleteClick = async (s) => {
    const hasDeps = await sponsorsClient.checkDependencies(s.id);
    if (hasDeps) {
      dispatch(addToast({
        type:     'error',
        message:  `Cannot delete sponsor. This sponsor is associated with existing studies/contracts.`,
        duration: 7000,
      }));
      return;
    }
    setDelete(s);
  };

  const handleDelete = () => {
    sponsorsClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({ type: 'success', message: `Sponsor '${deleteTarget.fullName}' deleted successfully.` }));
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete sponsor. Please try again.' })));
  };

  const handleExport = async () => {
    try {
      const filename = await exportSponsorsCSV();
      dispatch(addToast({ type: 'success', message: `Export completed successfully. File: ${filename}` }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export data. Please try again.' }));
    }
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key:      'fullName',
      label:    'Sponsor Name',
      sortable: true,
      render:   (val, row) => (
        <button className={styles.nameBtn} onClick={() => setView(row)} type="button">
          <Avatar photo={row.photograph} name={val} />
        </button>
      ),
    },
    {
      key:      'email',
      label:    'Email Address',
      sortable: true,
    },
    {
      key:      'contactNumber',
      label:    'Contact Number',
      width:    '150px',
    },
    {
      key:      'organizationName',
      label:    'Organization',
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
          <button
            className={styles.actionBtn}
            title="Edit"
            onClick={(e) => { e.stopPropagation(); navigate(`/cro/sponsors/${row.id}`); }}
          >
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Sponsors</h1>
          <p className={styles.sub}>Manage all sponsor organisations registered on the platform.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/cro/sponsors/new')}>
          <Plus size={15} />
          Add Sponsor
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
        onExport={handleExport}
        searchPlaceholder="Search by name, email, organisation…"
        emptyStateMessage={
          sponsors.length === 0
            ? 'No sponsors yet. Click "Add Sponsor" to register one.'
            : 'No sponsors match your search.'
        }
        emptyStateIllustration={<Users size={40} strokeWidth={1.25} />}
      />

      {/* Detail view modal */}
      {viewTarget && (
        <SponsorViewModal
          sponsor={viewTarget}
          onClose={() => setView(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Sponsor"
        message={`Are you sure you want to delete '${deleteTarget?.fullName}'? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
