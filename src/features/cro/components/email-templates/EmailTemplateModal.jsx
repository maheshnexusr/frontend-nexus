/**
 * EmailTemplateModal — slide-over drawer for creating and editing email templates.
 *
 * Layout:
 *   Left  (65%): scrollable form sections
 *   Right (35%): available placeholders panel
 *
 * Rich text editor: react-quill (already installed)
 * Placeholder insertion: tracks active field (subject / body) and inserts at cursor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { X, ClipboardCopy, Check } from 'lucide-react';
import { emailTemplatesClient }  from '@/features/cro/api/emailTemplatesClient';
import FormField                 from '@/components/form/FormField';
import TextArea                  from '@/components/form/TextArea';
import SearchableDropdown        from '@/components/form/SearchableDropdown';
import styles from './EmailTemplateModal.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  /* ── 3.1 Team Member Management ──────────────────────────────────────── */
  'CRO Team Member Welcome Email',
  'Team Member Role Assignment',
  'Team Member Study Assignment',
  'CRO Team Member Account Activation',
  'Team Member Account Deactivation',
  'Team Member Password Reset',
  'Team Member Login (New Device)',

  /* ── 3.2 Study Management ─────────────────────────────────────────────── */
  'Study Published to UAT',
  'Study Published to LIVE',
  'Study Status Change Notification',
  'Study Closed Out',
  'Study Locked',

  /* ── 3.3 Sponsor Management ───────────────────────────────────────────── */
  'Sponsor Invitation Email',
  'Study Assignment Notification',
  'Sponsor Account Created',
  'Sponsor Account Activated',
  'Sponsor Account Deactivated',

  /* ── 3.4 Password & Security ──────────────────────────────────────────── */
  'Password Reset Request',
  'Password Changed Confirmation',
  'New Login Detection',
  'Account Locked Notification',

  /* ── Other ────────────────────────────────────────────────────────────── */
  'System Alert',
  'Reminder',
  'Custom',
].map((c) => ({ value: c, label: c }));

const TEMPLATE_TYPE_OPTIONS = [
  'Transactional', 'Promotional', 'Notification',
].map((t) => ({ value: t, label: t }));

const STATUS_OPTIONS = [
  { value: 'Active',   label: 'Active'   },
  { value: 'Inactive', label: 'Inactive' },
];

const PLACEHOLDERS = [
  /* Person */
  { key: '{FullName}',          desc: "Recipient's full name"              },
  { key: '{Email}',             desc: "Recipient's email address"          },
  { key: '{RoleName}',          desc: "Recipient's assigned role"          },
  { key: '{OldRole}',           desc: 'Previous role (before reassignment)'},
  { key: '{NewRole}',           desc: 'New role (after reassignment)'      },
  /* Account / Auth */
  { key: '{ActivationLink}',    desc: 'Account activation URL'             },
  { key: '{PasswordResetLink}', desc: 'Password reset URL'                 },
  { key: '{LoginLink}',         desc: 'Platform login URL'                 },
  { key: '{OTP}',               desc: 'One-time password / verification code' },
  { key: '{DeviceInfo}',        desc: 'Browser / device of new login'      },
  { key: '{DeviceLocation}',    desc: 'Geographic location of new login'   },
  { key: '{LoginTime}',         desc: 'Timestamp of the login event'       },
  { key: '{ExpiryDate}',        desc: 'Link / token expiry date'           },
  { key: '{AccountLockedReason}', desc: 'Reason the account was locked'    },
  { key: '{UnlockLink}',        desc: 'Account self-unlock or support URL'  },
  /* Study */
  { key: '{StudyName}',         desc: 'Name of the study'                  },
  { key: '{StudyID}',           desc: 'Study identifier'                   },
  { key: '{StudyPhase}',        desc: 'Study phase (e.g. Phase II)'        },
  { key: '{StudyEnvironment}',  desc: 'Environment (UAT / LIVE)'           },
  { key: '{OldStatus}',         desc: 'Previous study/record status'       },
  { key: '{NewStatus}',         desc: 'New study/record status'            },
  { key: '{PublishedDate}',     desc: 'Date the study was published'       },
  /* Organisation */
  { key: '{SponsorName}',       desc: 'Name of the sponsor organisation'   },
  { key: '{CROName}',           desc: 'CRO organisation name'              },
  { key: '{SiteName}',          desc: 'Name of the site'                   },
  /* System */
  { key: '{SystemName}',        desc: 'Platform name (SclinNexus)'         },
  { key: '{SupportEmail}',      desc: 'Support contact email'              },
  { key: '{Date}',              desc: 'Current date'                       },
  { key: '{Time}',              desc: 'Current time'                       },
];

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['link', 'image'],
    ['blockquote'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet', 'align',
  'link', 'image', 'blockquote',
];

