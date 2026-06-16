import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  UserPlus, Search, X, RefreshCw, Upload,
  Filter, Eye, Pencil, Trash2, Send, ChevronUp, ChevronDown,
  ChevronsUpDown, AlertTriangle,
} from 'lucide-react';

import { addToast }                  from '@/app/notificationSlice';
import { sponsorPersonnelClient }    from '../api/sponsorPersonnelClient';
import PersonnelDetailsModal         from '../components/personnel/PersonnelDetailsModal';
import PersonnelDeleteModal          from '../components/personnel/PersonnelDeleteModal';
import PersonnelImportModal          from '../components/personnel/PersonnelImportModal';
import ConfirmDialog                 from '@/components/feedback/ConfirmDialog';
import { useReadOnlyView }           from '@/features/workspace/hooks/useReadOnlyView';
import { usePermissions }            from '@/features/auth/usePermissions';
import css from './PersonnelPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['All', 'Active', 'Inactive'];

const COMP_COLORS = {
  None:            { color: '#94a3b8' },
  'Per Study':     { color: '#059669' },
  'Per Subject':   { color: '#2563eb' },
  'Per Visit':     { color: '#7c3aed' },
  'Milestone Based': { color: '#d97706' },
};

const COLS = [
  { key: 'fullName',      label: 'Full Name',        sortable: true  },
  { key: 'email',         label: 'Email',            sortable: false },
  { key: 'role',          label: 'Role',             sortable: true  },
  { key: 'siteName',      label: 'Sites',            sortable: false },
  { key: 'status',        label: 'Status',           sortable: true  },
  { key: 'compType',      label: 'Compensation',     sortable: false },
];

const PAGE_SIZES = [20, 50, 100];

// ── Helpers ───────────────────────────────────────────────────────────────────

