import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Eye, CheckCircle, XCircle, Download, Filter,
  Search, X as XIcon, FileCheck, RefreshCw,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { sponsorConsentReviewClient } from '@/features/sponsor/api/sponsorConsentReviewClient';
import { useReadOnlyView }    from '@/features/workspace/hooks/useReadOnlyView';
import { addToast }          from '@/app/notificationSlice';
import { formatDateTime }    from '@/utils/formatDate';
import PlatformDatePicker    from '@/components/form/PlatformDatePicker';
import SnapshotButton        from '@/components/feedback/SnapshotButton';
import { usePermissions }    from '@/features/auth/usePermissions';
import SearchableDropdown    from '@/components/form/SearchableDropdown';
import ApproveModal          from '@/features/sponsor/components/consent/ApproveModal';
import RejectModal           from '@/features/sponsor/components/consent/RejectModal';
import ConsentDetailsModal   from '@/features/sponsor/components/consent/ConsentDetailsModal';
import styles from './ConsentReviewPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['All', 'Pending', 'Approved', 'Rejected', 'Expired'];

const STATUS_META = {
  Pending:  { color: '#f59e0b', bg: '#fffbeb' },
  Approved: { color: '#10b981', bg: '#ecfdf5' },
  Rejected: { color: '#dc2626', bg: '#fef2f2' },
  Expired:  { color: '#94a3b8', bg: '#f8fafc' },
};

const fmtDate = (iso) => formatDateTime(iso) || '—';

