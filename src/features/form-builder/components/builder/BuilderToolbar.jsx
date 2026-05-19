/**
 * BuilderToolbar — sub-header below the main header, shown only in Builder
 * Mode. Holds insert actions (Visit/Page/Block/Field), undo/redo, save draft,
 * and version-history shortcut.
 */

import { useDispatch, useSelector } from 'react-redux';
import {
  Layers, FileText, Component, PlusSquare,
  Undo2, Redo2, Save, History,
} from 'lucide-react';
import {
  undo, redo,
  selectCanUndo, selectCanRedo, selectExportJSON,
} from '@/features/form-builder/store/formSlice';
import s from './BuilderLayout.module.css';

export default function BuilderToolbar() {
  const dispatch = useDispatch();
  const canUndo  = useSelector(selectCanUndo);
  const canRedo  = useSelector(selectCanRedo);
  const json     = useSelector(selectExportJSON);

  const handleSaveDraft = () => {
    localStorage.setItem('form-builder-autosave', json);
  };

  return (
    <div className={s.subbar}>
      <div className={s.subbarGroup}>
        <span className={s.subbarLabel}>Insert:</span>
        <button type="button" className={s.subbarBtn}>
          <Layers size={13} /> Visit
        </button>
        <button type="button" className={s.subbarBtn}>
          <FileText size={13} /> Page
        </button>
        <button type="button" className={s.subbarBtn}>
          <Component size={13} /> Block
        </button>
        <button type="button" className={s.subbarBtn}>
          <PlusSquare size={13} /> Field
        </button>
      </div>

      <div className={s.subbarSpacer} />

      <div className={s.subbarGroup}>
        <button
          type="button"
          className={s.subbarIconBtn}
          onClick={() => dispatch(undo())}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className={s.subbarIconBtn}
          onClick={() => dispatch(redo())}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={14} />
        </button>

        <span className={s.subbarDivider} />

        <button type="button" className={s.subbarBtn} onClick={handleSaveDraft}>
          <Save size={13} /> Save Draft
        </button>
        <button type="button" className={s.subbarBtn}>
          <History size={13} /> Version History
        </button>
      </div>
    </div>
  );
}
