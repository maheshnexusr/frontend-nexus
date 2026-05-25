/**
 * BuilderLayout — three-column form-builder shell.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  BuilderHeader   (brand · search · mode toggle · publish · user) │
 *   │  BuilderToolbar  (insert · undo/redo · save · history)  [builder]│
 *   ├──────────┬──────────────────────────────────────────┬────────────┤
 *   │  Left    │  Center                                  │  Right     │
 *   └──────────┴──────────────────────────────────────────┴────────────┘
 *
 * Mode wiring:
 *
 *   ─ Builder Mode (`editor`) ───────────────────────────────────────────
 *     Left   : LeftPanel     (existing element palette — drag fields)
 *     Center : Canvas        (existing drag-drop canvas)
 *     Right  : RightSidebar  (existing field properties)
 *
 *   ─ Preview Mode (`preview`) ──────────────────────────────────────────
 *     Left   : BuilderNavTree     (visit / form / query tree)
 *     Center : BuilderCanvas      (rendered form preview)
 *     Right  : BuilderQueryPanel  (Q-10234 details + actions)
 *
 * The existing form-builder behaviour (palette, drag-drop, field props) is
 * unchanged in Builder Mode — only the wrapping chrome (header, sub-toolbar)
 * and Preview Mode are new.
 */

import { useSelector } from 'react-redux';
import { selectMode } from '@/features/form-builder/store/formSlice';
import BuilderHeader     from './BuilderHeader';
import BuilderToolbar    from './BuilderToolbar';
import LeftPanel         from './LeftPanel';
import Canvas            from './Canvas';
import RightSidebar      from './RightSidebar';
import BuilderNavTree    from './BuilderNavTree';
import BuilderCanvas     from './BuilderCanvas';
import BuilderQueryPanel from './BuilderQueryPanel';
import s from './BuilderLayout.module.css';

export default function BuilderLayout() {
  const mode      = useSelector(selectMode);
  const isBuilder = mode !== 'preview';

  return (
    <div className={s.root}>
      <BuilderHeader />
      {isBuilder && <BuilderToolbar />}
      <div className={s.body}>
        {isBuilder ? (
          <>
            <LeftPanel />
            <Canvas />
            <RightSidebar />
          </>
        ) : (
          <>
            <BuilderNavTree />
            <BuilderCanvas />
            <BuilderQueryPanel />
          </>
        )}
      </div>
    </div>
  );
}
