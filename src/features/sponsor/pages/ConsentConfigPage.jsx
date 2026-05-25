import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Plus, Pencil, Trash2, GripVertical, FileText,
  Settings2, GitBranch, Upload, Eye, Copy,
  FileCheck, AlertCircle, ChevronDown, ChevronRight,
  X, File as FileIcon,
} from 'lucide-react';
import { sponsorConsentClient }  from '@/features/sponsor/api/sponsorConsentClient';
import { addToast }              from '@/app/notificationSlice';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import SnapshotButton from '@/components/feedback/SnapshotButton';
import SearchableDropdown        from '@/components/form/SearchableDropdown';
import FormField                 from '@/components/form/FormField';
import Modal                     from '@/components/feedback/Modal';
import ConfirmDialog             from '@/components/feedback/ConfirmDialog';
import ParagraphModal            from '@/features/sponsor/components/consent/ParagraphModal';
import FieldConfigModal          from '@/features/sponsor/components/consent/FieldConfigModal';
import { useReadOnlyView }       from '@/features/workspace/hooks/useReadOnlyView';
import styles from './ConsentConfigPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'paragraphs', label: 'Paragraphs',  icon: FileText   },
  { key: 'fields',     label: 'Fields',      icon: Settings2  },
  { key: 'workflow',   label: 'Workflow',     icon: GitBranch  },
  { key: 'documents',  label: 'Documents',   icon: Upload     },
  { key: 'preview',    label: 'Preview',     icon: Eye        },
];

const VARIABLES_SAMPLE = {
  '{StudyName}':             'NEXUS-2024',
  '{StudyID}':               'NSX-001',
  '{SponsorName}':           'Acme Pharma Ltd.',
  '{SiteName}':              'City General Hospital',
  '{UserFullName}':          'John Doe',
  '{UserEmail}':             'john.doe@example.com',
  '{UserRole}':              'Principal Investigator',
  '{CurrentDate}':           formatDate(new Date()),
  '{PrincipalInvestigator}': 'Dr. Jane Smith',
  '{ContactEmail}':          'study@example.com',
  '{ContactPhone}':          '+1-800-555-0100',
};

const FIELD_TYPE_LABELS = {
  text:       'Text',
  date:       'Date',
  'date-auto':'Auto Date',
  signature:  'Signature',
  number:     'Number',
  dropdown:   'Dropdown',
  file:       'File Upload',
  email:      'Email',
  phone:      'Phone',
  textarea:   'Text Area',
  checkbox:   'Checkbox',
};

