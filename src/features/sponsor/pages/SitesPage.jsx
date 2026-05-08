import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams }   from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Plus, Search, X, RefreshCw, Download, Upload,
  Filter, Lock, Unlock, Eye, Pencil, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle,
} from 'lucide-react';

import { addToast }             from '@/app/notificationSlice';
import { sponsorSitesClient }   from '../api/sponsorSitesClient';
import SiteFormModal            from '../components/sites/SiteFormModal';
import LockUnlockModal          from '../components/sites/LockUnlockModal';
import SiteDetailsModal         from '../components/sites/SiteDetailsModal';
import ConfirmDialog            from '@/components/feedback/ConfirmDialog';
import { useReadOnlyView }      from '@/features/workspace/hooks/useReadOnlyView';
import css from './SitesPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS    = ['All', 'Active', 'Inactive'];
const LOCK_OPTIONS      = ['All', 'Unlocked', 'Locked'];

const COLS = [
  { key: 'siteCode',            label: 'Site Code',    sortable: true  },
  { key: 'siteName',            label: 'Site Name',    sortable: true  },
  { key: 'contactPerson',       label: 'Contact',      sortable: true  },
  { key: 'email',               label: 'Email',        sortable: false },
  { key: 'contactNumber',       label: 'Phone',        sortable: false },
  { key: 'city',                label: 'City',         sortable: true  },
  { key: 'country',             label: 'Country',      sortable: true  },
  { key: 'expectedEnrollments', label: 'Expected',     sortable: true  },
  { key: 'actualEnrollments',   label: 'Actual',       sortable: true  },
  { key: 'status',              label: 'Status',       sortable: true  },
  { key: 'isLocked',            label: 'Lock',         sortable: true  },
];

const PAGE_SIZES = [20, 50, 100];

// ── Helpers ───────────────────────────────────────────────────────────────────

