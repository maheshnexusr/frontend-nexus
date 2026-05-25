import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Plus, Search, X, RefreshCw, Shield,
  Pencil, Trash2, Eye, Copy, AlertTriangle,
  ChevronUp, ChevronDown, ChevronsUpDown, ToggleLeft, ToggleRight,
} from 'lucide-react';

import { addToast }            from '@/app/notificationSlice';
import { sponsorRolesClient }  from '../api/sponsorRolesClient';
import ViewPermissionsModal    from '../components/roles/ViewPermissionsModal';
import ConfirmDialog           from '@/components/feedback/ConfirmDialog';
import { useReadOnlyView }     from '@/features/workspace/hooks/useReadOnlyView';
import { countPermissions } from '../components/roles/permissionsTree';
import { formatDate } from '@/utils/formatDate';
import css from './RolesPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['All', 'Active', 'Inactive'];

const COLS = [
  { key: 'roleName',    label: 'Role Name',     sortable: true  },
  { key: 'description', label: 'Description',   sortable: false },
  { key: 'userCount',   label: 'Users',         sortable: true  },
  { key: 'createdBy',   label: 'Created By',    sortable: false },
  { key: 'createdAt',   label: 'Created Date',  sortable: true  },
  { key: 'updatedAt',   label: 'Last Modified', sortable: true  },
  { key: 'status',      label: 'Status',        sortable: true  },
];

const fmtDate = (str) => formatDate(str) || '—';

