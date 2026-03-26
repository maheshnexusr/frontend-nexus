import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate }   from 'react-router-dom';
import { useDispatch }   from 'react-redux';
import { Plus, Pencil, Trash2, Shield, Lock } from 'lucide-react';
import { rolesClient }   from '@/features/cro/api/rolesClient';
import { addToast }      from '@/features/notifications/notificationSlice';
import { countPermissions } from '@/features/cro/constants/permissionsSchema';
import DataTable         from '@/components/data-table/DataTable';
import ConfirmDialog     from '@/components/feedback/ConfirmDialog';
import styles from './TeamRolesPage.module.css';

export default function TeamRolesPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [roles,        setRoles]    = useState([]);
  const [loading,      setLoading]  = useState(true);
  const [query,        setQuery]    = useState('');
  const [deleteTarget, setDel]      = useState(null);
  const [deleting,     setDeleting] = useState(false);

  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey,  setSortKey]  = useState(null);
  const [sortDir,  setSortDir]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    rolesClient.list().then((data) => { setRoles(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = roles.filter((r) => {
      const q = query.toLowerCase();
      return !q || [r.name, r.description].some((v) => (v ?? '').toLowerCase().includes(q));
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [roles, query, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, sortKey, sortDir]);

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDeleteClick = async (role) => {
    const inUse = await rolesClient.isInUse(role.id);
    if (inUse) {
      dispatch(addToast({
        type:     'error',
        message:  `Cannot delete role '${role.name}' as it is assigned to active users.`,
        duration: 6000,
      }));
      return;
    }
    setDel(role);
  };

  const handleDelete = () => {
    setDeleting(true);
    rolesClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({
          type:    'success',
          message: `Role '${deleteTarget.name}' deleted successfully.`,
        }));
        setDel(null);
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete role. Please try again.' })))
      .finally(() => setDeleting(false));
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key:      'name',
      label:    'Role Name',
      sortable: true,
      render:   (val, row) => (
        <div className={styles.nameCell}>
          <div className={`${styles.roleIcon} ${row.isSystem ? styles.roleIconSystem : ''}`}>
            <Shield size={13} />
          </div>
          <div>
            <span className={styles.roleName}>{val}</span>
            {row.isSystem && (
              <span className={styles.systemBadge}>
                <Lock size={9} />
                System
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key:      'description',
      label:    'Description',
      sortable: true,
      render:   (val) => <span className={styles.desc}>{val || '—'}</span>,
    },
    {
      key:   'permissions',
      label: 'Permissions',
      render: (val) => {
        const { enabled, total } = countPermissions(val);
        const pct = total > 0 ? Math.round((enabled / total) * 100) : 0;
        return (
          <div className={styles.permCell}>
            <div className={styles.permBar}>
              <div className={styles.permBarFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.permCount}>{enabled} / {total}</span>
          </div>
        );
      },
    },
    {
      key:   'createdAt',
      label: 'Created',
      width: '130px',
      render: (val) => val
        ? new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '—',
    },
    {
      key:   'id',
      label: 'Actions',
      width: '90px',
      render: (_, row) => (
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            title={row.isSystem ? 'System role — cannot edit' : 'Edit'}
            disabled={row.isSystem}
            onClick={(e) => { e.stopPropagation(); navigate(`/cro/team/roles/${row.id}`); }}
          >
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title={row.isSystem ? 'System role — cannot delete' : 'Delete'}
            disabled={row.isSystem}
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Roles &amp; Permissions</h1>
          <p className={styles.sub}>
            Define roles and configure granular access permissions for each feature.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/cro/team/roles/new')}>
          <Plus size={15} />
          Add Role
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
        searchPlaceholder="Search by role name or description…"
        emptyStateMessage={
          roles.length === 0
            ? 'No roles yet. Click "Add Role" to create one.'
            : 'No roles match your search.'
        }
        emptyStateIllustration={<Shield size={40} strokeWidth={1.25} />}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => { if (!deleting) setDel(null); }}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Role"
        message={`Are you sure you want to delete the role '${deleteTarget?.name}'? This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
      />
    </div>
  );
}