function SortIcon({ colKey, sort }) {
  if (sort.key !== colKey) return <ChevronsUpDown size={11} style={{ opacity: .35 }} />;
  return sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

function progressColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const importRef   = useRef(null);
  const ro          = useReadOnlyView();

  // Data
  const [sites,      setSites]      = useState([]);
  const [countries,  setCountries]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [lockFilter,    setLockFilter]    = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [citySearch,    setCitySearch]    = useState('');
  const [search,        setSearch]        = useState('');

  // Sort / Pagination
  const [sort,     setSort]     = useState({ key: 'siteCode', dir: 'asc' });
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modals
  const [formSite,       setFormSite]       = useState(undefined); // undefined = closed, null = create, obj = edit
  const [lockTarget,     setLockTarget]     = useState(null);      // { mode, site }
  const [detailSite,     setDetailSite]     = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);      // site object
  const [importResult,   setImportResult]   = useState(null);      // { imported, failed, errors }

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadSites = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else        setRefreshing(true);
    try {
      const filters = {
        ...(statusFilter  !== 'All' ? { status:   statusFilter }  : {}),
        ...(countryFilter !== 'All' ? { country:  countryFilter } : {}),
        ...(lockFilter    !== 'All' ? { isLocked: lockFilter === 'Locked' } : {}),
      };
      const [list, ctries] = await Promise.all([
        sponsorSitesClient.list(studyId, filters),
        countries.length ? Promise.resolve(countries) : sponsorSitesClient.getCountries(studyId),
      ]);
      setSites(list);
      if (!countries.length) setCountries(ctries);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to load sites.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, statusFilter, lockFilter, countryFilter]);

  useEffect(() => { loadSites(); }, [loadSites]);

  // ── Filter + Sort + Search (client-side) ──────────────────────────────────

  const filtered = useMemo(() => {
    let list = sites;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.siteCode.toLowerCase().includes(q) ||
          s.siteName.toLowerCase().includes(q) ||
          (s.contactPerson ?? '').toLowerCase().includes(q) ||
          (s.email ?? '').toLowerCase().includes(q) ||
          (s.city ?? '').toLowerCase().includes(q) ||
          (s.country ?? '').toLowerCase().includes(q),
      );
    }
    if (citySearch.trim()) {
      const c = citySearch.trim().toLowerCase();
      list = list.filter((s) => (s.city ?? '').toLowerCase().includes(c));
    }
    return [...list].sort((a, b) => {
      let av = a[sort.key] ?? '';
      let bv = b[sort.key] ?? '';
      if (typeof av === 'boolean') av = av ? 1 : 0;
      if (typeof bv === 'boolean') bv = bv ? 1 : 0;
      if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [sites, search, citySearch, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  }

  // ── CRUD Handlers ─────────────────────────────────────────────────────────

  async function handleSave(data) {
    const isEdit = !!formSite;
    if (isEdit) {
      const updated = await sponsorSitesClient.update(studyId, formSite.id ?? formSite.siteCode, data);
      setSites((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      dispatch(addToast({ type: 'success', message: `Site '${updated.siteName}' updated successfully.` }));
    } else {
      const created = await sponsorSitesClient.create(studyId, data);
      setSites((prev) => [created, ...prev]);
      dispatch(addToast({ type: 'success', message: `Site '${created.siteName}' created successfully.` }));
    }
    setFormSite(undefined);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await sponsorSitesClient.delete(studyId, deleteTarget.id ?? deleteTarget.siteCode);
      setSites((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      dispatch(addToast({ type: 'success', message: `Site '${deleteTarget.siteName}' deleted successfully.` }));
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? '';
      dispatch(addToast({
        type: 'error',
        message: msg.includes('associated')
          ? 'Cannot delete site. It is associated with existing records (Subjects, Personnel, Data, Queries).'
          : 'Failed to delete site. Please try again.',
      }));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleLockUnlock(reason) {
    const { mode, site } = lockTarget;
    const updated = mode === 'lock'
      ? await sponsorSitesClient.lock(studyId, site.id ?? site.siteCode, reason)
      : await sponsorSitesClient.unlock(studyId, site.id ?? site.siteCode, reason);
    setSites((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    dispatch(addToast({
      type: 'success',
      message: `Site '${updated.siteName}' ${mode === 'lock' ? 'locked' : 'unlocked'} successfully.`,
    }));
    setLockTarget(null);
  }

  async function handleExport(format) {
    try {
      await sponsorSitesClient.export(studyId, format, {
        status:  statusFilter  !== 'All' ? statusFilter  : undefined,
        country: countryFilter !== 'All' ? countryFilter : undefined,
      });
      dispatch(addToast({ type: 'success', message: 'Sites exported successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to export sites.' }));
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await sponsorSitesClient.import(studyId, file);
      setImportResult(result);
      dispatch(addToast({
        type: result.failed > 0 ? 'warning' : 'success',
        message: `Sites imported. ${result.imported} imported, ${result.failed} failed.`,
      }));
      loadSites(true);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to import sites. Please check file format.' }));
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

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Sites</h1>
          <p  className={css.sub}>Manage participating clinical trial sites for this study.</p>
        </div>
        <div className={css.headerActions}>
          <button
            className={css.btnSecondary}
            onClick={() => importRef.current?.click()}
            {...ro.disabledProps('Import sites')}
          >
            <Upload size={14} /> Import
          </button>
          <input ref={importRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
          <button className={css.btnSecondary} onClick={() => handleExport('csv')}>
            <Download size={14} /> CSV
          </button>
          <button className={css.btnSecondary} onClick={() => handleExport('xlsx')}>
            <Download size={14} /> Excel
          </button>
          <button
            className={css.btnRefresh}
            onClick={() => loadSites(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={15} style={refreshing ? { animation: 'spin .7s linear infinite' } : {}} />
          </button>
          <button
            className={css.btnPrimary}
            onClick={() => setFormSite(null)}
            {...ro.disabledProps('Add Site')}
          >
            <Plus size={15} /> Add Site
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          <div className={css.filterWrap}>
            <Filter size={13} className={css.filterIcon} />

            {/* Status */}
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

          {/* Lock filter */}
          <div className={css.filterWrap}>
            {LOCK_OPTIONS.map((lo) => (
              <button
                key={lo}
                className={`${css.filterBtn} ${lockFilter === lo ? css.filterBtnActive : ''}`}
                onClick={() => { setLockFilter(lo); setPage(1); }}
              >
                {lo === 'Locked' ? <><Lock size={10} /> Locked</> : lo === 'Unlocked' ? <><Unlock size={10} /> Unlocked</> : lo}
              </button>
            ))}
          </div>

          {/* Country */}
          {countries.length > 0 && (
            <select
              className={css.selectFilter}
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
            >
              <option value="All">All Countries</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* City */}
          <input
            className={css.cityInput}
            placeholder="Filter by city…"
            value={citySearch}
            onChange={(e) => { setCitySearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Search */}
        <div className={css.searchWrapper}>
          <Search size={14} className={css.searchIcon} />
          <input
            className={css.searchInput}
            placeholder="Search site code, name, contact…"
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

      {/* Count */}
      <p className={css.count}>
        {loading ? 'Loading…' : `${filtered.length} site${filtered.length !== 1 ? 's' : ''}`}
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
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={css.row}>
                  {COLS.map((c) => (
                    <td key={c.key} className={css.td}>
                      <div className={css.skeleton} style={{ width: c.key === 'siteName' ? 120 : 70 }} />
                    </td>
                  ))}
                  <td className={css.tdActions} />
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} className={css.emptyCell}>
                  <div className={css.empty}>
                    <AlertTriangle size={28} className={css.emptyIcon} />
                    <p className={css.emptyTitle}>No sites found</p>
                    <p className={css.emptySub}>Add a site or adjust filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((site) => {
                const enrollPct = site.expectedEnrollments
                  ? Math.min(100, Math.round(((site.actualEnrollments ?? 0) / site.expectedEnrollments) * 100))
                  : 0;
                const atTarget = (site.actualEnrollments ?? 0) >= (site.expectedEnrollments ?? 1);
                return (
                  <tr
                    key={site.id ?? site.siteCode}
                    className={`${css.row} ${site.isLocked ? css.rowLocked : ''}`}
                  >
                    <td className={css.td}>
                      <span className={css.siteCode}>{site.siteCode}</span>
                    </td>
                    <td className={css.td}>
                      <span className={css.siteName}>{site.siteName}</span>
                      {site.isLocked && <Lock size={11} className={css.lockIcon} />}
                    </td>
                    <td className={css.td}>{site.contactPerson || '—'}</td>
                    <td className={css.td}><span className={css.email}>{site.email || '—'}</span></td>
                    <td className={css.td}>{site.contactNumber || '—'}</td>
                    <td className={css.td}>{site.city || '—'}</td>
                    <td className={css.td}>{site.country || '—'}</td>
                    <td className={css.td}>{site.expectedEnrollments ?? 0}</td>
                    <td className={css.td}>
                      <div className={css.enrollCell}>
                        <div className={css.progressMini}>
                          <div
                            className={css.progressMiniFill}
                            style={{ width: `${enrollPct}%`, background: progressColor(enrollPct) }}
                          />
                        </div>
                        <span style={{ color: atTarget ? '#059669' : undefined, fontWeight: atTarget ? 700 : undefined }}>
                          {site.actualEnrollments ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className={css.td}>
                      <span
                        className={css.statusBadge}
                        style={site.status === 'Active'
                          ? { color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }
                          : { color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
                      >
                        {site.status}
                      </span>
                    </td>
                    <td className={css.td}>
                      {site.isLocked ? (
                        <span className={css.lockBadge}><Lock size={10} /> Locked</span>
                      ) : (
                        <span className={css.unlockBadge}><Unlock size={10} /> Open</span>
                      )}
                    </td>
                    <td className={css.tdActions}>
                      <button
                        className={css.actionBtn}
                        title="View Details"
                        onClick={() => setDetailSite(site)}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        className={css.actionBtn}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Edit'}
                        onClick={() => setFormSite(site)}
                        disabled={site.isLocked || ro.isReadOnly}
                        aria-disabled={site.isLocked || ro.isReadOnly}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className={`${css.actionBtn} ${site.isLocked ? css.actionUnlock : css.actionLock}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : (site.isLocked ? 'Unlock' : 'Lock')}
                        onClick={() => setLockTarget({ mode: site.isLocked ? 'unlock' : 'lock', site })}
                        {...ro.disabledProps(site.isLocked ? 'Unlock site' : 'Lock site')}
                      >
                        {site.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                      </button>
                      <button
                        className={`${css.actionBtn} ${css.actionDelete}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
                        onClick={() => setDeleteTarget(site)}
                        {...ro.disabledProps('Delete site')}
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
            <span className={css.importSuccess}>{importResult.imported} imported</span>
            {importResult.failed > 0 && (
              <span className={css.importFail}>{importResult.failed} failed</span>
            )}
            <button className={css.importClose} onClick={() => setImportResult(null)}>
              <X size={12} />
            </button>
          </div>
          {importResult.errors?.length > 0 && (
            <ul className={css.importErrors}>
              {importResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {importResult.errors.length > 10 && (
                <li>…and {importResult.errors.length - 10} more errors.</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Site Form Modal (Create / Edit) */}
      {formSite !== undefined && (
        <SiteFormModal
          site={formSite}
          countries={countries}
          onSave={handleSave}
          onClose={() => setFormSite(undefined)}
        />
      )}

      {/* Lock / Unlock Modal */}
      {lockTarget && (
        <LockUnlockModal
          mode={lockTarget.mode}
          site={lockTarget.site}
          onConfirm={handleLockUnlock}
          onClose={() => setLockTarget(null)}
        />
      )}

      {/* Site Details Modal */}
      {detailSite && (
        <SiteDetailsModal
          studyId={studyId}
          site={detailSite}
          onClose={() => setDetailSite(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Site"
          message={`Are you sure you want to delete site "${deleteTarget.siteName}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
        />
      )}
    </div>
  );
}
