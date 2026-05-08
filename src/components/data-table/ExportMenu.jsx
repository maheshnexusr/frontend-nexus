/**
 * ExportMenu — dropdown button offering CSV / Excel / PDF exports.
 *
 * Usage:
 *   <ExportMenu
 *     onExport={(format) => handleExport(format)}
 *     disabled={exporting}
 *     label={exporting ? 'Exporting…' : 'Export'}
 *   />
 */

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, FileType2 } from 'lucide-react';
import styles from './ExportMenu.module.css';

const FORMATS = [
  { key: 'xlsx', label: 'Excel (.xls)', icon: FileSpreadsheet },
  { key: 'csv',  label: 'CSV (.csv)',   icon: FileType2      },
  { key: 'pdf',  label: 'PDF (.pdf)',   icon: FileText       },
];

export default function ExportMenu({ onExport, disabled = false, label = 'Export' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.btn}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} />
        <span>{label}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {FORMATS.map(({ key, label: l, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => { setOpen(false); onExport(key); }}
            >
              <Icon size={14} />
              <span>{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
