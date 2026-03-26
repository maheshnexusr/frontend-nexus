import { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Pencil, Eye, Code2, Database, Undo2, Redo2, Trash2, Upload, Download, Save, FileJson, ChevronDown } from 'lucide-react';
import {
  setMode, undo, redo, clearAll, importJSON,
  selectMode, selectElements, selectFormSettings, selectCanUndo, selectCanRedo, selectExportJSON,
} from '@/features/form-builder/store/formSlice';
import s from './Toolbar.module.css';

const MODES = [
  { id: 'editor',  label: 'Editor',  Icon: Pencil },
  { id: 'preview', label: 'Preview', Icon: Eye },
  { id: 'code',    label: 'Code',    Icon: Code2 },
  { id: 'model',   label: 'Model',   Icon: Database },
];

export default function Toolbar() {
  const dispatch = useDispatch();
  const mode         = useSelector(selectMode);
  const elements     = useSelector(selectElements);
  const formSettings = useSelector(selectFormSettings);
  const canUndo      = useSelector(selectCanUndo);
  const canRedo      = useSelector(selectCanRedo);
  const json         = useSelector(selectExportJSON);

  const [importOpen, setImportOpen]       = useState(false);
  const [saveSuccess, setSaveSuccess]     = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileRef = useRef(null);

  const handleExport = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${formSettings.title?.replace(/\s+/g, '-').toLowerCase() || 'form'}-schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(/** @type {string} */ (ev.target.result));
        dispatch(importJSON(data));
      } catch { alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      dispatch(importJSON(data));
      setImportOpen(false);
    } catch { alert('Invalid JSON in clipboard.'); }
  };

  const handleSave = () => {
    localStorage.setItem('form-builder-autosave', json);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className={s.toolbar}>
      {/* Brand */}
      <div className={s.brand}>
        <div className={s.logo}>
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        </div>
        <span className={s.brandName}>Form Builder</span>
        {elements.length > 0 && (
          <span className={s.count}>{elements.length} element{elements.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Mode tabs */}
      <div className={s.modes}>
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => dispatch(setMode(id))}
            className={`${s.modeBtn} ${mode === id ? s.modeBtnActive : ''}`}
          >
            <Icon size={13} />
            {label}
            {mode === id && id !== 'editor' && <span className={s.dot} />}
          </button>
        ))}
      </div>

      <div className={s.spacer} />

      <div className={s.actions}>
        {/* Undo / Redo */}
        <button className={s.iconBtn} onClick={() => dispatch(undo())} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button className={s.iconBtn} onClick={() => dispatch(redo())} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={15} />
        </button>

        <div className={s.divider} />

        {/* Clear */}
        {!showClearConfirm ? (
          <button
            className={`${s.iconBtn} ${s.iconBtnDanger}`}
            onClick={() => elements.length > 0 && setShowClearConfirm(true)}
            disabled={elements.length === 0}
            title="Clear all"
          >
            <Trash2 size={15} />
          </button>
        ) : (
          <div className={s.clearConfirm}>
            <span>Clear all?</span>
            <button className={s.clearYes} onClick={() => { dispatch(clearAll()); setShowClearConfirm(false); }}>Yes</button>
            <button className={s.clearNo}  onClick={() => setShowClearConfirm(false)}>No</button>
          </div>
        )}

        {/* Import */}
        <div className={s.dropdown}>
          <button className={s.iconBtn} onClick={() => setImportOpen(!importOpen)} title="Import">
            <span className={s.dropTrigger}><Upload size={15} /><ChevronDown size={11} /></span>
          </button>
          {importOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setImportOpen(false)} />
              <div className={s.dropdownMenu}>
                <button className={s.dropdownItem} onClick={() => { fileRef.current?.click(); setImportOpen(false); }}>
                  <FileJson size={13} /> Import from file
                </button>
                <button className={s.dropdownItem} onClick={handleImportClipboard}>
                  <Upload size={13} /> Import from clipboard
                </button>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>

        {/* Export */}
        <button className={s.btnOutline} onClick={handleExport} title="Export JSON">
          <Download size={13} /> Export
        </button>

        {/* Save */}
        <button className={`${s.btnSave} ${saveSuccess ? s.btnSaved : ''}`} onClick={handleSave}>
          <Save size={13} />
          {saveSuccess ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}