function SortIcon({ colKey, sort }) {
  if (sort.key !== colKey) return <ChevronsUpDown size={11} style={{ opacity: .35 }} />;
  return sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PersonnelPage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();
  const { has }     = usePermissions();
  const canCreate   = has('site_personnel', 'create');
  const canEdit     = has('site_personnel', 'edit');
  const canDelete   = has('site_personnel', 'delete');
  const canImport   = has('site_personnel', 'import');

  // Data
  const [personnel,  setPersonnel]  = useState([]);
  const [sites,      setSites]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters (All/Active/Inactive + Site are applied CLIENT-SIDE — the backend
  // list ignores these params, so filtering here keeps them honest.)
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [siteFilter,    setSiteFilter]    = useState('All');
  const [search,        setSearch]        = useState('');

  // Sort / Pagination
  const [sort,     setSort]     = useState({ key: 'fullName', dir: 'asc' });
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());

  // Modals
  const [detailTarget,   setDetailTarget]   = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [resendTarget,   setResendTarget]   = useState(null);      // { id, fullName, email }
  const [importOpen,     setImportOpen]     = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else        setRefreshing(true);
    try {
      const [list, siteList] = await Promise.all([
        sponsorPersonnelClient.list(studyId),
        sites.length ? Promise.resolve(sites) : sponsorPersonnelClient.getSites(studyId),
      ]);
      setPersonnel(list);
      if (!sites.length) setSites(siteList);
      setSelected(new Set());
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to load site personnel.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filter + Sort + Search ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = personnel;
    if (statusFilter !== 'All') {
      list = list.filter((p) => (p.status ?? 'Active') === statusFilter);
    }
    if (siteFilter !== 'All') {
      list = list.filter((p) => (p.siteIds ?? []).includes(siteFilter));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.siteName ?? '').toLowerCase().includes(q) ||
          (p.siteNames ?? []).some((n) => (n ?? '').toLowerCase().includes(q)),
      );
    }
    return [...list].sort((a, b) => {
      let av = a[sort.key] ?? '';
      let bv = b[sort.key] ?? '';
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [personnel, search, sort, statusFilter, siteFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  const allOnPageSelected = pageData.length > 0 && pageData.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageData.forEach((p) => next.delete(p.id));
      else                   pageData.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── CRUD Handlers ─────────────────────────────────────────────────────────

  async function handleDelete(reason) {
    if (!deleteTarget) return;
    try {
      await sponsorPersonnelClient.delete(studyId, deleteTarget.id, reason);
      setPersonnel((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      dispatch(addToast({ type: 'success', message: `'${deleteTarget.fullName}' and all of their data deleted.` }));
      setDeleteTarget(null);
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to delete user. Please try again.';
      dispatch(addToast({ type: 'error', message: msg }));
      throw e; // keep the modal open on failure
    }
  }

  async function handleResendInvitation() {
    if (!resendTarget) return;
    try {
      await sponsorPersonnelClient.resendInvitation(studyId, resendTarget.id);
      dispatch(addToast({ type: 'success', message: `Invitation resent to ${resendTarget.email}.` }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to resend invitation. Please try again.' }));
    } finally {
      setResendTarget(null);
    }
  }

  async function handleBulkResend() {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => sponsorPersonnelClient.resendInvitation(studyId, id)));
      dispatch(addToast({ type: 'success', message: `Invitations resent to ${ids.length} users.` }));
      setSelected(new Set());
    } catch {
      dispatch(addToast({ type: 'error', message: 'Some invitations failed to send.' }));
    }
  }

  // ── Pagination helpers ────────────────────────────────────────────────────

  function pageRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)   return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', cur - 1, cur, cur + 1, '…', total];
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedCount = selected.size;

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Site Personnel</h1>
          <p  className={css.sub}>Manage site teams, investigators, coordinators, and enrolled subjects.</p>
        </div>
        <div className={css.headerActions}>
          {canImport && (
            <button
              className={css.btnSecondary}
              onClick={() => setImportOpen(true)}
              {...ro.disabledProps('Import Personnel')}
            >
              <Upload size={14} /> Import Personnel
            </button>
          )}
          <button
            className={css.btnRefresh}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'spin .7s linear infinite' } : {}} />
          </button>
          {canCreate && (
            <button
              className={css.btnPrimary}
              onClick={() => navigate(`/sponsor/${studyId}/personnel/new`)}
              {...ro.disabledProps('Invite User')}
            >
              <UserPlus size={15} /> Invite User
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          {/* Status */}
          <div className={css.filterWrap}>
            <Filter size={13} className={css.filterIcon} />
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                className={`${css.filterBtn} ${statusFilter === st ? css.filterBtnActive : ''}`}
                onClick={() => { setStatusFilter(st); setPage(1); }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Site */}
          {sites.length > 0 && (
            <select
              className={css.selectFilter}
              value={siteFilter}
              onChange={(e) => { setSiteFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </div>

        {/* Search */}
        <div className={css.searchWrapper}>
          <Search size={14} className={css.searchIcon} />
          <input
            className={css.searchInput}
            placeholder="Search name, email, site…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className={css.searchClear} onClick={() => { setSearch(''); setPage(1); }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selectedCount > 0 && (
        <div className={css.bulkBar}>
          <span className={css.bulkCount}>{selectedCount} selected</span>
          {canEdit && (
            <button
              className={css.bulkResend}
              onClick={handleBulkResend}
              {...ro.disabledProps('Resend invitations')}
            >
              <Send size={13} /> Resend Invitations
            </button>
          )}
          <button className={css.bulkClear} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Count */}
      <p className={css.count}>
        {loading ? 'Loading…' : `${filtered.length} personnel record${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* Table */}
      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th className={css.thCheck}>
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  disabled={pageData.length === 0}
                />
              </th>
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
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={css.row}>
                  <td className={css.tdCheck} />
                  {COLS.map((c) => (
                    <td key={c.key} className={css.td}>
                      <div className={css.skeleton} style={{ width: c.key === 'fullName' ? 120 : 80 }} />
                    </td>
                  ))}
                  <td className={css.tdActions} />
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 2} className={css.emptyCell}>
                  <div className={css.empty}>
                    <AlertTriangle size={28} className={css.emptyIcon} />
                    <p className={css.emptyTitle}>No personnel found</p>
                    <p className={css.emptySub}>Invite a user or adjust the filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((p) => {
                const compColor = COMP_COLORS[p.compensation?.type] ?? COMP_COLORS.None;
                const isSel = selected.has(p.id);
                // Site cell: "All Sites" badge when the person covers every
                // active study site (and there's more than one); otherwise list
                // each assigned site name. Falls back to the primary site_name.
                const names = (p.siteNames?.length ? p.siteNames : (p.siteName ? [p.siteName] : []));
                const isAllSites = p.totalActiveSites > 1 && (p.siteIds?.length ?? 0) >= p.totalActiveSites;
                return (
                  <tr key={p.id} className={`${css.row} ${isSel ? css.rowSelected : ''}`}>
                    <td className={css.tdCheck}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleRow(p.id)}
                      />
                    </td>
                    <td className={css.td}>
                      <div className={css.nameCell}>
                        <span className={css.fullName}>{p.fullName}</span>
                        {!p.invitationSent && (
                          <span className={css.notInvited}>Not invited</span>
                        )}
                      </div>
                    </td>
                    <td className={css.td}><span className={css.email}>{p.email}</span></td>
                    <td className={css.td}><span className={css.roleBadge}>{p.role}</span></td>
                    <td className={css.td}>
                      {isAllSites ? (
                        <span
                          className={css.statusBadge}
                          style={{ color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' }}
                        >
                          All Sites
                        </span>
                      ) : names.length ? (
                        <span title={names.join(', ')}>{names.join(', ')}</span>
                      ) : '—'}
                    </td>
                    <td className={css.td}>
                      <span
                        className={css.statusBadge}
                        style={p.status === 'Active'
                          ? { color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }
                          : { color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className={css.td}>
                      <span className={css.compType} style={{ color: compColor.color }}>
                        {p.compensation?.type || 'None'}
                      </span>
                    </td>
                    <td className={css.tdActions}>
                      <button className={css.actionBtn} title="View Details" onClick={() => navigate(`/sponsor/${studyId}/personnel/${p.id}/view`)}>
                        <Eye size={13} />
                      </button>
                      {canEdit && (
                        <button
                          className={css.actionBtn}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Edit'}
                          onClick={() => navigate(`/sponsor/${studyId}/personnel/${p.id}/edit`)}
                          {...ro.disabledProps('Edit personnel')}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          className={`${css.actionBtn} ${css.actionResend}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Resend Invitation'}
                          onClick={() => setResendTarget(p)}
                          {...ro.disabledProps('Resend invitation')}
                        >
                          <Send size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className={`${css.actionBtn} ${css.actionDelete}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
                          onClick={() => setDeleteTarget(p)}
                          {...ro.disabledProps('Delete personnel')}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > pageSize && (
        <div className={css.pagination}>
          <span className={css.pageInfo}>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className={css.pageButtons}>
            <button className={css.pageBtn} onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
            <button className={css.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={safePage === 1}>‹</button>
            {pageRange(safePage, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className={css.pageEllipsis}>…</span>
              ) : (
                <button
                  key={p}
                  className={`${css.pageBtn} ${p === safePage ? css.pageBtnActive : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
            <button className={css.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={safePage === totalPages}>›</button>
            <button className={css.pageBtn} onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
          </div>
          <select
            className={css.pageSizeSelect}
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      )}

      {/* Import Personnel Modal */}
      {importOpen && (
        <PersonnelImportModal
          studyId={studyId}
          onClose={() => setImportOpen(false)}
          onImported={() => loadData(true)}
        />
      )}

      {/* Details Modal */}
      {detailTarget && (
        <PersonnelDetailsModal
          studyId={studyId}
          personnel={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Delete — impact summary + required reason */}
      {deleteTarget && (
        <PersonnelDeleteModal
          studyId={studyId}
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Resend Invitation Confirm */}
      {resendTarget && (
        <ConfirmDialog
          open
          onClose={() => setResendTarget(null)}
          onConfirm={handleResendInvitation}
          title="Resend Invitation"
          message={`Resend the invitation email to "${resendTarget.fullName}" (${resendTarget.email})?`}
          confirmLabel="Resend"
          cancelLabel="Cancel"
          variant="info"
        />
      )}
    </div>
  );
}