function SortIcon({ col, sortKey, sortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />;
  if (sortDir === 'asc')  return <ChevronUp    size={12} />;
  return                          <ChevronDown  size={12} />;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsentReviewPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const ro          = useReadOnlyView();

  // ── Data state ───────────────────────────────────────────────────────────
  const [submissions, setSubmissions] = useState([]);
  const [roleOpts,    setRoleOpts]    = useState([]);
  const [loading,     setLoading]     = useState(true);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [statusFilter, setStatus]     = useState('Pending');
  const [roleFilter,   setRoleFilter] = useState('');
  const [query,        setQuery]      = useState('');
  const [dateFrom,     setDateFrom]   = useState('');
  const [dateTo,       setDateTo]     = useState('');

  // ── Pagination & sort ────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey,  setSortKey]  = useState('submissionDate');
  const [sortDir,  setSortDir]  = useState('desc');

  // ── Selection ────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState(new Set());

  // ── Modals ───────────────────────────────────────────────────────────────
  const [detailsTarget,  setDetailsTarget]  = useState(null);
  const [approveTarget,  setApproveTarget]  = useState(null); // submission | 'bulk'
  const [rejectTarget,   setRejectTarget]   = useState(null); // submission | 'bulk'
  const [downloading,    setDownloading]    = useState(null); // id

  // ── Permission gates ─────────────────────────────────────────────────────
  // Approve and Reject are discrete actions on the consent_review leaf; a
  // reviewer can hold one without the other (e.g. a "Returns" specialist who
  // can only reject, or an Approval Officer who can only approve). Without
  // the discrete permission the corresponding button is hidden everywhere —
  // single-row action AND bulk-bar.
  const { has } = usePermissions();
  const canApprove = has('consent_review', 'approve');
  const canReject  = has('consent_review', 'reject');

  // ── Load data ────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    if (!studyId) return;
    setLoading(true);
    Promise.all([
      sponsorConsentReviewClient.list(studyId, {
        status:   statusFilter,
        roleId:   roleFilter,
        dateFrom,
        dateTo,
      }),
      roleOpts.length ? Promise.resolve(null) : sponsorConsentReviewClient.getRoles(studyId),
    ]).then(([subs, roles]) => {
      setSubmissions(subs);
      if (roles) setRoleOpts(roles);
      setSelected(new Set());
    })
    .catch(() => dispatch(addToast({ type: 'error', message: 'Failed to load consent submissions.' })))
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, statusFilter, roleFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [statusFilter, roleFilter, query, dateFrom, dateTo]);

  // ── Filter + sort + search ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = submissions.filter((s) => {
      const q = query.toLowerCase();
      if (q) {
        const match = [s.userName, s.userEmail, s.role, s.siteName, s.siteCode]
          .some((v) => (v ?? '').toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [submissions, query, sortKey, sortDir]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // ── Selection ────────────────────────────────────────────────────────────
  const pendingOnPage = pageData.filter((s) => s.status === 'Pending');
  const allPagePendingSelected = pendingOnPage.length > 0 &&
    pendingOnPage.every((s) => selected.has(s.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPagePendingSelected) {
        pendingOnPage.forEach((s) => next.delete(s.id));
      } else {
        pendingOnPage.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleApproveConfirm = async (data) => {
    try {
      if (approveTarget === 'bulk') {
        const ids = [...selected];
        const count = await sponsorConsentReviewClient.bulkApprove(studyId, ids, data);
        dispatch(addToast({ type: 'success', message: `${count} consent${count !== 1 ? 's' : ''} approved successfully. Email notification sent.` }));
      } else {
        await sponsorConsentReviewClient.approve(studyId, approveTarget.id, data);
        dispatch(addToast({ type: 'success', message: 'Consent approved successfully. Email notification sent to the user.' }));
      }
      setApproveTarget(null);
      load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to approve consent. Please try again.' }));
      throw new Error('approve failed');
    }
  };

  const handleRejectConfirm = async (data) => {
    try {
      if (rejectTarget === 'bulk') {
        const ids = [...selected];
        const count = await sponsorConsentReviewClient.bulkReject(studyId, ids, data);
        dispatch(addToast({ type: 'success', message: `${count} consent${count !== 1 ? 's' : ''} rejected successfully. Email notification sent.` }));
      } else {
        await sponsorConsentReviewClient.reject(studyId, rejectTarget.id, data);
        dispatch(addToast({ type: 'success', message: 'Consent rejected successfully. Email notification sent to the user.' }));
      }
      setRejectTarget(null);
      load();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to reject consent. Please try again.' }));
      throw new Error('reject failed');
    }
  };

  const handleDownload = async (submission) => {
    setDownloading(submission.id);
    try {
      const blob = await sponsorConsentReviewClient.download(studyId, submission.id);
      const name = `Consent_${submission.id}_${submission.userName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`;
      triggerDownload(blob, name);
      dispatch(addToast({ type: 'success', message: 'Consent record downloaded successfully.' }));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to download consent record. Please try again.' }));
    } finally {
      setDownloading(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedCount = selected.size;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Consent Review & Approval</h1>
          <p className={styles.sub}>Review, approve, or reject consent submissions for this study.</p>
        </div>
        <div className={styles.headerActions}>
          <SnapshotButton leaf="consent_review" filename="consent_review" />
          <button className={styles.btnRefresh} onClick={load} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Status filter pills */}
          <div className={styles.filterWrap}>
            <Filter size={13} className={styles.filterIcon} />
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Role filter */}
          <div className={styles.roleFilter}>
            <SearchableDropdown
              options={[{ value: '', label: 'All Roles' }, ...roleOpts]}
              value={roleFilter}
              onChange={(v) => setRoleFilter(v ?? '')}
              placeholder="All Roles"
              searchPlaceholder="Search role…"
            />
          </div>

          {/* Date range */}
          <div className={styles.dateRange}>
            <PlatformDatePicker
              className={styles.dateInput}
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="From date"
            />
            <span className={styles.dateSep}>–</span>
            <PlatformDatePicker
              className={styles.dateInput}
              value={dateTo}
              onChange={setDateTo}
              placeholder="To date"
            />
          </div>
        </div>

        {/* Search */}
        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search name, email, site, role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.searchClear} onClick={() => setQuery('')}>
              <XIcon size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedCount} submission{selectedCount !== 1 ? 's' : ''} selected
          </span>
          {canApprove && (
            <button
              className={styles.bulkApprove}
              onClick={() => setApproveTarget('bulk')}
              {...ro.disabledProps('Approve selected')}
            >
              <CheckCircle size={13} /> Approve Selected
            </button>
          )}
          {canReject && (
            <button
              className={styles.bulkReject}
              onClick={() => setRejectTarget('bulk')}
              {...ro.disabledProps('Reject selected')}
            >
              <XCircle size={13} /> Reject Selected
            </button>
          )}
          <button
            className={styles.bulkClear}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Count */}
      <div className={styles.countBar}>
        <span className={styles.count}>
          {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
          {submissions.length !== filtered.length && ` (of ${submissions.length})`}
        </span>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCheck}>
                <input
                  type="checkbox"
                  checked={allPagePendingSelected}
                  onChange={toggleAll}
                  disabled={pendingOnPage.length === 0}
                  title="Select all pending on this page"
                />
              </th>
              {[
                { key: 'userName',       label: 'User Name'       },
                { key: 'role',           label: 'Role'            },
                { key: 'siteCode',       label: 'Site Code'       },
                { key: 'siteName',       label: 'Site Name'       },
                { key: 'submissionDate', label: 'Submission Date' },
                { key: 'status',         label: 'Status'          },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className={styles.th}
                  onClick={() => handleSort(key)}
                >
                  <span className={styles.thInner}>
                    {label}
                    <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
              <th className={styles.thActions}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className={styles.row}>
                {Array.from({ length: 8 }, (__, j) => (
                  <td key={j} className={styles.td}>
                    <div className={styles.skeleton} style={{ width: j === 1 ? '70%' : '55%' }} />
                  </td>
                ))}
              </tr>
            ))}

            {!loading && pageData.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  <div className={styles.empty}>
                    <FileCheck size={38} strokeWidth={1.25} className={styles.emptyIcon} />
                    <p className={styles.emptyTitle}>
                      {submissions.length === 0 ? 'No consent submissions yet.' : 'No submissions match your filters.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && pageData.map((s) => {
              const meta = STATUS_META[s.status] ?? STATUS_META.Pending;
              const isPending = s.status === 'Pending';
              return (
                <tr key={s.id} className={`${styles.row} ${selected.has(s.id) ? styles.rowSelected : ''}`}>
                  <td className={styles.tdCheck}>
                    {isPending && (
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleRow(s.id)}
                      />
                    )}
                  </td>
                  <td className={styles.td}>
                    <div className={styles.userName}>{s.userName}</div>
                    <div className={styles.userEmail}>{s.userEmail}</div>
                  </td>
                  <td className={styles.td}><span className={styles.rolePill}>{s.role}</span></td>
                  <td className={styles.td}><span className={styles.siteCode}>{s.siteCode || '—'}</span></td>
                  <td className={styles.td}>{s.siteName || '—'}</td>
                  <td className={styles.td}>{fmtDate(s.submissionDate)}</td>
                  <td className={styles.td}>
                    <span
                      className={styles.statusBadge}
                      style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}40` }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className={styles.tdActions}>
                    {/* View Details */}
                    <button
                      className={styles.actionBtn}
                      title="View Details"
                      onClick={() => setDetailsTarget(s)}
                    >
                      <Eye size={13} />
                    </button>

                    {/* Approve — only pending, gated by consent_review.approve */}
                    {isPending && canApprove && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionApprove}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Approve'}
                        onClick={() => setApproveTarget(s)}
                        {...ro.disabledProps('Approve consent')}
                      >
                        <CheckCircle size={13} />
                      </button>
                    )}

                    {/* Reject — only pending, gated by consent_review.reject */}
                    {isPending && canReject && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionReject}`}
                        title={ro.isReadOnly ? ro.readOnlyMessage : 'Reject'}
                        onClick={() => setRejectTarget(s)}
                        {...ro.disabledProps('Reject consent')}
                      >
                        <XCircle size={13} />
                      </button>
                    )}

                    {/* Download */}
                    <button
                      className={styles.actionBtn}
                      title="Download PDF"
                      onClick={() => handleDownload(s)}
                      disabled={downloading === s.id}
                    >
                      <Download size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > pageSize && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className={styles.pageButtons}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span key={`ellipsis-${p}`} className={styles.pageEllipsis}>…</span>
                  )}
                  <button
                    key={p}
                    className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </>
              ))
            }
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              ›
            </button>
          </div>
          <select
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {detailsTarget && (
        <ConsentDetailsModal
          studyId={studyId}
          submission={detailsTarget}
          onClose={() => setDetailsTarget(null)}
        />
      )}

      {approveTarget && (
        <ApproveModal
          submission={approveTarget === 'bulk' ? null : approveTarget}
          bulk={approveTarget === 'bulk' ? selectedCount : null}
          onConfirm={handleApproveConfirm}
          onClose={() => setApproveTarget(null)}
        />
      )}

      {rejectTarget && (
        <RejectModal
          submission={rejectTarget === 'bulk' ? null : rejectTarget}
          bulk={rejectTarget === 'bulk' ? selectedCount : null}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