const DEFAULT_FIELD_GROUPS = [
  {
    key: 'common', label: 'Common Fields',
    fields: [
      { key: 'fullName',    defaultLabel: 'Full Name',    label: 'Full Name',    type: 'text',      enabled: false, isMandatory: false, displayOrder: 1, helpText: '' },
      { key: 'dateOfBirth', defaultLabel: 'Date of Birth', label: 'Date of Birth', type: 'date',     enabled: false, isMandatory: false, displayOrder: 2, helpText: '' },
      { key: 'signature',   defaultLabel: 'Signature',    label: 'Signature',    type: 'signature', enabled: false, isMandatory: true,  displayOrder: 3, helpText: '' },
      { key: 'date',        defaultLabel: 'Date',         label: 'Date',         type: 'date-auto', enabled: false, isMandatory: false, displayOrder: 4, helpText: 'Auto-populated with current date' },
    ],
  },
  {
    key: 'professional', label: 'Professional Fields',
    fields: [
      { key: 'medicalLicenseNumber',  defaultLabel: 'Medical License Number', label: 'Medical License Number', type: 'text',     enabled: false, isMandatory: false, displayOrder: 1, helpText: '' },
      { key: 'yearsOfExperience',     defaultLabel: 'Years of Experience',    label: 'Years of Experience',    type: 'number',   enabled: false, isMandatory: false, displayOrder: 2, helpText: '' },
      { key: 'specialization',        defaultLabel: 'Specialization',         label: 'Specialization',         type: 'dropdown', enabled: false, isMandatory: false, displayOrder: 3, helpText: '' },
      { key: 'cvUpload',              defaultLabel: 'CV Upload',              label: 'CV Upload',              type: 'file',     enabled: false, isMandatory: false, displayOrder: 4, helpText: 'PDF, DOC, DOCX – max 5MB' },
      { key: 'gcpCertificate',        defaultLabel: 'GCP Certificate',        label: 'GCP Certificate',        type: 'file',     enabled: false, isMandatory: false, displayOrder: 5, helpText: 'PDF, JPG, PNG – max 5MB' },
      { key: 'declarationOfInterest', defaultLabel: 'Declaration of Interest', label: 'Declaration of Interest', type: 'checkbox', enabled: false, isMandatory: false, displayOrder: 6, helpText: '' },
    ],
  },
  {
    key: 'subject', label: 'Subject / Patient Fields',
    fields: [
      { key: 'gender',                 defaultLabel: 'Gender',                 label: 'Gender',                 type: 'dropdown', enabled: false, isMandatory: false, displayOrder: 1,  helpText: '' },
      { key: 'nationality',            defaultLabel: 'Nationality',            label: 'Nationality',            type: 'dropdown', enabled: false, isMandatory: false, displayOrder: 2,  helpText: '' },
      { key: 'emailAddress',           defaultLabel: 'Email Address',          label: 'Email Address',          type: 'email',    enabled: false, isMandatory: false, displayOrder: 3,  helpText: '' },
      { key: 'contactNumber',          defaultLabel: 'Contact Number',         label: 'Contact Number',         type: 'phone',    enabled: false, isMandatory: false, displayOrder: 4,  helpText: '' },
      { key: 'addressLine1',           defaultLabel: 'Address Line 1',         label: 'Address Line 1',         type: 'text',     enabled: false, isMandatory: false, displayOrder: 5,  helpText: '' },
      { key: 'addressLine2',           defaultLabel: 'Address Line 2',         label: 'Address Line 2',         type: 'text',     enabled: false, isMandatory: false, displayOrder: 6,  helpText: '' },
      { key: 'addressCity',            defaultLabel: 'City',                   label: 'City',                   type: 'text',     enabled: false, isMandatory: false, displayOrder: 7,  helpText: '' },
      { key: 'addressState',           defaultLabel: 'State',                  label: 'State',                  type: 'text',     enabled: false, isMandatory: false, displayOrder: 8,  helpText: '' },
      { key: 'addressPostalCode',      defaultLabel: 'Postal Code',            label: 'Postal Code',            type: 'text',     enabled: false, isMandatory: false, displayOrder: 9,  helpText: '' },
      { key: 'emergencyContactName',   defaultLabel: 'Emergency Contact Name', label: 'Emergency Contact Name', type: 'text',     enabled: false, isMandatory: false, displayOrder: 10, helpText: '' },
      { key: 'emergencyContactNumber', defaultLabel: 'Emergency Contact No.',  label: 'Emergency Contact No.',  type: 'phone',    enabled: false, isMandatory: false, displayOrder: 11, helpText: '' },
      { key: 'primaryCarePhysician',   defaultLabel: 'Primary Care Physician', label: 'Primary Care Physician', type: 'text',     enabled: false, isMandatory: false, displayOrder: 12, helpText: '' },
      { key: 'medicalHistory',         defaultLabel: 'Medical History',        label: 'Medical History',        type: 'textarea', enabled: false, isMandatory: false, displayOrder: 13, helpText: '' },
    ],
  },
  {
    key: 'bank', label: 'Bank Account Fields (Compensation)',
    fields: [
      { key: 'bankName',              defaultLabel: 'Bank Name',              label: 'Bank Name',              type: 'text', enabled: false, isMandatory: false, displayOrder: 1, helpText: '' },
      { key: 'accountNumber',         defaultLabel: 'Account Number',         label: 'Account Number',         type: 'text', enabled: false, isMandatory: false, displayOrder: 2, helpText: '' },
      { key: 'ifscCode',              defaultLabel: 'IFSC Code',              label: 'IFSC Code',              type: 'text', enabled: false, isMandatory: false, displayOrder: 3, helpText: '' },
      { key: 'confirmAccountNumber',  defaultLabel: 'Confirm Account Number', label: 'Confirm Account Number', type: 'text', enabled: false, isMandatory: false, displayOrder: 4, helpText: '' },
      { key: 'cancelledCheque',       defaultLabel: 'Cancelled Cheque',       label: 'Cancelled Cheque',       type: 'file', enabled: false, isMandatory: false, displayOrder: 5, helpText: 'PDF, JPG, PNG – max 5MB' },
    ],
  },
  {
    key: 'identification', label: 'Identification Fields',
    fields: [
      { key: 'passportNumber', defaultLabel: 'Passport Number', label: 'Passport Number', type: 'text', enabled: false, isMandatory: false, displayOrder: 1, helpText: '' },
      { key: 'passportUpload', defaultLabel: 'Passport Upload', label: 'Passport Upload', type: 'file', enabled: false, isMandatory: false, displayOrder: 2, helpText: 'PDF, JPG, PNG – max 5MB' },
      { key: 'panNumber',      defaultLabel: 'PAN Number',      label: 'PAN Number',      type: 'text', enabled: false, isMandatory: false, displayOrder: 3, helpText: '' },
      { key: 'panUpload',      defaultLabel: 'PAN Upload',      label: 'PAN Upload',      type: 'file', enabled: false, isMandatory: false, displayOrder: 4, helpText: 'PDF, JPG, PNG – max 5MB' },
      { key: 'aadhaarNumber',  defaultLabel: 'Aadhaar Number',  label: 'Aadhaar Number',  type: 'text', enabled: false, isMandatory: false, displayOrder: 5, helpText: 'If applicable' },
      { key: 'aadhaarUpload',  defaultLabel: 'Aadhaar Upload',  label: 'Aadhaar Upload',  type: 'file', enabled: false, isMandatory: false, displayOrder: 6, helpText: 'PDF, JPG, PNG – max 5MB' },
      { key: 'idProof',        defaultLabel: 'ID Proof',        label: 'ID Proof',        type: 'file', enabled: false, isMandatory: false, displayOrder: 7, helpText: 'PDF, JPG, PNG – max 5MB' },
      { key: 'addressProof',   defaultLabel: 'Address Proof',   label: 'Address Proof',   type: 'file', enabled: false, isMandatory: false, displayOrder: 8, helpText: 'PDF, JPG, PNG – max 5MB' },
    ],
  },
];