function SortIcon({ colKey, sort }) {
  if (sort.key !== colKey) return <ChevronsUpDown size={11} style={{ opacity: .35 }} />;
  return sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();

  const [roles,      setRoles]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [search,       setSearch]       = useState('');

  // Sort
  const [sort, setSort] = useState({ key: 'roleName', dir: 'asc' });

  // Modals
  const [viewRole,      setViewRole]      = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateTarget, setDuplicateTarget] = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadRoles = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else        setRefreshing(true);
    try {
      const filters = statusFilter !== 'All' ? { status: statusFilter } : {};
      const list = await sponsorRolesClient.list(studyId, filters);
      setRoles(list);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to load roles.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studyId, statusFilter, dispatch]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  // ── Filter + Sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = roles;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) => r.roleName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      let av = a[sort.key] ?? '';
      let bv = b[sort.key] ?? '';
      if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [roles, search, sort]);

  function toggleSort(key) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  // ── CRUD Handlers ─────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await sponsorRolesClient.delete(studyId, deleteTarget.id);
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      dispatch(addToast({ type: 'success', message: `Role '${deleteTarget.roleName}' deleted successfully.` }));
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? '';
      const users = msg.match(/\d+/)?.[0];
      dispatch(addToast({
        type: 'error',
        message: users
          ? `Cannot delete role. It is assigned to ${users} user${Number(users) !== 1 ? 's' : ''}.`
          : 'Failed to delete role. Please try again.',
      }));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleDuplicate() {
    if (!duplicateTarget) return;
    const name = duplicateName.trim() || `${duplicateTarget.roleName} (Copy)`;
    try {
      const created = await sponsorRolesClient.duplicate(studyId, duplicateTarget.id, name);
      setRoles((prev) => [created, ...prev]);
      dispatch(addToast({ type: 'success', message: `Role '${created.roleName}' created successfully.` }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to duplicate role.' }));
    } finally {
      setDuplicateTarget(null);
      setDuplicateName('');
    }
  }

  async function handleToggleStatus(role) {
    if (role.isSystem) {
      dispatch(addToast({ type: 'warning', message: 'Role is system-protected and cannot be modified.' }));
      return;
    }
    const newStatus = role.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const updated = await sponsorRolesClient.toggleStatus(studyId, role.id, newStatus);
      setRoles((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      dispatch(addToast({ type: 'success', message: `Role '${role.roleName}' ${newStatus === 'Active' ? 'activated' : 'inactivated'}.` }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to update role status.' }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Role & Access Control</h1>
          <p  className={css.sub}>Define custom roles and configure granular permissions for the Sponsor Workspace.</p>
        </div>
        <div className={css.headerActions}>
          <button
            className={css.btnRefresh}
            onClick={() => loadRoles(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'spin .7s linear infinite' } : {}} />
          </button>
          <button
            className={css.btnPrimary}
            onClick={() => navigate(`/sponsor/${studyId}/roles/new`)}
            {...ro.disabledProps('Add Role')}
          >
            <Plus size={15} /> Add Role
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className={css.infoBanner}>
        <Shield size={14} />
        Default system roles (CRO Administrator, Data Manager, Data Reviewer, Site Monitor) are pre-configured and cannot be deleted.
        Role changes take effect immediately after user session refresh.
      </div>

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          {STATUS_OPTIONS.map((st) => (
            <button
              key={st}
              className={`${css.filterBtn} ${statusFilter === st ? css.filterBtnActive : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
        <div className={css.searchWrapper}>
          <Search size={14} className={css.searchIcon} />
          <input
            className={css.searchInput}
            placeholder="Search role name, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={css.searchClear} onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <p className={css.count}>
        {loading ? 'Loading…' : `${filtered.length} role${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* Table */}
      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? css.th : css.thPlain}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className={css.thInner}>
                    {col.label}
                    {col.sortable && <SortIcon colKey={col.key} sort={sort} />}
                  </span>
                </th>
              ))}
              <th className={css.thActions}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className={css.row}>
                  {COLS.map((c) => (
                    <td key={c.key} className={css.td}>
                      <div className={css.skeleton} style={{ width: c.key === 'description' ? 200 : 80 }} />
                    </td>
                  ))}
                  <td className={css.tdActions} />
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} className={css.emptyCell}>
                  <div className={css.empty}>
                    <AlertTriangle size={28} className={css.emptyIcon} />
                    <p className={css.emptyTitle}>No roles found</p>
                    <p className={css.emptySub}>Create a role or adjust the search.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((role) => {
                const { enabled, total } = countPermissions(role.permissions);
                const pct = total ? Math.round((enabled / total) * 100) : 0;
                return (
                  <tr key={role.id} className={`${css.row} ${role.status === 'Inactive' ? css.rowInactive : ''}`}>
                    <td className={css.td}>
                      <div className={css.roleNameCell}>
                        <span className={css.roleName}>{role.roleName}</span>
                        {role.isSystem && <span className={css.systemBadge}>System</span>}
                      </div>
                    </td>
                    <td className={css.td}>
                      <span className={css.description}>{role.description || '—'}</span>
                    </td>
                    <td className={css.td}>
                      <span className={css.userCount}>{role.userCount ?? 0}</span>
                    </td>
                    <td className={css.td}>{role.createdBy || '—'}</td>
                    <td className={css.td}>{fmtDate(role.createdAt)}</td>
                    <td className={css.td}>{fmtDate(role.updatedAt)}</td>
                    <td className={css.td}>
                      <div className={css.statusCell}>
                        <span
                          className={css.statusBadge}
                          style={role.status === 'Active'
                            ? { color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }
                            : { color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
                        >
                          {role.status}
                        </span>
                        <div className={css.permBar} title={`${enabled}/${total} permissions`}>
                          <div className={css.permFill} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={css.permCount}>{pct}%</span>
                      </div>
                    </td>
                    <td className={css.tdActions}>
                      {/* View Permissions */}
                      <button
                        className={css.actionBtn}
                        title="View Permissions"
                        onClick={() => setViewRole(role)}
                      >
                        <Eye size={13} />
                      </button>
                      {/* Edit */}
                      <button
                        className={css.actionBtn}
                        title={ro.isReadOnly ? ro.readOnlyMessage : (role.isSystem ? 'System role — cannot edit' : 'Edit')}
                        disabled={role.isSystem || ro.isReadOnly}
                        aria-disabled={role.isSystem || ro.isReadOnly}
                        onClick={() => !role.isSystem && !ro.isReadOnly && navigate(`/sponsor/${studyId}/roles/${role.id}/edit`)}
                      >
                        <Pencil size={13} />
                      </button>
                      {/* Duplicate */}
                      <button
                        className={`${css.actionBtn} ${css.actionDuplicate}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Duplicate'}
                        onClick={() => { setDuplicateTarget(role); setDuplicateName(`${role.roleName} (Copy)`); }}
                        {...ro.disabledProps('Duplicate role')}
                      >
                        <Copy size={13} />
                      </button>
                      {/* Toggle status */}
                      <button
                        className={`${css.actionBtn} ${role.status === 'Active' ? css.actionDeactivate : css.actionActivate}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : (role.status === 'Active' ? 'Inactivate' : 'Activate')}
                        disabled={role.isSystem || ro.isReadOnly}
                        aria-disabled={role.isSystem || ro.isReadOnly}
                        onClick={() => !ro.isReadOnly && handleToggleStatus(role)}
                      >
                        {role.status === 'Active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      </button>
                      {/* Delete */}
                      <button
                        className={`${css.actionBtn} ${css.actionDelete}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : (role.isSystem ? 'System role — cannot delete' : 'Delete')}
                        disabled={role.isSystem || ro.isReadOnly}
                        aria-disabled={role.isSystem || ro.isReadOnly}
                        onClick={() => !role.isSystem && !ro.isReadOnly && setDeleteTarget(role)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* View Permissions Modal */}
      {viewRole && (
        <ViewPermissionsModal
          role={viewRole}
          onClose={() => setViewRole(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Role"
          message={`Are you sure you want to delete role "${deleteTarget.roleName}"?${deleteTarget.userCount > 0 ? ` This role is assigned to ${deleteTarget.userCount} user(s).` : ''}`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
        />
      )}

      {/* Duplicate Confirm */}
      {duplicateTarget && (
        <div className={css.dialogOverlay}>
          <div className={css.dialogCard}>
            <h3 className={css.dialogTitle}>Duplicate Role</h3>
            <p className={css.dialogDesc}>
              Creating a copy of <strong>{duplicateTarget.roleName}</strong> with all its permissions.
            </p>
            <div className={css.dialogField}>
              <label className={css.dialogLabel}>New Role Name</label>
              <input
                className={css.dialogInput}
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter new role name"
                autoFocus
              />
            </div>
            <div className={css.dialogFooter}>
              <button className={css.btnCancel} onClick={() => { setDuplicateTarget(null); setDuplicateName(''); }}>
                Cancel
              </button>
              <button className={css.btnSave} onClick={handleDuplicate}>
                Create Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
