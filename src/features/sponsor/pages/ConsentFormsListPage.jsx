/**
 * ConsentFormsListPage — the Consent Builder landing page (sponsor workspace).
 *
 * Lists every consent form for the study (Consent Code · Title · Assigned Roles ·
 * Status · Actions) with search + Create. "Create Consent" / Edit open the
 * drag-and-drop ConsentFormBuilder; Delete removes the form. Mirrors the Site
 * Role list look (reuses RolesPage.module.css).
 *
 * Mounted at /sponsor/:studyId/consent/config (and /site/.../consent/config).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Plus, Search, X, RefreshCw, Pencil, Trash2, AlertTriangle, LayoutTemplate, Copy } from 'lucide-react';

import { addToast }                  from '@/app/notificationSlice';
import { sponsorConsentFormsClient } from '../api/sponsorConsentFormsClient';
import { sponsorRolesClient }        from '../api/sponsorRolesClient';
import SearchableDropdown            from '@/components/form/SearchableDropdown';
import ConfirmDialog                 from '@/components/feedback/ConfirmDialog';
import { useReadOnlyView }           from '@/features/workspace/hooks/useReadOnlyView';
import { usePermissions }            from '@/features/auth/usePermissions';
import css from './RolesPage.module.css';

const STATUS_OPTIONS = ['All', 'Draft', 'Published'];

const statusStyle = (status) =>
  status === 'Published'
    ? { color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }
    : status === 'Rejected'
      ? { color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }
      : { color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' };

export default function ConsentFormsListPage() {
  const { studyId } = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();
  const dispatch    = useDispatch();
  // Stay within the current workspace (sponsor OR site) — derive the consent base
  // from the live URL instead of hardcoding /sponsor.
  const consentBase = location.pathname.replace(/\/consent\/config.*$/, '/consent/config');
  const ro          = useReadOnlyView();
  const { has }     = usePermissions();
  const canCreate   = has('consent_builder', 'create');
  const canEdit     = has('consent_builder', 'edit');
  const canDelete   = has('consent_builder', 'delete');
  // Spec: Create OR Edit permission may duplicate a consent.
  const canDuplicate = canCreate || canEdit;

  const [forms,      setForms]      = useState([]);
  const [roleNames,  setRoleNames]  = useState({}); // roleId → roleName
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search,       setSearch]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Duplicate (copy) consent flow.
  const [dupTarget, setDupTarget] = useState(null);  // the source form being copied
  const [dupTitle,  setDupTitle]  = useState('');
  const [dupRoles,  setDupRoles]  = useState([]);
  const [dupSaving, setDupSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [list, roles] = await Promise.all([
        sponsorConsentFormsClient.list(),
        sponsorRolesClient.lookup(studyId).catch(() => []),
      ]);
      setForms(list);
      setRoleNames(Object.fromEntries(roles.map((r) => [r.id, r.roleName])));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.message ?? 'Failed to load consent forms.' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studyId, dispatch]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = forms;
    if (statusFilter !== 'All') list = list.filter((f) => (f.status ?? 'Draft') === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (f) => f.consentCode.toLowerCase().includes(q) || f.title.toLowerCase().includes(q),
      );
    }
    return list;
  }, [forms, statusFilter, search]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await sponsorConsentFormsClient.remove(deleteTarget.templateId);
      setForms((prev) => prev.filter((f) => f.templateId !== deleteTarget.templateId));
      dispatch(addToast({ type: 'success', message: `Consent "${deleteTarget.title}" deleted.` }));
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message ?? e?.message ?? 'Failed to delete consent form.' }));
    } finally {
      setDeleteTarget(null);
    }
  }

  function openDuplicate(form) {
    setDupTarget(form);
    setDupTitle(`${form.title || 'Consent'} - Copy`);
    setDupRoles(Array.isArray(form.assignedRoleIds) ? form.assignedRoleIds : []);
  }

  async function handleDuplicate() {
    if (!dupTarget) return;
    if (!dupTitle.trim()) {
      dispatch(addToast({ type: 'error', message: 'A title for the copy is required.' }));
      return;
    }
    if (!dupRoles.length) {
      dispatch(addToast({ type: 'error', message: 'Select at least one role for the copy.' }));
      return;
    }
    setDupSaving(true);
    try {
      const { templateId: newId } = await sponsorConsentFormsClient.duplicate(dupTarget.templateId, {
        title: dupTitle.trim(),
        assignedRoleIds: dupRoles,
      });
      dispatch(addToast({ type: 'success', message: 'Consent duplicated successfully.' }));
      setDupTarget(null);
      // Redirect to the builder for the newly created Draft consent (spec).
      navigate(`${consentBase}/${newId}/design`);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e?.response?.data?.message ?? e?.message ?? 'Failed to duplicate consent form.' }));
      setDupSaving(false);
    }
  }

  const dupRoleOpts = Object.entries(roleNames).map(([id, name]) => ({ value: id, label: name }));

  return (
    <div className={css.page}>
      {/* Header */}
      <div className={css.header}>
        <div>
          <h1 className={css.title}>Consent Forms</h1>
          <p  className={css.sub}>Build and manage the consent forms site personnel review, acknowledge, or sign.</p>
        </div>
        <div className={css.headerActions}>
          <button className={css.btnRefresh} onClick={() => load(true)} disabled={refreshing} title="Refresh">
            <RefreshCw size={15} style={refreshing ? { animation: 'spin .7s linear infinite' } : {}} />
          </button>
          {canCreate && (
            <button
              className={css.btnPrimary}
              onClick={() => navigate(`${consentBase}/new`)}
              {...ro.disabledProps('Create Consent')}
            >
              <Plus size={15} /> Create Consent
            </button>
          )}
        </div>
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
            placeholder="Search code or title…"
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

      <p className={css.count}>
        {loading ? 'Loading…' : `${filtered.length} consent form${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* Table */}
      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th className={css.thPlain}><span className={css.thInner}>Consent Code</span></th>
              <th className={css.thPlain}><span className={css.thInner}>Title</span></th>
              <th className={css.thPlain}><span className={css.thInner}>Assigned Roles</span></th>
              <th className={css.thPlain}><span className={css.thInner}>Status</span></th>
              <th className={css.thActions}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className={css.row}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <td key={j} className={css.td}><div className={css.skeleton} style={{ width: 80 }} /></td>
                  ))}
                  <td className={css.tdActions} />
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={css.emptyCell}>
                  <div className={css.empty}>
                    <AlertTriangle size={28} className={css.emptyIcon} />
                    <p className={css.emptyTitle}>No consent forms yet</p>
                    <p className={css.emptySub}>Create a consent form or adjust the search.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((f) => {
                const roleChips = (f.assignedRoleIds ?? [])
                  .map((id) => roleNames[id])
                  .filter(Boolean);
                return (
                  <tr key={f.templateId} className={css.row}>
                    <td className={css.td}><span className={css.roleName}>{f.consentCode || '—'}</span></td>
                    <td className={css.td}>{f.title || <em style={{ color: '#94a3b8' }}>Untitled</em>}</td>
                    <td className={css.td}>
                      {roleChips.length === 0 ? (
                        <span style={{ fontSize: 12, color: '#64748b' }}>All roles</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {roleChips.map((name) => (
                            <span
                              key={name}
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                                background: '#eef2ff', color: '#4338ca', border: '1px solid #e0e7ff',
                              }}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={css.td}>
                      <span className={css.statusBadge} style={statusStyle(f.status)}>{f.status}</span>
                    </td>
                    <td className={css.tdActions}>
                      {canEdit && (
                        <button
                          className={css.actionBtn}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Design form'}
                          disabled={ro.isReadOnly}
                          aria-disabled={ro.isReadOnly}
                          onClick={() => !ro.isReadOnly && navigate(`${consentBase}/${f.templateId}/design`)}
                        >
                          <LayoutTemplate size={13} />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          className={css.actionBtn}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Edit details'}
                          disabled={ro.isReadOnly}
                          aria-disabled={ro.isReadOnly}
                          onClick={() => !ro.isReadOnly && navigate(`${consentBase}/${f.templateId}/edit`)}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {canDuplicate && (
                        <button
                          className={css.actionBtn}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Duplicate'}
                          disabled={ro.isReadOnly}
                          aria-disabled={ro.isReadOnly}
                          onClick={() => !ro.isReadOnly && openDuplicate(f)}
                        >
                          <Copy size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className={`${css.actionBtn} ${css.actionDelete}`}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
                          disabled={ro.isReadOnly}
                          aria-disabled={ro.isReadOnly}
                          onClick={() => !ro.isReadOnly && setDeleteTarget(f)}
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

      {dupTarget && (
        <div
          onClick={() => !dupSaving && setDupTarget(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(480px, 100%)', background: '#fff', borderRadius: 12,
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 24,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Duplicate Consent</h2>
            <p style={{ margin: '6px 0 18px', fontSize: 13, color: '#64748b' }}>
              Source: <strong style={{ color: '#334155' }}>{dupTarget.title || dupTarget.consentCode}</strong>
            </p>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              New Consent Title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              autoFocus
              value={dupTitle}
              onChange={(e) => setDupTitle(e.target.value)}
              placeholder="e.g. Main Study Informed Consent - Copy"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
                border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 14, outline: 'none',
              }}
            />

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Consent Code
            </label>
            <input
              value="Auto Generated"
              disabled
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
                border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 14,
                background: '#f8fafc', color: '#94a3b8',
              }}
            />

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Assigned Roles <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ marginBottom: 18 }}>
              <SearchableDropdown
                multiple
                options={dupRoleOpts}
                value={dupRoles}
                onChange={setDupRoles}
                placeholder={dupRoleOpts.length === 0 ? 'No site roles' : 'Select roles…'}
                searchPlaceholder="Search roles…"
              />
            </div>

            <p style={{ margin: '0 0 18px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              The full design — pages, fields, conditional logic, validation, signatures and settings —
              is copied into a new <strong>Draft</strong> consent. Collected submissions, approvals and
              history are not copied.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDupTarget(null)}
                disabled={dupSaving}
                style={{
                  padding: '9px 16px', fontSize: 14, fontWeight: 500, borderRadius: 8,
                  border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={dupSaving}
                style={{
                  padding: '9px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8,
                  border: 'none', background: '#2563eb', color: '#fff',
                  cursor: dupSaving ? 'default' : 'pointer', opacity: dupSaving ? 0.7 : 1,
                }}
              >
                {dupSaving ? 'Creating…' : 'Create Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Consent Form"
          message={`Delete consent form "${deleteTarget.title || deleteTarget.consentCode}"? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
        />
      )}
    </div>
  );
}
