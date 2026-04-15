import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate }   from 'react-router-dom';
import { useDispatch }   from 'react-redux';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { teamMembersClient, exportTeamMembersCSV } from '@/features/cro/api/teamMembersClient';
import { addToast }      from '@/app/notificationSlice';
import DataTable         from '@/components/data-table/DataTable';
import ConfirmDialog     from '@/components/feedback/ConfirmDialog';
import TeamMemberViewModal from '@/features/cro/components/team-members/TeamMemberViewModal';
import styles from './TeamMembersPage.module.css';

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

export default function TeamMembersPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [members,      setMembers]    = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [query,        setQuery]      = useState('');
  const [viewTarget,   setView]       = useState(null);
  const [deleteTarget, setDel]        = useState(null);
  const [deleting,     setDeleting]   = useState(false);

  // pagination / sort
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey,  setSortKey]  = useState(null);
  const [sortDir,  setSortDir]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    teamMembersClient.list().then((data) => { setMembers(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = members.filter((m) => {
      const q = query.toLowerCase();
      return !q || [m.fullName, m.email, m.roleName, m.contactNumber]
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
  }, [members, query, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => { setPage(1); }, [query, sortKey, sortDir]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleDelete = () => {
    setDeleting(true);
    teamMembersClient
      .delete(deleteTarget.id)
      .then(() => {
        dispatch(addToast({
          type:    'success',
          message: `Team Member '${deleteTarget.fullName}' deleted successfully.`,
        }));
        setDel(null);
        load();
      })
      .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to delete team member. Please try again.' })))
      .finally(() => setDeleting(false));
  };

  const handleExport = async () => {
    try {
      await exportTeamMembersCSV();
      dispatch(addToast({ type: 'success', message: 'Export completed successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export data. Please try again.' }));
    }
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key:      'fullName',
      label:    'Full Name',
      sortable: true,
      render:   (val, row) => (
        <button className={styles.nameBtn} onClick={() => setView(row)} type="button">
          <Avatar photo={row.photograph} name={val} />
        </button>
      ),
    },
    { key: 'email',    label: 'Email Address', sortable: true },
    { key: 'roleName', label: 'Assigned Role',  sortable: true },
    {
      key:   'assignedStudies',
      label: 'Assigned Studies',
      render: (val) => {
        const studies = Array.isArray(val) ? val : [];
        if (studies.length === 0) return <span className={styles.noStudies}>—</span>;
        return (
          <div className={styles.studyTags}>
            {studies.slice(0, 2).map((s) => (
              <span key={s.studyId} className={styles.studyTag} title={s.studyTitle}>
                {s.studyId}
              </span>
            ))}
            {studies.length > 2 && (
              <span className={styles.studyMore}>+{studies.length - 2} more</span>
            )}
          </div>
        );
      },
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
            onClick={(e) => { e.stopPropagation(); navigate(`/cro/team/members/${row.id}`); }}
          >
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); setDel(row); }}
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
          <h1 className={styles.title}>Team Members</h1>
          <p className={styles.sub}>Manage CRO team members and their study assignments.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/cro/team/members/new')}>
          <Plus size={15} />
          Add Team Member
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
        searchPlaceholder="Search by name, email, or role…"
        emptyStateMessage={
          members.length === 0
            ? 'No data available yet. Add team members and assign studies to get started.'
            : 'No team members match your search.'
        }
        emptyStateIllustration={<Users size={40} strokeWidth={1.25} />}
      />

      {/* Detail view modal */}
      {viewTarget && (
        <TeamMemberViewModal
          member={viewTarget}
          onClose={() => setView(null)}
          onEdit={() => { setView(null); navigate(`/cro/team/members/${viewTarget.id}`); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => { if (!deleting) setDel(null); }}
        onConfirm={handleDelete}
        variant="danger"
        title="Delete Team Member"
        message={`Are you sure you want to delete this team member?`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
      />
    </div>
  );
}
