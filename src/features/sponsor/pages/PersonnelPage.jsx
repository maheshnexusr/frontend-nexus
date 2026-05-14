import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  UserPlus, Search, X, RefreshCw, Download, Upload,
  Filter, Eye, Pencil, Trash2, Send, ChevronUp, ChevronDown,
  ChevronsUpDown, AlertTriangle, CheckCircle, Clock, XCircle,
} from 'lucide-react';

import { addToast }                  from '@/app/notificationSlice';
import { sponsorPersonnelClient }    from '../api/sponsorPersonnelClient';
import PersonnelDetailsModal         from '../components/personnel/PersonnelDetailsModal';
import ConfirmDialog                 from '@/components/feedback/ConfirmDialog';
import { useReadOnlyView }           from '@/features/workspace/hooks/useReadOnlyView';
import css from './PersonnelPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES_FILTER   = ['All', 'Principal Investigator', 'Site Coordinator', 'Study Nurse', 'Subject/Patient', 'Pharmacist', 'Lab Technician', 'Other'];
const STATUS_OPTIONS = ['All', 'Active', 'Inactive'];
const CONSENT_STATUS = ['All', 'Pending', 'Submitted', 'Approved', 'Rejected', 'Expired'];

const CONSENT_META = {
  Pending:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: Clock },
  Submitted: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: Clock },
  Approved:  { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: CheckCircle },
  Rejected:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
  Expired:   { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: AlertTriangle },
};

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
  { key: 'siteName',      label: 'Site',             sortable: true  },
  { key: 'status',        label: 'Status',           sortable: true  },
  { key: 'consentStatus', label: 'Consent',          sortable: true  },
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
  const importRef   = useRef(null);
  const ro          = useReadOnlyView();

  // Data
  const [personnel,  setPersonnel]  = useState([]);
  const [sites,      setSites]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [roleFilter,    setRoleFilter]    = useState('All');
  const [siteFilter,    setSiteFilter]    = useState('All');
  const [consentFilter, setConsentFilter] = useState('All');
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
  const [importResult,   setImportResult]   = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else        setRefreshing(true);
    try {
      const filters = {
        ...(statusFilter  !== 'All' ? { status:        statusFilter }  : {}),
        ...(roleFilter    !== 'All' ? { role:           roleFilter }    : {}),
        ...(siteFilter    !== 'All' ? { siteId:         siteFilter }    : {}),
        ...(consentFilter !== 'All' ? { consentStatus:  consentFilter } : {}),
      };
      const [list, siteList] = await Promise.all([
        sponsorPersonnelClient.list(studyId, filters),
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
  }, [studyId, statusFilter, roleFilter, siteFilter, consentFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filter + Sort + Search ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = personnel;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.siteName ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      let av = a[sort.key] ?? '';
      let bv = b[sort.key] ?? '';
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [personnel, search, sort]);

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

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await sponsorPersonnelClient.delete(studyId, deleteTarget.id);
      setPersonnel((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      dispatch(addToast({ type: 'success', message: `'${deleteTarget.fullName}' deleted successfully.` }));
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? '';
      dispatch(addToast({
        type: 'error',
        message: msg.includes('associated')
          ? 'Cannot delete user. They have associated data entries, consents, or queries.'
          : 'Failed to delete user. Please try again.',
      }));
    } finally {
      setDeleteTarget(null);
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

  async function handleExport() {
    try {
      await sponsorPersonnelClient.export(studyId, 'csv');
      dispatch(addToast({ type: 'success', message: 'Personnel exported successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Export failed.' }));
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await sponsorPersonnelClient.import(studyId, file);
      setImportResult(result);
      dispatch(addToast({
        type: result.failed > 0 ? 'warning' : 'success',
        message: `Import complete. ${result.imported} invited, ${result.failed} failed.`,
      }));
      loadData(true);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to import. Check file format and try again.' }));
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
          <button
            className={css.btnSecondary}
            onClick={() => importRef.current?.click()}
            {...ro.disabledProps('Bulk Import')}
          >
            <Upload size={14} /> Bulk Import
          </button>
          <input ref={importRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
          <button className={css.btnSecondary} onClick={handleExport}>
            <Download size={14} /> Export
          </button>
          <button
            className={css.btnRefresh}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'spin .7s linear infinite' } : {}} />
          </button>
          <button
            className={css.btnPrimary}
            onClick={() => navigate(`/sponsor/${studyId}/personnel/new`)}
            {...ro.disabledProps('Invite User')}
          >
            <UserPlus size={15} /> Invite User
          </button>
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

          {/* Role */}
          <select
            className={css.selectFilter}
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            {ROLES_FILTER.map((r) => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>)}
          </select>

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

          {/* Consent Status */}
          <select
            className={css.selectFilter}
            value={consentFilter}
            onChange={(e) => { setConsentFilter(e.target.value); setPage(1); }}
          >
            {CONSENT_STATUS.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Consent' : c}</option>)}
          </select>
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
          <button
            className={css.bulkResend}
            onClick={handleBulkResend}
            {...ro.disabledProps('Resend invitations')}
          >
            <Send size={13} /> Resend Invitations
          </button>
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
                const cMeta = CONSENT_META[p.consentStatus] ?? CONSENT_META.Pending;
                const CIcon = cMeta.icon;
                const compColor = COMP_COLORS[p.compensation?.type] ?? COMP_COLORS.None;
                const isSel = selected.has(p.id);
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
                    <td className={css.td}>{p.siteName || '—'}</td>
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
                      {p.consentRequired ? (
                        <span
                          className={css.consentBadge}
                          style={{ color: cMeta.color, background: cMeta.bg, borderColor: cMeta.border }}
                        >
                          <CIcon size={10} /> {p.consentStatus}
                        </span>
                      ) : (
                        <span className={css.consentNone}>—</span>
                      )}
                    </td>
                    <td className={css.td}>
                      <span className={css.compType} style={{ color: compColor.color }}>
                        {p.compensation?.type || 'None'}
                      </span>
                    </td>
                    <td className={css.tdActions}>
                      <button className={css.actionBtn} title="View Details" onClick={() => setDetailTarget(p)}>
                        <Eye size={13} />
                      </button>
                      <button
                        className={css.actionBtn}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Edit'}
                        onClick={() => navigate(`/sponsor/${studyId}/personnel/${p.id}/edit`)}
                        {...ro.disabledProps('Edit personnel')}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className={`${css.actionBtn} ${css.actionResend}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Resend Invitation'}
                        onClick={() => setResendTarget(p)}
                        {...ro.disabledProps('Resend invitation')}
                      >
                        <Send size={13} />
                      </button>
                      <button
                        className={`${css.actionBtn} ${css.actionDelete}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
                        onClick={() => setDeleteTarget(p)}
                        {...ro.disabledProps('Delete personnel')}
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

      {/* Import Result */}
      {importResult && (
        <div className={css.importResult}>
          <div className={css.importSummary}>
            <span className={css.importSuccess}>{importResult.imported} invited</span>
            {importResult.failed > 0 && <span className={css.importFail}>{importResult.failed} failed</span>}
            <button className={css.importClose} onClick={() => setImportResult(null)}><X size={12} /></button>
          </div>
          {importResult.errors?.length > 0 && (
            <ul className={css.importErrors}>
              {importResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              {importResult.errors.length > 10 && <li>…and {importResult.errors.length - 10} more.</li>}
            </ul>
          )}
        </div>
      )}

      {/* Details Modal */}
      {detailTarget && (
        <PersonnelDetailsModal
          studyId={studyId}
          personnel={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Personnel"
          message={`Are you sure you want to delete "${deleteTarget.fullName}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
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
