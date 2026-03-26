import { Draggable } from '@hello-pangea/dnd';
import { Copy, Trash2, GripVertical } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectElement, removeElement, duplicateElement, selectSelectedId } from '@/features/form-builder/store/formSlice';
import ElementRenderer from './ElementRenderer';
import s from './CanvasElement.module.css';

export default function CanvasElement({ element, index }) {
  const dispatch    = useDispatch();
  const selectedId  = useSelector(selectSelectedId);
  const isSelected  = selectedId === element.id;
  const isShrunk    = element.shrinkElement && element.elementSize;

  return (
    <Draggable draggableId={element.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-element-item
          className={`${s.wrap} ${isSelected ? s.wrapSelected : s.wrapHover} ${snapshot.isDragging ? s.wrapDragging : ''}`}
          onClick={(e) => { e.stopPropagation(); dispatch(selectElement(element.id)); }}
        >
          {/* Drag handle */}
          <div {...provided.dragHandleProps} className={s.handle}>
            <GripVertical size={13} />
          </div>

          {/* Name badge */}
          <div className={s.nameBadge}>
            <span className={s.badge}>{element.name}</span>
          </div>

          {/* Size pill (shrunk + selected) */}
          {isShrunk && isSelected && (
            <span className={s.sizePill}>{element.elementSize}</span>
          )}

          {/* Action buttons */}
          <div className={s.actions}>
            <button className={s.actionBtn} title="Duplicate" onClick={(e) => { e.stopPropagation(); dispatch(duplicateElement(element.id)); }}>
              <Copy size={11} />
            </button>
            <button className={`${s.actionBtn} ${s.actionBtnDel}`} title="Delete" onClick={(e) => { e.stopPropagation(); dispatch(removeElement(element.id)); }}>
              <Trash2 size={11} />
            </button>
          </div>

          {/* Green accent bar */}
          {isSelected && <div className={s.accent} />}

          {/* Field preview */}
          <div className={`${s.content} ${isSelected ? s.contentSelected : ''}`}>
            <ElementRenderer element={element} />
          </div>
        </div>
      )}
    </Draggable>
  );
}
