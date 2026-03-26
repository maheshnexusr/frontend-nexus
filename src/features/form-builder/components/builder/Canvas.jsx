import { useRef, useState, useCallback } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useDispatch, useSelector } from 'react-redux';
import { addElement, moveElement, deselectElement, selectElements } from '@/features/form-builder/store/formSlice';
import { createField } from '@/features/form-builder/lib/fieldSchema';
import CanvasElement from './CanvasElement';
import s from './Canvas.module.css';

export default function Canvas() {
  const dispatch  = useDispatch();
  const elements  = useSelector(selectElements);
  const [dropIndex, setDropIndex]   = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef(null);

  const calcIndex = useCallback((clientY) => {
    if (!containerRef.current) return elements.length;
    const items = containerRef.current.querySelectorAll('[data-element-item]');
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return elements.length;
  }, [elements.length]);

  const onDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes('fieldtype')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
    setDropIndex(calcIndex(e.clientY));
  }, [calcIndex]);

  const onDragLeave = useCallback((e) => {
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
      setDropIndex(null);
    }
  }, []);

  const onDrop = useCallback((e) => {
    const ft = e.dataTransfer.getData('fieldtype');
    if (!ft) return;
    e.preventDefault();
    dispatch(addElement({ element: createField(ft), atIndex: calcIndex(e.clientY) }));
    setIsDragOver(false);
    setDropIndex(null);
  }, [calcIndex, dispatch]);

  const onDragEnd = useCallback(({ source, destination }) => {
    if (destination && source.droppableId === 'canvas' && destination.droppableId === 'canvas') {
      dispatch(moveElement({ fromIndex: source.index, toIndex: destination.index }));
    }
  }, [dispatch]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={s.outer} onClick={() => dispatch(deselectElement())}>
        <div className={s.inner}>
          <div
            ref={containerRef}
            className={`${s.card} ${isDragOver ? s.cardDragOver : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {dropIndex !== null && (
              <div
                className={s.dropLine}
                style={{ top: dropIndex === 0 ? 32 : undefined, bottom: dropIndex >= elements.length ? 32 : undefined }}
              >
                <span className={`${s.dropDot} ${s.dropDotLeft}`} />
                <span className={`${s.dropDot} ${s.dropDotRight}`} />
              </div>
            )}

            {elements.length === 0 ? (
              <div className={s.empty}>
                <div className={`${s.emptyIcon} ${isDragOver ? s.emptyIconActive : ''}`}>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className={s.emptyText}>
                  <p className={`${s.emptyTitle} ${isDragOver ? s.emptyTitleActive : ''}`}>
                    {isDragOver ? 'Release to add element' : 'Drag elements here'}
                  </p>
                  <p className={s.emptySubtitle}>Choose a field from the left panel</p>
                </div>
              </div>
            ) : (
              <Droppable droppableId="canvas">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={s.list}
                    style={{ background: snapshot.isDraggingOver ? '#f8fafc' : undefined, borderRadius: 8 }}
                  >
                    {elements.map((el, idx) => {
                      const SIZE_MAP = { '1/4': '25%', '1/3': '33.333%', '1/2': '50%' };
                      const w = el.shrinkElement ? (SIZE_MAP[el.elementSize] || '50%') : '100%';
                      return (
                        <div key={el.id} style={{ width: w, paddingRight: el.shrinkElement ? 12 : 0 }}>
                          <CanvasElement element={el} index={idx} />
                        </div>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
          <p className={s.hint}>Drag elements from the left · Click to select · Drag handle to reorder</p>
        </div>
      </div>
    </DragDropContext>
  );
}