const DEFAULT_WORKFLOW = {
  requireWitness:              false,
  requirePIApproval:           false,
  requireSponsorReview:        false,
  consentExpiryDays:           365,
  requireReconsentOnAmendment: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenFields(groups) {
  return groups.flatMap((g) => g.fields.map((f) => ({ ...f, groupKey: g.key })));
}

function mergeFieldConfig(defaultGroups, savedFields) {
  if (!savedFields?.length) return defaultGroups;
  const map = Object.fromEntries(savedFields.map((f) => [f.key, f]));
  return defaultGroups.map((g) => ({
    ...g,
    fields: g.fields.map((f) => (map[f.key] ? { ...f, ...map[f.key] } : f)),
  }));
}

function replaceVariables(text) {
  return Object.entries(VARIABLES_SAMPLE).reduce(
    (t, [k, v]) => t.replaceAll(k, `<strong>${v}</strong>`),
    text,
  );
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsentConfigPage() {
  const { studyId } = useParams();
  const dispatch    = useDispatch();
  const docRef      = useRef(null);
  const ro          = useReadOnlyView();

  // ── State ────────────────────────────────────────────────────────────────
  const [roles,       setRoles]      = useState([]);
  const [roleOpts,    setRoleOpts]   = useState([]);
  const [selectedRole, setSelected]  = useState(null);
  const [activeTab,   setActiveTab]  = useState('paragraphs');
  const [loading,     setLoading]    = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [uploading,   setUploading]  = useState(false);

  const [paragraphs,  setParagraphs] = useState([]);
  const [fieldGroups, setFieldGroups]= useState(DEFAULT_FIELD_GROUPS);
  const [workflow,    setWorkflow]   = useState(DEFAULT_WORKFLOW);
  const [documents,   setDocuments]  = useState([]);
  const [version,     setVersion]    = useState(1);
  const [lastSaved,   setLastSaved]  = useState(null);

  // Expanded field group state
  const [expanded, setExpanded] = useState({
    common: true, professional: false, subject: false, bank: false, identification: false,
  });

  // Modals
  const [paraModal,   setParaModal]   = useState(null); // null | 'create' | paragraph object
  const [fieldModal,  setFieldModal]  = useState(null); // null | field object
  const [deleteTarget,setDeleteTgt]   = useState(null); // null | { type, item }
  const [copyModal,   setCopyModal]   = useState(false);
  const [copySource,  setCopySource]  = useState('');

  // ── Load roles ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!studyId) return;
    sponsorConsentClient.getRoles(studyId)
      .then((r) => {
        setRoles(r);
        setRoleOpts(r.map((x) => ({ value: x.id, label: x.name })));
      })
      .catch(() => { setRoles([]); setRoleOpts([]); });
  }, [studyId]);

  // ── Load config when role changes ────────────────────────────────────────
  const loadConfig = useCallback(() => {
    if (!selectedRole) return;
    setLoading(true);
    sponsorConsentClient.getConfig(studyId, selectedRole.id)
      .then((cfg) => {
        setParagraphs(cfg.paragraphs ?? []);
        setFieldGroups(mergeFieldConfig(DEFAULT_FIELD_GROUPS, cfg.fields));
        setWorkflow({ ...DEFAULT_WORKFLOW, ...(cfg.workflow ?? {}) });
        setDocuments(cfg.documents ?? []);
        setVersion(cfg.version ?? 1);
        setLastSaved(cfg.updatedAt);
      })
      .catch(() => {
        // New role — use defaults
        setParagraphs([]);
        setFieldGroups(DEFAULT_FIELD_GROUPS);
        setWorkflow(DEFAULT_WORKFLOW);
        setDocuments([]);
        setVersion(1);
        setLastSaved(null);
      })
      .finally(() => setLoading(false));
  }, [studyId, selectedRole]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const saved = await sponsorConsentClient.saveConfig(studyId, selectedRole.id, {
        paragraphs,
        fields:   flattenFields(fieldGroups),
        workflow,
      });
      setVersion(saved.version ?? version + 1);
      setLastSaved(new Date().toISOString());
      dispatch(addToast({ type: 'success', message: `Consent form for ${selectedRole.name} saved successfully.` }));
    } catch {
      dispatch(addToast({ type: 'error', message: `Failed to save consent form for ${selectedRole.name}. Please try again.` }));
    } finally {
      setSaving(false);
    }
  };

  // ── Role select ──────────────────────────────────────────────────────────
  const handleRoleChange = (id) => {
    const role = roles.find((r) => r.id === id) ?? null;
    setSelected(role);
    setActiveTab('paragraphs');
  };

  // ── Paragraphs ───────────────────────────────────────────────────────────
  const handleParagraphSave = (data) => {
    if (data.id) {
      setParagraphs((prev) => prev.map((p) => (p.id === data.id ? data : p)));
    } else {
      setParagraphs((prev) => [...prev, { ...data, id: crypto.randomUUID() }]);
    }
    setParaModal(null);
  };

  const handleParagraphDelete = () => {
    setParagraphs((prev) => prev.filter((p) => p.id !== deleteTarget.item.id));
    setDeleteTgt(null);
  };

  // ── Fields ───────────────────────────────────────────────────────────────
  const toggleField = (groupKey, fieldKey) => {
    setFieldGroups((prev) => prev.map((g) =>
      g.key !== groupKey ? g : {
        ...g,
        fields: g.fields.map((f) =>
          f.key !== fieldKey ? f : { ...f, enabled: !f.enabled },
        ),
      },
    ));
  };

  const handleFieldConfigSave = (updated) => {
    setFieldGroups((prev) => prev.map((g) =>
      g.key !== updated.groupKey ? g : {
        ...g,
        fields: g.fields.map((f) => (f.key === updated.key ? { ...f, ...updated } : f)),
      },
    ));
    setFieldModal(null);
  };

  // ── Copy from role ────────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!copySource || copySource === selectedRole?.id) {
      dispatch(addToast({ type: 'error', message: 'Please select a different source role.' }));
      return;
    }
    try {
      const cfg = await sponsorConsentClient.getConfig(studyId, copySource);
      setParagraphs(cfg.paragraphs ?? []);
      setFieldGroups(mergeFieldConfig(DEFAULT_FIELD_GROUPS, cfg.fields));
      setWorkflow({ ...DEFAULT_WORKFLOW, ...(cfg.workflow ?? {}) });
      const srcName = roles.find((r) => r.id === copySource)?.name ?? copySource;
      dispatch(addToast({
        type:    'success',
        message: `Consent configuration copied from ${srcName} to ${selectedRole.name}.`,
      }));
      setCopyModal(false);
      setCopySource('');
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to copy configuration. Please try again.' }));
    }
  };

  // ── Document upload ──────────────────────────────────────────────────────
  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const doc = await sponsorConsentClient.uploadDocument(studyId, selectedRole.id, file);
      setDocuments((prev) => [...prev, doc]);
      dispatch(addToast({ type: 'success', message: 'Document uploaded successfully.' }));
    } catch {
      // fallback: add locally
      setDocuments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: file.name, size: file.size, url: '' },
      ]);
      dispatch(addToast({ type: 'success', message: 'Document uploaded successfully.' }));
    } finally {
      setUploading(false);
    }
  };

  const handleDocDelete = () => {
    const doc = deleteTarget.item;
    sponsorConsentClient.deleteDocument(studyId, selectedRole.id, doc.id).catch(() => {});
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleteTgt(null);
  };

  // ── Workflow ─────────────────────────────────────────────────────────────
  const setWf = (key) => (val) =>
    setWorkflow((prev) => ({ ...prev, [key]: val }));

  // ── Render helpers ────────────────────────────────────────────────────────

  const sortedParagraphs = [...paragraphs].sort((a, b) => a.displayOrder - b.displayOrder);

  function renderParagraphsTab() {
    return (
      <div className={styles.tabBody}>
        <div className={styles.tabToolbar}>
          <button
            className={styles.btnAdd}
            onClick={() => setParaModal('create')}
            {...ro.disabledProps('Add paragraph')}
          >
            <Plus size={14} /> Add Paragraph
          </button>
        </div>

        {sortedParagraphs.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={36} strokeWidth={1.25} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No paragraphs yet</p>
            <p className={styles.emptySub}>Click "Add Paragraph" to create the first content section.</p>
          </div>
        ) : (
          <div className={styles.paraList}>
            {sortedParagraphs.map((p) => (
              <div key={p.id} className={styles.paraCard}>
                <GripVertical size={16} className={styles.grip} />
                <div className={styles.paraBody}>
                  <div className={styles.paraHeader}>
                    <span className={styles.paraOrder}>#{p.displayOrder}</span>
                    <span className={styles.paraTitle}>{p.sectionTitle}</span>
                    {p.isMandatory && (
                      <span className={styles.mandatoryBadge}>Mandatory</span>
                    )}
                  </div>
                  <p className={styles.paraPreview}>
                    {p.content.length > 120 ? `${p.content.slice(0, 120)}…` : p.content}
                  </p>
                </div>
                <div className={styles.paraActions}>
                  <button
                    className={styles.actionBtn}
                    title={ro.isReadOnly ? ro.readOnlyMessage : 'Edit'}
                    onClick={() => setParaModal(p)}
                    {...ro.disabledProps('Edit paragraph')}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionDanger}`}
                    title={ro.isReadOnly ? ro.readOnlyMessage : 'Delete'}
                    onClick={() => setDeleteTgt({ type: 'paragraph', item: p })}
                    {...ro.disabledProps('Delete paragraph')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderFieldsTab() {
    return (
      <div className={styles.tabBody}>
        <p className={styles.tabHint}>
          Toggle fields on to include them in the consent form for this role. Click the configure icon to customise label, order, and validation.
        </p>
        {fieldGroups.map((g) => {
          const enabledCount = g.fields.filter((f) => f.enabled).length;
          const isOpen = expanded[g.key];
          return (
            <div key={g.key} className={styles.fieldGroup}>
              <button
                className={styles.fieldGroupHeader}
                onClick={() => setExpanded((p) => ({ ...p, [g.key]: !p[g.key] }))}
              >
                <span className={styles.fieldGroupLeft}>
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className={styles.fieldGroupName}>{g.label}</span>
                  {enabledCount > 0 && (
                    <span className={styles.enabledBadge}>{enabledCount} enabled</span>
                  )}
                </span>
                <span className={styles.fieldGroupCount}>{g.fields.length} fields</span>
              </button>

              {isOpen && (
                <div className={styles.fieldList}>
                  {g.fields.map((f) => (
                    <div key={f.key} className={`${styles.fieldRow} ${f.enabled ? styles.fieldRowEnabled : ''}`}>
                      {/* Toggle */}
                      <label className={styles.toggle} title={ro.isReadOnly ? ro.readOnlyMessage : undefined}>
                        <input
                          type="checkbox"
                          checked={f.enabled}
                          onChange={() => toggleField(g.key, f.key)}
                          disabled={ro.isReadOnly}
                        />
                        <span className={styles.toggleTrack} />
                      </label>

                      <div className={styles.fieldInfo}>
                        <span className={styles.fieldLabel}>{f.label}</span>
                        <span className={styles.fieldType}>{FIELD_TYPE_LABELS[f.type] ?? f.type}</span>
                        {f.enabled && f.isMandatory && (
                          <span className={styles.mandatoryBadge}>Required</span>
                        )}
                        {f.enabled && f.helpText && (
                          <span className={styles.helpBadge} title={f.helpText}>?</span>
                        )}
                      </div>

                      {f.enabled && (
                        <button
                          className={styles.configBtn}
                          title={ro.isReadOnly ? ro.readOnlyMessage : 'Configure field'}
                          onClick={() => setFieldModal({ ...f, groupKey: g.key })}
                          {...ro.disabledProps('Configure field')}
                        >
                          <Settings2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderWorkflowTab() {
    return (
      <div className={styles.tabBody}>
        <div className={styles.wfGrid}>
          {[
            { key: 'requireWitness',              label: 'Require Witness',              desc: 'Witness fields will be displayed in the consent form.' },
            { key: 'requirePIApproval',           label: 'Require PI Approval',          desc: 'Principal Investigator must approve before the consent is accepted.' },
            { key: 'requireSponsorReview',        label: 'Require Sponsor Review',       desc: 'Sponsor must review and approve the completed consent form.' },
            { key: 'requireReconsentOnAmendment', label: 'Re-consent on Amendment',      desc: 'Users must re-consent whenever a study amendment is published.' },
          ].map(({ key, label, desc }) => (
            <div key={key} className={styles.wfCard}>
              <div className={styles.wfCardBody}>
                <span className={styles.wfLabel}>{label}</span>
                <span className={styles.wfDesc}>{desc}</span>
              </div>
              <label className={styles.toggle} title={ro.isReadOnly ? ro.readOnlyMessage : undefined}>
                <input
                  type="checkbox"
                  checked={!!workflow[key]}
                  onChange={(e) => setWf(key)(e.target.checked)}
                  disabled={ro.isReadOnly}
                />
                <span className={styles.toggleTrack} />
              </label>
            </div>
          ))}

          <div className={styles.wfCard}>
            <div className={styles.wfCardBody}>
              <span className={styles.wfLabel}>Consent Expiry (Days)</span>
              <span className={styles.wfDesc}>Number of days before the consent expires and must be renewed.</span>
            </div>
            <input
              type="number"
              min={1}
              className={styles.wfNumber}
              value={workflow.consentExpiryDays}
              onChange={(e) => setWf('consentExpiryDays')(Number(e.target.value) || 365)}
              disabled={ro.isReadOnly}
              title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderDocumentsTab() {
    return (
      <div className={styles.tabBody}>
        <div className={styles.tabToolbar}>
          <button
            className={styles.btnAdd}
            onClick={() => !ro.isReadOnly && docRef.current?.click()}
            disabled={uploading || ro.isReadOnly}
            aria-disabled={uploading || ro.isReadOnly}
            title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
          >
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
          <input
            ref={docRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            style={{ display: 'none' }}
            onChange={handleDocUpload}
          />
          <span className={styles.docHint}>Accepted: PDF, JPG, PNG, DOC, DOCX – max 5 MB</span>
        </div>

        {documents.length === 0 ? (
          <div className={styles.empty}>
            <FileIcon size={36} strokeWidth={1.25} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No supporting documents</p>
            <p className={styles.emptySub}>Upload role-specific information sheets, FAQs, or other documents.</p>
          </div>
        ) : (
          <div className={styles.docList}>
            {documents.map((d) => (
              <div key={d.id} className={styles.docRow}>
                <FileIcon size={15} className={styles.docIcon} />
                <span className={styles.docName}>{d.name}</span>
                {d.size > 0 && <span className={styles.docSize}>{fmtSize(d.size)}</span>}
                <button
                  className={`${styles.actionBtn} ${styles.actionDanger}`}
                  title={ro.isReadOnly ? ro.readOnlyMessage : 'Remove'}
                  onClick={() => setDeleteTgt({ type: 'document', item: d })}
                  {...ro.disabledProps('Remove document')}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderPreviewTab() {
    const enabledFields = flattenFields(fieldGroups).filter((f) => f.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return (
      <div className={styles.tabBody}>
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <FileCheck size={20} />
            <div>
              <div className={styles.previewTitle}>Electronic Informed Consent Form</div>
              <div className={styles.previewRole}>Role: {selectedRole?.name ?? '—'}</div>
            </div>
          </div>

          {sortedParagraphs.length === 0 && enabledFields.length === 0 ? (
            <p className={styles.previewEmpty}>No content configured yet. Add paragraphs and fields in the other tabs.</p>
          ) : null}

          {sortedParagraphs.map((p) => (
            <div key={p.id} className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>
                {p.sectionTitle}
                {p.isMandatory && <span className={styles.mandatoryBadge} style={{ marginLeft: 8 }}>Mandatory</span>}
              </h3>
              <p
                className={styles.previewContent}
                dangerouslySetInnerHTML={{ __html: replaceVariables(p.content) }}
              />
              {p.isMandatory && (
                <label className={styles.previewAck}>
                  <input type="checkbox" disabled />
                  I have read and understood this section.
                </label>
              )}
            </div>
          ))}

          {enabledFields.length > 0 && (
            <div className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>Required Information</h3>
              <div className={styles.previewFields}>
                {enabledFields.map((f) => (
                  <div key={f.key} className={styles.previewField}>
                    <label className={styles.previewFieldLabel}>
                      {f.label}
                      {f.isMandatory && <span className={styles.asterisk}> *</span>}
                    </label>
                    <div className={styles.previewFieldInput}>
                      {f.type === 'signature'  && <div className={styles.previewSig}>[ Signature pad ]</div>}
                      {f.type === 'file'       && <div className={styles.previewFile}><Upload size={12} /> Choose file</div>}
                      {f.type === 'checkbox'   && <input type="checkbox" disabled />}
                      {f.type === 'textarea'   && <div className={styles.previewInputBox} style={{ minHeight: 56 }} />}
                      {f.type === 'date-auto'  && <div className={styles.previewInputBox}>{formatDate(new Date())}</div>}
                      {!['signature','file','checkbox','textarea','date-auto'].includes(f.type) && (
                        <div className={styles.previewInputBox} />
                      )}
                    </div>
                    {f.helpText && <span className={styles.previewHelp}>{f.helpText}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.previewSection}>
            <h3 className={styles.previewSectionTitle}>Declaration & Signature</h3>
            <p className={styles.previewContent}>
              I, <strong>{VARIABLES_SAMPLE['{UserFullName}']}</strong>, hereby declare that I have
              read and understood the above information and voluntarily agree to participate in the
              study <strong>{VARIABLES_SAMPLE['{StudyName}']}</strong>.
            </p>
            <div className={styles.previewSig}>[ Signature pad ]</div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary,#64748b)' }}>
              Date: {formatDate(new Date())}
            </div>
          </div>

          <div className={styles.previewFooter}>
            {workflow.requireWitness && (
              <div className={styles.previewSection}>
                <h3 className={styles.previewSectionTitle}>Witness</h3>
                <div className={styles.previewSig}>[ Witness Signature pad ]</div>
              </div>
            )}
            <p className={styles.previewNote}>
              This consent form will expire after <strong>{workflow.consentExpiryDays}</strong> days.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Consent Builder</h1>
          <p className={styles.sub}>Configure role-based eConsent forms for this study.</p>
        </div>
        <div className={styles.headerActions}>
          <SnapshotButton leaf="consent_builder" filename="consent_builder" className={styles.btnSecondary} />
          {selectedRole && (
            <button
              className={styles.btnSecondary}
              onClick={() => { setCopySource(''); setCopyModal(true); }}
              title={ro.isReadOnly ? ro.readOnlyMessage : 'Copy configuration from another role'}
              {...ro.disabledProps('Copy from role')}
            >
              <Copy size={14} /> Copy from Role
            </button>
          )}
          <button
            className={styles.btnPrimary}
            onClick={() => !ro.isReadOnly && handleSave()}
            disabled={!selectedRole || saving || ro.isReadOnly}
            aria-disabled={!selectedRole || saving || ro.isReadOnly}
            title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Role selector */}
      <div className={styles.roleBar}>
        <div className={styles.roleSelector}>
          <label className={styles.roleLabel}>Configure for Role:</label>
          <div className={styles.roleDropdown}>
            <SearchableDropdown
              options={roleOpts}
              value={selectedRole?.id ?? ''}
              onChange={handleRoleChange}
              placeholder={roleOpts.length === 0 ? 'No site roles configured' : 'Select a role…'}
              searchPlaceholder="Search roles…"
            />
          </div>
        </div>
        {selectedRole && lastSaved && (
          <span className={styles.versionInfo}>
            Version {version} · Saved {formatDateTime(lastSaved)}
          </span>
        )}
        {selectedRole && !lastSaved && (
          <span className={styles.versionInfo}>Version {version} · Not saved yet</span>
        )}
      </div>

      {/* No role selected */}
      {!selectedRole && (
        <div className={styles.noRole}>
          <FileCheck size={44} strokeWidth={1.25} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Select a role to begin</p>
          <p className={styles.emptySub}>
            Choose a site role from the dropdown above to configure its consent form.
          </p>
          {roleOpts.length === 0 && (
            <p className={styles.warnNote}>
              <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              No site roles found. Configure site roles under Site Management → Site Role first.
            </p>
          )}
        </div>
      )}

      {/* Content area */}
      {selectedRole && (
        <div className={styles.content}>
          {/* Tab bar */}
          <div className={styles.tabs}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(key)}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {loading ? (
            <div className={styles.tabLoading}>
              <div className={styles.spinner} />
              Loading configuration…
            </div>
          ) : (
            <>
              {activeTab === 'paragraphs' && renderParagraphsTab()}
              {activeTab === 'fields'     && renderFieldsTab()}
              {activeTab === 'workflow'   && renderWorkflowTab()}
              {activeTab === 'documents'  && renderDocumentsTab()}
              {activeTab === 'preview'    && renderPreviewTab()}
            </>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {paraModal && (
        <ParagraphModal
          paragraph={paraModal === 'create' ? null : paraModal}
          onSave={handleParagraphSave}
          onClose={() => setParaModal(null)}
        />
      )}

      {fieldModal && (
        <FieldConfigModal
          field={fieldModal}
          onSave={handleFieldConfigSave}
          onClose={() => setFieldModal(null)}
        />
      )}

      {copyModal && (
        <Modal
          open
          onClose={() => { setCopyModal(false); setCopySource(''); }}
          title="Copy Consent Configuration"
          size="sm"
          footer={
            <>
              <button
                className={styles.btnCancelSm}
                onClick={() => { setCopyModal(false); setCopySource(''); }}
              >Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={() => !ro.isReadOnly && handleCopy()}
                disabled={!copySource || ro.isReadOnly}
                aria-disabled={!copySource || ro.isReadOnly}
                title={ro.isReadOnly ? ro.readOnlyMessage : undefined}
              >
                Copy
              </button>
            </>
          }
        >
          <div style={{ padding: '4px 0 8px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary,#64748b)', marginBottom: 12 }}>
              Select the source role to copy paragraphs, fields, and workflow settings from. Unsaved changes to the current role will be overwritten.
            </p>
            <FormField label="Source Role" name="copySource">
              <SearchableDropdown
                options={roleOpts.filter((r) => r.value !== selectedRole?.id)}
                value={copySource}
                onChange={(v) => setCopySource(v ?? '')}
                placeholder="Select source role…"
                searchPlaceholder="Search roles…"
              />
            </FormField>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTgt(null)}
        onConfirm={deleteTarget?.type === 'paragraph' ? handleParagraphDelete : handleDocDelete}
        variant="danger"
        title={deleteTarget?.type === 'paragraph' ? 'Delete Paragraph' : 'Remove Document'}
        message={
          deleteTarget?.type === 'paragraph'
            ? 'Are you sure you want to delete this paragraph? This action cannot be undone.'
            : `Remove "${deleteTarget?.item?.name}"? This action cannot be undone.`
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