const EMPTY_FORM = {
  templateName:  '',
  templateCode:  '',
  emailCategory: '',
  description:   '',
  status:        'Active',
  templateType:  '',
  subjectLine:   '',
  emailBody:     '',
  fromName:      '',
  fromEmail:     '',
  cc:            '',
  bcc:           '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailTemplateModal({ mode, template, onSave, onClose, onError }) {
  const isEdit = mode === 'edit';

  const [form,      setForm]    = useState(EMPTY_FORM);
  const [errors,    setErrors]  = useState({});
  const [saving,    setSaving]  = useState(false);
  const [copiedKey, setCopied]  = useState(null);
  const [activeField, setActive] = useState(null); // 'subject' | 'body'

  const subjectRef = useRef(null);
  const quillRef   = useRef(null);

  // Populate form when editing
  useEffect(() => {
    if (isEdit && template) {
      setForm({ ...EMPTY_FORM, ...template });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [isEdit, template]);

  // ── field helpers ──────────────────────────────────────────────────────────
  const set = useCallback((field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // Auto-generate template code from name (only on create)
  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      templateName: name,
      ...(isEdit ? {} : {
        templateCode: name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_|_$/g, ''),
      }),
    }));
    setErrors((prev) => ({ ...prev, templateName: undefined, templateCode: undefined }));
  };

  // ── placeholder insert ─────────────────────────────────────────────────────
  const insertPlaceholder = (key) => {
    if (activeField === 'subject' && subjectRef.current) {
      const el    = subjectRef.current;
      const start = el.selectionStart ?? form.subjectLine.length;
      const end   = el.selectionEnd   ?? start;
      const next  = form.subjectLine.slice(0, start) + key + form.subjectLine.slice(end);
      setForm((prev) => ({ ...prev, subjectLine: next }));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + key.length, start + key.length);
      }, 0);
    } else if (activeField === 'body' && quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection(true);
      const idx   = range ? range.index : quill.getLength() - 1;
      quill.insertText(idx, key, 'user');
      quill.setSelection(idx + key.length);
    } else {
      navigator.clipboard.writeText(key).catch(() => {});
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // ── validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.templateName.trim())  errs.templateName = 'Template Name is required.';
    if (!form.templateCode.trim())  errs.templateCode = 'Template Code is required.';
    if (!form.subjectLine.trim())   errs.subjectLine  = 'Subject Line is required.';
    const bodyText = form.emailBody.replace(/<[^>]*>/g, '').trim();
    if (!bodyText) errs.emailBody = 'Email Body is required.';
    return errs;
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const exists = await emailTemplatesClient.codeExists(
        form.templateCode,
        isEdit ? template.id : null,
      );
      if (exists) {
        setErrors((prev) => ({
          ...prev,
          templateCode: 'Template Code already exists. Please use a unique code.',
        }));
        setSaving(false);
        return;
      }

      const saved = isEdit
        ? await emailTemplatesClient.update(template.id, form)
        : await emailTemplatesClient.create(form);

      onSave(saved);
    } catch {
      onError(
        isEdit
          ? 'Failed to update email template. Please try again.'
          : 'Failed to create email template. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.drawerHeader}>
          <div>
            <h2 className={styles.drawerTitle}>
              {isEdit ? 'Edit Email Template' : 'Create Email Template'}
            </h2>
            <p className={styles.drawerSub}>
              {isEdit ? `Editing: ${template?.templateName}` : 'Fill in the details below.'}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body: form + placeholders */}
        <div className={styles.drawerBody}>

          {/* ── Left: form ─────────────────────────────────────────────────── */}
          <div className={styles.formCol}>

            {/* Section: Basic Info */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Basic Information</h3>

              <div className={styles.row2}>
                <FormField label="Template Name" name="templateName" required error={errors.templateName}>
                  <input
                    id="templateName"
                    className={inputCls(styles, errors.templateName)}
                    value={form.templateName}
                    onChange={handleNameChange}
                    placeholder="e.g. Welcome Email"
                  />
                </FormField>
                <FormField label="Template Code" name="templateCode" required error={errors.templateCode}>
                  <input
                    id="templateCode"
                    className={inputCls(styles, errors.templateCode)}
                    value={form.templateCode}
                    onChange={set('templateCode')}
                    placeholder="e.g. WELCOME_EMAIL"
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                  />
                </FormField>
              </div>

              <div className={styles.row2}>
                <FormField label="Email Category" name="emailCategory">
                  <SearchableDropdown
                    options={CATEGORY_OPTIONS}
                    value={form.emailCategory}
                    onChange={set('emailCategory')}
                    placeholder="— Select category —"
                  />
                </FormField>
                <FormField label="Status" name="status">
                  <SearchableDropdown
                    options={STATUS_OPTIONS}
                    value={form.status}
                    onChange={set('status')}
                    placeholder="— Select status —"
                  />
                </FormField>
              </div>

              <div className={styles.row2}>
                <FormField label="Template Type" name="templateType">
                  <SearchableDropdown
                    options={TEMPLATE_TYPE_OPTIONS}
                    value={form.templateType}
                    onChange={set('templateType')}
                    placeholder="— Select type —"
                  />
                </FormField>
              </div>

              <FormField label="Description" name="description">
                <TextArea
                  name="description"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Describe the purpose of this template…"
                />
              </FormField>
            </section>

            {/* Section: Email Configuration */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Email Configuration</h3>

              <div className={styles.row2}>
                <FormField label="From Name" name="fromName">
                  <input
                    id="fromName"
                    className={styles.input}
                    value={form.fromName}
                    onChange={set('fromName')}
                    placeholder="Defaults to system name"
                  />
                </FormField>
                <FormField label="From Email" name="fromEmail">
                  <input
                    id="fromEmail"
                    type="email"
                    className={styles.input}
                    value={form.fromEmail}
                    onChange={set('fromEmail')}
                    placeholder="Defaults to system email"
                  />
                </FormField>
              </div>

              <div className={styles.row2}>
                <FormField label="CC" name="cc">
                  <input
                    id="cc"
                    className={styles.input}
                    value={form.cc}
                    onChange={set('cc')}
                    placeholder="Comma-separated emails"
                  />
                </FormField>
                <FormField label="BCC" name="bcc">
                  <input
                    id="bcc"
                    className={styles.input}
                    value={form.bcc}
                    onChange={set('bcc')}
                    placeholder="Comma-separated emails"
                  />
                </FormField>
              </div>
            </section>

            {/* Section: Email Content */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Email Content</h3>

              <FormField
                label="Subject Line"
                name="subjectLine"
                required
                error={errors.subjectLine}
                helpText="Click a placeholder on the right to insert it."
              >
                <input
                  id="subjectLine"
                  ref={subjectRef}
                  className={inputCls(styles, errors.subjectLine)}
                  value={form.subjectLine}
                  onChange={set('subjectLine')}
                  onFocus={() => setActive('subject')}
                  placeholder="e.g. Welcome to {SystemName}, {FullName}!"
                />
              </FormField>

              <FormField label="Email Body" name="emailBody" required error={errors.emailBody}>
                <div
                  className={`${styles.quillWrap} ${errors.emailBody ? styles.quillWrapError : ''}`}
                  onFocus={() => setActive('body')}
                >
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={form.emailBody}
                    onChange={(val) => {
                      setForm((prev) => ({ ...prev, emailBody: val }));
                      setErrors((prev) => ({ ...prev, emailBody: undefined }));
                    }}
                    modules={QUILL_MODULES}
                    formats={QUILL_FORMATS}
                    placeholder="Design your email body here…"
                  />
                </div>
              </FormField>
            </section>
          </div>

          {/* ── Right: placeholders ────────────────────────────────────────── */}
          <aside className={styles.placeholderCol}>
            <div className={styles.placeholderPanel}>
              <h4 className={styles.placeholderTitle}>Available Placeholders</h4>
              <p className={styles.placeholderHint}>
                Focus a field, then click a placeholder to insert it.
              </p>
              <ul className={styles.placeholderList}>
                {PLACEHOLDERS.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      className={styles.placeholderBtn}
                      onClick={() => insertPlaceholder(p.key)}
                      title={`Insert ${p.key}`}
                    >
                      <span className={styles.placeholderKey}>{p.key}</span>
                      <span className={styles.placeholderDesc}>{p.desc}</span>
                      <span className={styles.placeholderIcon}>
                        {copiedKey === p.key
                          ? <Check size={12} className={styles.copiedIcon} />
                          : <ClipboardCopy size={12} />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <button className={styles.btnCancel} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={styles.btnSave} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : (isEdit ? 'Update Template' : 'Create Template')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function inputCls(styles, error) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
