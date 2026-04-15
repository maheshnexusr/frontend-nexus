import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Pencil, Copy, Eye, Trash2, Plus, ToggleLeft, ToggleRight,
  X, ChevronDown, Mail,
} from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import DataTable from '@/components/data-table/DataTable';
import { addToast } from '@/app/notificationSlice';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { emailTemplateService } from '@/services/emailTemplateService';
import styles from './MasterEmailTemplatesPage.module.css';

/* ── Constants ───────────────────────────────────────────────────────────── */

const CATEGORIES = [
  'Site Personnel Invitation',
  'Site Personnel Removal',
  'Site Personnel Status Change (Active/Inactive)',
  'Adverse Event Trigger',
  'Study Close Out',
  'Study Lock Out',
  'Data Entry Reminder',
  'Query Raised',
  'Query Resolved',
  'Consent Request',
  'Consent Approved',
  'Enrollment Target Reached',
  'Site Activation',
  'Site Deactivation',
  'Custom',
];

const PLACEHOLDERS = [
  '{StudyName}', '{StudyID}', '{SiteName}', '{SiteCode}', '{PersonName}',
  '{PersonEmail}', '{PersonRole}', '{InvitationLink}', '{LoginLink}',
  '{AdverseEventID}', '{AdverseEventDescription}', '{Severity}',
  '{QueryID}', '{QueryField}', '{QueryDescription}',
  '{EnrollmentCount}', '{EnrollmentTarget}', '{CloseOutDate}',
  '{LockOutDate}', '{SupportEmail}', '{CurrentDate}', '{CurrentTime}',
];

const SAMPLE_VALUES = {
  '{StudyName}':               'CardioSafe Phase II',
  '{StudyID}':                 'TRIAL-001',
  '{SiteName}':                'General Hospital',
  '{SiteCode}':                'GH-01',
  '{PersonName}':              'John Doe',
  '{PersonEmail}':             'john.doe@example.com',
  '{PersonRole}':              'Principal Investigator',
  '{InvitationLink}':          'https://app.example.com/invite/abc123',
  '{LoginLink}':               'https://app.example.com/login',
  '{AdverseEventID}':          'AE-2026-042',
  '{AdverseEventDescription}': 'Mild headache reported after dose 2.',
  '{Severity}':                'Mild',
  '{QueryID}':                 'QRY-0099',
  '{QueryField}':              'Date of Birth',
  '{QueryDescription}':        'Value entered does not match source document.',
  '{EnrollmentCount}':         '120',
  '{EnrollmentTarget}':        '120',
  '{CloseOutDate}':            '2026-12-31',
  '{LockOutDate}':             '2026-11-30',
  '{SupportEmail}':            'support@sclin.com',
  '{CurrentDate}':             new Date().toLocaleDateString(),
  '{CurrentTime}':             new Date().toLocaleTimeString(),
};

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet', 'link',
];

function resolveSampleValues(text) {
  if (!text) return '';
  let resolved = text;
  Object.entries(SAMPLE_VALUES).forEach(([key, val]) => {
    resolved = resolved.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
  });
  return resolved;
}

/* ── Category badge helper ───────────────────────────────────────────────── */

function getCatClass(category) {
  if (!category) return styles.catCustom;
  const c = category.toLowerCase();
  if (c.includes('site personnel')) {
    if (c.includes('invitation'))       return styles.catSitePersonnel;
    if (c.includes('removal'))          return styles.catRemoval;
    if (c.includes('status'))           return styles.catSitePersonnel;
    return styles.catSitePersonnel;
  }
  if (c.includes('adverse'))            return styles.catAdverse;
  if (c.includes('close out') || c.includes('lock out')) return styles.catStudy;
  if (c.includes('site activation') || c.includes('site deactivation')) return styles.catSite;
  if (c.includes('query'))              return styles.catQuery;
  if (c.includes('consent'))            return styles.catConsent;
  if (c.includes('data entry') || c.includes('enrollment')) return styles.catData;
  return styles.catCustom;
}

