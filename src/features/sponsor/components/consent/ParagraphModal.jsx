import { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import Modal     from '@/components/feedback/Modal';
import FormField from '@/components/form/FormField';
import styles from './ParagraphModal.module.css';

const VARIABLES = [
  { key: '{StudyName}',             label: 'Study Name'             },
  { key: '{StudyID}',               label: 'Study ID'               },
  { key: '{SponsorName}',           label: 'Sponsor Name'           },
  { key: '{SiteName}',              label: 'Site Name'              },
  { key: '{UserFullName}',          label: 'User Full Name'         },
  { key: '{UserEmail}',             label: 'User Email'             },
  { key: '{UserRole}',              label: 'User Role'              },
  { key: '{CurrentDate}',           label: 'Current Date'           },
  { key: '{PrincipalInvestigator}', label: 'Principal Investigator' },
  { key: '{ContactEmail}',          label: 'Contact Email'          },
  { key: '{ContactPhone}',          label: 'Contact Phone'          },
];

export default function ParagraphModal({ paragraph, onSave, onClose }) {
  const isEdit = !!paragraph?.id;

  const [form, setForm] = useState({
    sectionTitle: paragraph?.sectionTitle ?? '',
    content:      paragraph?.content      ?? '',
    displayOrder: paragraph?.displayOrder ?? 1,
    isMandatory:  paragraph?.isMandatory  ?? false,
  });
  const [errors,  setErrors]  = useState({});
  const [varOpen, setVarOpen] = useState(false);
  const contentRef = useRef(null);

  const set = (field) => (e) => {
    const val = e?.target?.type === 'checkbox' ? e.target.checked
      : e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const insertVariable = (varKey) => {
    const ta = contentRef.current;
    if (!ta) { setForm((p) => ({ ...p, content: p.content + varKey })); setVarOpen(false); return; }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const next = form.content.slice(0, s) + varKey + form.content.slice(e);
    setForm((p) => ({ ...p, content: next }));
    setVarOpen(false);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + varKey.length, s + varKey.length);
    });
  };

  const handleSubmit = () => {
    const errs = {};
    if (!form.sectionTitle.trim()) errs.sectionTitle = 'Section Title is required.';
    if (!form.content.trim())      errs.content      = 'Section Content is required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...paragraph, ...form, displayOrder: Number(form.displayOrder) || 1 });
  };

  const footer = (
    <>
      <button className={styles.btnCancel} onClick={onClose} type="button">Cancel</button>
      <button className={styles.btnSave} onClick={handleSubmit} type="button">
        {isEdit ? 'Update Paragraph' : 'Add Paragraph'}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Paragraph' : 'Add Paragraph'}
      size="md"
      footer={footer}
    >
      <div className={styles.body}>

        <FormField label="Section Title" name="sectionTitle" required error={errors.sectionTitle}>
          <input
            id="sectionTitle"
            className={`${styles.input} ${errors.sectionTitle ? styles.inputError : ''}`}
            value={form.sectionTitle}
            onChange={set('sectionTitle')}
            placeholder="e.g. Introduction to the Study"
          />
        </FormField>

        <FormField
          label="Section Content"
          name="content"
          required
          error={errors.content}
          helpText="Click 'Insert Variable' to embed dynamic placeholders like {StudyName}."
        >
          <div className={styles.contentWrap}>
            <div className={styles.contentToolbar}>
              <div className={styles.varDropdown}>
                <button
                  type="button"
                  className={styles.varBtn}
                  onClick={() => setVarOpen((o) => !o)}
                >
                  Insert Variable <ChevronDown size={12} />
                </button>
                {varOpen && (
                  <div className={styles.varMenu}>
                    {VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        className={styles.varItem}
                        onClick={() => insertVariable(v.key)}
                      >
                        <span className={styles.varKey}>{v.key}</span>
                        <span className={styles.varLabel}>{v.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <textarea
              ref={contentRef}
              id="content"
              className={`${styles.textarea} ${errors.content ? styles.inputError : ''}`}
              value={form.content}
              onChange={set('content')}
              placeholder="Enter consent section content here…"
              rows={8}
            />
          </div>
        </FormField>

        <div className={styles.row2}>
          <FormField label="Display Order" name="displayOrder">
            <input
              id="displayOrder"
              type="number"
              min={1}
              className={styles.input}
              value={form.displayOrder}
              onChange={set('displayOrder')}
            />
          </FormField>

          <FormField label="Mandatory Acknowledgement">
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={form.isMandatory}
                onChange={set('isMandatory')}
              />
              User must acknowledge reading this section
            </label>
          </FormField>
        </div>

      </div>
    </Modal>
  );
}
