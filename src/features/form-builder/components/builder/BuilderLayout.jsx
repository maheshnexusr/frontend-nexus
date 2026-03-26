import { useSelector } from 'react-redux';
import { selectMode } from '@/features/form-builder/store/formSlice';
import Toolbar from './Toolbar';
import LeftPanel from './LeftPanel';
import Canvas from './Canvas';
import RightSidebar from './RightSidebar';
import PreviewMode from './PreviewMode';
import CodeView from './CodeView';
import ModelView from './ModelView';
import s from './BuilderLayout.module.css';

export default function BuilderLayout() {
  const mode = useSelector(selectMode);

  return (
    <div className={s.root}>
      <Toolbar />
      <div className={s.body}>
        <LeftPanel />
        {mode === 'editor'  && <Canvas />}
        {mode === 'preview' && <PreviewMode />}
        {mode === 'code'    && <CodeView />}
        {mode === 'model'   && <ModelView />}
        {mode === 'editor'  && <RightSidebar />}
      </div>
    </div>
  );
}