/* ── StatusBadge ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  return (
    <span className={`${styles.statusBadge} ${status === 'Active' ? styles.statusActive : styles.statusInactive}`}>
      {status}
    </span>
  );
}

/* ── CategoryBadge ───────────────────────────────────────────────────────── */

function CategoryBadge({ category }) {
  return (
    <span className={`${styles.catBadge} ${getCatClass(category)}`}>
      {category}
    </span>
  );
}

/* ── TemplateFormModal ───────────────────────────────────────────────────── */

const EMPTY_FORM = {
  name: '', code: '', category: '', subject: '', body: '', description: '', status: 'Active',
};

function TemplateFormModal({ mode, template, onClose, onSave, saving }) {
  const [form, setForm]   = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [lastFocused, setLastFocused] = useState('subject');
  const [copiedPlaceholder, setCopiedPlaceholder] = useState(null);
  const [insertDropdownOpen, setInsertDropdownOpen] = useState(null); // 'subject' | 'body' | null
  const subjectRef   = useRef(null);
  const quillRef     = useRef(null);
  const dropdownRef  = useRef(null);

  useEffect(() => {
    if (mode === 'edit' && template) {
      setForm({
        name:        template.name        ?? '',
        code:        template.code        ?? '',
        category:    template.category    ?? '',
        subject:     template.subject     ?? '',
        body:        template.body        ?? '',
        description: template.description ?? '',
        status:      template.status      ?? 'Active',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [mode, template]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setInsertDropdownOpen(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleCodeChange(e) {
    handleChange('code', e.target.value.toUpperCase());
  }

  function validate() {
    const errs = {};
    if (!form.name.trim())    errs.name     = 'Template Name is required.';
    if (!form.code.trim())    errs.code     = 'Template Code is required.';
    if (!form.category)       errs.category = 'Email Category is required.';
    if (!form.subject.trim()) errs.subject  = 'Subject Line is required.';
    const stripped = form.body.replace(/<[^>]*>/g, '').trim();
    if (!stripped)            errs.body     = 'Email Body is required.';
    return errs;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave(form);
  }

  function insertPlaceholder(placeholder, target) {
    if (target === 'subject') {
      const el = subjectRef.current;
      if (!el) return;
      const start = el.selectionStart ?? form.subject.length;
      const end   = el.selectionEnd   ?? form.subject.length;
      const next  = form.subject.slice(0, start) + placeholder + form.subject.slice(end);
      handleChange('subject', next);
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    } else {
      const editor = quillRef.current?.getEditor?.();
      if (!editor) return;
      const range = editor.getSelection(true);
      const index = range ? range.index : editor.getLength();
      editor.insertText(index, placeholder, 'user');
      editor.setSelection(index + placeholder.length);
    }
    setInsertDropdownOpen(null);
  }

  function handleChipCopy(placeholder) {
    navigator.clipboard.writeText(placeholder).catch(() => {});
    setCopiedPlaceholder(placeholder);
    setTimeout(() => setCopiedPlaceholder(null), 1500);
  }

  const title = mode === 'edit' ? 'Edit Email Template' : 'New Email Template';

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 860 }} role="dialog" aria-modal="true" aria-label={title}>
        {/* Header */}
        <div className={styles.mHead}>
          <h2 className={styles.mTitle}>{title}</h2>
          <button className={styles.mClose} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className={`${styles.mBody} ${styles.formLayout}`}>
          {/* Left: form fields */}
          <div className={styles.formPanel}>
            {/* Row 1: Name + Code */}
            <div className={styles.fieldRow2}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Template Name <span className={styles.req}>*</span></label>
                <input
                  className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Site Invite"
                />
                {errors.name && <span className={styles.errMsg}>{errors.name}</span>}
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Template Code <span className={styles.req}>*</span></label>
                <input
                  className={`${styles.input} ${errors.code ? styles.inputError : ''}`}
                  value={form.code}
                  onChange={handleCodeChange}
                  placeholder="e.g. SITE_INVITE"
                />
                {errors.code && <span className={styles.errMsg}>{errors.code}</span>}
              </div>
            </div>

            {/* Row 2: Category */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email Category <span className={styles.req}>*</span></label>
              <select
                className={`${styles.select} ${errors.category ? styles.inputError : ''}`}
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && <span className={styles.errMsg}>{errors.category}</span>}
            </div>

            {/* Row 3: Subject + insert placeholder */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Subject Line <span className={styles.req}>*</span></label>
              <div className={styles.subjectRow} ref={lastFocused === 'subject' ? dropdownRef : null}>
                <input
                  ref={subjectRef}
                  className={`${styles.input} ${errors.subject ? styles.inputError : ''}`}
                  value={form.subject}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  onFocus={() => setLastFocused('subject')}
                  placeholder="e.g. You are invited to {StudyName}"
                  style={{ flex: 1 }}
                />
                <div className={styles.insertBtnWrap} ref={lastFocused === 'subject' ? dropdownRef : undefined}>
                  <button
                    type="button"
                    className={styles.insertBtn}
                    onClick={() => setInsertDropdownOpen(insertDropdownOpen === 'subject' ? null : 'subject')}
                  >
                    Insert <ChevronDown size={13} />
                  </button>
                  {insertDropdownOpen === 'subject' && (
                    <div className={styles.insertDropdown}>
                      {PLACEHOLDERS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={styles.insertDropdownItem}
                          onClick={() => insertPlaceholder(p, 'subject')}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {errors.subject && <span className={styles.errMsg}>{errors.subject}</span>}
            </div>

            {/* Row 4: Body */}
            <div className={styles.fieldGroup}>
              <div className={styles.bodyLabelRow}>
                <label className={styles.label}>Email Body <span className={styles.req}>*</span></label>
                <div className={styles.insertBtnWrap} ref={lastFocused === 'body' ? dropdownRef : undefined}>
                  <button
                    type="button"
                    className={styles.insertBtn}
                    onClick={() => setInsertDropdownOpen(insertDropdownOpen === 'body' ? null : 'body')}
                  >
                    Insert Placeholder <ChevronDown size={13} />
                  </button>
                  {insertDropdownOpen === 'body' && (
                    <div className={styles.insertDropdown}>
                      {PLACEHOLDERS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={styles.insertDropdownItem}
                          onClick={() => insertPlaceholder(p, 'body')}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={`${styles.quillWrap} ${errors.body ? styles.inputError : ''}`}>
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={form.body}
                  onChange={(val) => handleChange('body', val)}
                  onFocus={() => setLastFocused('body')}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                  placeholder="Compose your email body…"
                />
              </div>
              {errors.body && <span className={styles.errMsg}>{errors.body}</span>}
            </div>

            {/* Row 5: Description */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of when this template is used…"
              />
            </div>

            {/* Row 6: Status */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Status</label>
              <select
                className={styles.select}
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Right: placeholder reference */}
          <div className={styles.placeholderPanel}>
            <div className={styles.placeholderPanelTitle}>Available Placeholders</div>
            <p className={styles.placeholderPanelSub}>Click to copy to clipboard</p>
            <div className={styles.placeholderGrid}>
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.placeholderChip} ${copiedPlaceholder === p ? styles.placeholderCopied : ''}`}
                  onClick={() => handleChipCopy(p)}
                  title={`Click to copy ${p}`}
                >
                  {copiedPlaceholder === p ? 'Copied!' : p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.mFoot}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? <span className={styles.spinner} style={{ display: 'inline-block', width: 16, height: 16 }} /> : null}
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── PreviewModal ────────────────────────────────────────────────────────── */

function PreviewModal({ template, onClose, onTestSend, testSending }) {
  const resolvedSubject = resolveSampleValues(template.subject);
  const resolvedBody    = resolveSampleValues(template.body);

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 680 }} role="dialog" aria-modal="true">
        <div className={styles.mHead}>
          <h2 className={styles.mTitle}>Preview: {template.name}</h2>
          <button className={styles.mClose} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.previewSubject}>
            <span className={styles.previewSubjectLabel}>Subject:</span>
            <span>{resolvedSubject}</span>
          </div>
          <div className={styles.previewBodyWrap}>
            <div
              className={styles.previewBody}
              dangerouslySetInnerHTML={{ __html: resolvedBody }}
            />
          </div>
          <p className={styles.previewNote}>
            Sample values are substituted for illustration. Actual values are populated at send time.
          </p>
        </div>
        <div className={styles.mFoot}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
          <button className={styles.saveBtn} onClick={onTestSend} disabled={testSending}>
            {testSending
              ? <><span className={`${styles.spinner}`} style={{ display: 'inline-block', width: 14, height: 14, marginRight: 6 }} />Sending…</>
              : <><Mail size={14} style={{ marginRight: 6 }} />Test Send</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── DeleteConfirmModal ──────────────────────────────────────────────────── */

function DeleteConfirmModal({ template, onClose, onConfirm, deleting }) {
  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 440 }} role="dialog" aria-modal="true">
        <div className={styles.mHead}>
          <h2 className={styles.mTitle}>Delete Template</h2>
          <button className={styles.mClose} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className={styles.mBody}>
          <p className={styles.deleteMsg}>
            Are you sure you want to delete <strong>{template.name}</strong>? This action cannot be undone.
          </p>
        </div>
        <div className={`${styles.mFoot} ${styles.deleteActions}`}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={deleting}>Cancel</button>
          <button className={styles.deleteBtn} onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function MasterEmailTemplatesPage() {
  const dispatch    = useDispatch();
  const currentUser = useSelector(selectCurrentUser);

  // Table state
  const [data,      setData]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [page,      setPage]      = useState(1);
  const [pageSize,  setPageSize]  = useState(20);
  const [sortKey,   setSortKey]   = useState('createdAt');
  const [sortDir,   setSortDir]   = useState('desc');
  const [search,    setSearch]    = useState('');

  // Filters
  const [catFilter,  setCatFilter]  = useState('');
  const [statFilter, setStatFilter] = useState('');

  // Modal state
  const [modalMode,       setModalMode]       = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [saving,          setSaving]          = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [testSending,     setTestSending]     = useState(false);

  /* ── Load data ─────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await emailTemplateService.list({
        search,
        category: catFilter,
        status:   statFilter,
        page,
        pageSize,
        sortBy:  sortKey,
        sortDir,
      });
      setData(res.items ?? []);
      setTotal(res.totalCount ?? 0);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to load email templates.' }));
    } finally {
      setLoading(false);
    }
  }, [search, catFilter, statFilter, page, pageSize, sortKey, sortDir, dispatch]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Handlers ──────────────────────────────────────────────────────────── */
  function handleSort(key, dir) {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  }

  function handleSearch(val) {
    setSearch(val);
    setPage(1);
  }

  function handleClearFilters() {
    setCatFilter('');
    setStatFilter('');
    setPage(1);
  }

  const filtersActive = catFilter || statFilter;

  /* ── Create / Edit ────────────────────────────────────────────────────── */
  function openCreate() {
    setEditingTemplate(null);
    setModalMode('create');
  }

  function openEdit(tpl) {
    setEditingTemplate(tpl);
    setModalMode('edit');
  }

  async function handleSave(formData) {
    setSaving(true);
    try {
      if (modalMode === 'create') {
        await emailTemplateService.create(formData);
        dispatch(addToast({ type: 'success', message: 'Email template created successfully.' }));
      } else {
        await emailTemplateService.update(editingTemplate.id, formData);
        dispatch(addToast({ type: 'success', message: 'Email template updated successfully.' }));
      }
      setModalMode(null);
      setEditingTemplate(null);
      setPage(1);
      loadData();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to save template.' }));
    } finally {
      setSaving(false);
    }
  }

  /* ── Duplicate ────────────────────────────────────────────────────────── */
  async function handleDuplicate(tpl) {
    try {
      await emailTemplateService.duplicate(tpl.id);
      dispatch(addToast({ type: 'success', message: `"${tpl.name}" duplicated successfully.` }));
      setPage(1);
      loadData();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to duplicate template.' }));
    }
  }

  /* ── Delete ───────────────────────────────────────────────────────────── */
  function openDelete(tpl) { setDeleteTarget(tpl); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await emailTemplateService.delete(deleteTarget.id);
      dispatch(addToast({ type: 'success', message: `"${deleteTarget.name}" deleted.` }));
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to delete template.' }));
    } finally {
      setDeleting(false);
    }
  }

  /* ── Toggle status ────────────────────────────────────────────────────── */
  async function handleToggleStatus(tpl) {
    const newStatus = tpl.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await emailTemplateService.update(tpl.id, { status: newStatus });
      dispatch(addToast({ type: 'success', message: `"${tpl.name}" set to ${newStatus}.` }));
      loadData();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to update status.' }));
    }
  }

  /* ── Test send ────────────────────────────────────────────────────────── */
  async function handleTestSend() {
    if (!previewTemplate) return;
    const email = currentUser?.email ?? 'test@example.com';
    setTestSending(true);
    try {
      await emailTemplateService.testSend(previewTemplate.id, email);
      dispatch(addToast({ type: 'success', message: `Test email sent to ${email}.` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.message ?? 'Failed to send test email.' }));
    } finally {
      setTestSending(false);
    }
  }

  /* ── Columns ──────────────────────────────────────────────────────────── */
  const columns = [
    {
      key:      'name',
      label:    'Name',
      sortable: true,
      width:    220,
      render:   (_, row) => (
        <div className={styles.nameCellWrap}>
          <span className={styles.nameText}>{row.name}</span>
          {row.isDefault && <span className={styles.defaultBadge}>Default</span>}
        </div>
      ),
    },
    {
      key:    'code',
      label:  'Code',
      width:  140,
      render: (v) => <span className={styles.codeChip}>{v}</span>,
    },
    {
      key:    'category',
      label:  'Category',
      width:  220,
      render: (v) => <CategoryBadge category={v} />,
    },
    {
      key:    'subject',
      label:  'Subject',
      render: (v) => <span className={styles.subjectCell}>{v}</span>,
    },
    {
      key:    'status',
      label:  'Status',
      width:  100,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key:    'actions',
      label:  '',
      width:  180,
      render: (_, row) => (
        <div className={styles.actionCell}>
          <button
            className={styles.iconBtn}
            title="Edit"
            onClick={() => openEdit(row)}
          >
            <Pencil size={15} />
          </button>
          <button
            className={styles.iconBtn}
            title="Duplicate"
            onClick={() => handleDuplicate(row)}
          >
            <Copy size={15} />
          </button>
          <button
            className={styles.iconBtn}
            title="Preview"
            onClick={() => setPreviewTemplate(row)}
          >
            <Eye size={15} />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            title="Delete"
            onClick={() => openDelete(row)}
          >
            <Trash2 size={15} />
          </button>
          <button
            className={`${styles.iconBtn} ${styles.toggleBtn}`}
            title={row.status === 'Active' ? 'Deactivate' : 'Activate'}
            onClick={() => handleToggleStatus(row)}
          >
            {row.status === 'Active'
              ? <ToggleRight size={18} style={{ color: 'var(--color-success)' }} />
              : <ToggleLeft  size={18} style={{ color: 'var(--text-muted)' }} />
            }
          </button>
        </div>
      ),
    },
  ];

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Email Templates</h1>
          <p className={styles.sub}>Manage system and custom email templates for study communications.</p>
        </div>
        <button className={styles.newBtn} onClick={openCreate}>
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Filter row */}
      <div className={styles.filterRow}>
        <select
          className={styles.fselect}
          value={catFilter}
          onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className={styles.fselect}
          value={statFilter}
          onChange={(e) => { setStatFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        {filtersActive && (
          <button className={styles.clearBtn} onClick={handleClearFilters}>
            <X size={13} /> Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        onSort={handleSort}
        onSearch={handleSearch}
        searchPlaceholder="Search by name, code, or category…"
        emptyStateMessage="No email templates found."
      />

      {/* Modals */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <TemplateFormModal
          mode={modalMode}
          template={editingTemplate}
          onClose={() => { setModalMode(null); setEditingTemplate(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onTestSend={handleTestSend}
          testSending={testSending}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          template={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}
