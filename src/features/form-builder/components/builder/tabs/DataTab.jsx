import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import useFormStore from '@/store/useFormStore';
import { Toggle } from './GeneralTab';

const inputCls = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#07bf9b] focus:ring-1 focus:ring-[#07bf9b]/20 transition-colors bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

const HAS_OPTIONS = ['select', 'multiselect', 'checkboxgroup', 'radiogroup', 'tags'];
const HAS_SLIDER = ['slider', 'rangeslider'];

export default function DataTab({ element }) {
  const { updateElement } = useFormStore();
  const up = (key, val) => updateElement(element.id, { [key]: val });
  const hasOptions = HAS_OPTIONS.includes(element.type);
  const isSlider = HAS_SLIDER.includes(element.type);

  return (
    <div className="p-4">
      {/* Default value */}
      {!hasOptions && !isSlider && !['checkbox', 'toggle', 'file', 'multifile', 'image', 'multiimage', 'heading', 'paragraph', 'divider', 'button', 'submit', 'reset', 'link', 'signature'].includes(element.type) && (
        <div className="mb-3">
          <label className={labelCls}>Default value</label>
          <input
            className={inputCls}
            value={element.defaultValue || ''}
            onChange={(e) => up('defaultValue', e.target.value)}
            placeholder="Default value"
          />
        </div>
      )}

      {/* Slider config */}
      {isSlider && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className={labelCls}>Min</label>
              <input className={inputCls} type="number" value={element.min ?? 0} onChange={(e) => up('min', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Max</label>
              <input className={inputCls} type="number" value={element.max ?? 100} onChange={(e) => up('max', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Step</label>
              <input className={inputCls} type="number" min={1} value={element.step ?? 1} onChange={(e) => up('step', Number(e.target.value))} />
            </div>
          </div>
          {element.type === 'slider' && (
            <div className="mb-3">
              <label className={labelCls}>Default value</label>
              <input className={inputCls} type="number" value={element.defaultValue ?? 50} onChange={(e) => up('defaultValue', Number(e.target.value))} />
            </div>
          )}
          {element.type === 'rangeslider' && (
            <div className="mb-3">
              <label className={labelCls}>Default range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  type="number"
                  value={Array.isArray(element.defaultValue) ? element.defaultValue[0] : 20}
                  onChange={(e) => up('defaultValue', [Number(e.target.value), Array.isArray(element.defaultValue) ? element.defaultValue[1] : 80])}
                  placeholder="From"
                />
                <input
                  className={inputCls}
                  type="number"
                  value={Array.isArray(element.defaultValue) ? element.defaultValue[1] : 80}
                  onChange={(e) => up('defaultValue', [Array.isArray(element.defaultValue) ? element.defaultValue[0] : 20, Number(e.target.value)])}
                  placeholder="To"
                />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-600">Show tooltip</span>
            <Toggle value={element.showTooltip !== false} onChange={(v) => up('showTooltip', v)} />
          </div>
        </>
      )}

      {/* Toggle config */}
      {element.type === 'toggle' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className={labelCls}>True label</label>
            <input className={inputCls} value={element.trueLabel || 'Yes'} onChange={(e) => up('trueLabel', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>False label</label>
            <input className={inputCls} value={element.falseLabel || 'No'} onChange={(e) => up('falseLabel', e.target.value)} />
          </div>
        </div>
      )}

      {/* Options (for select/radio/checkbox group) */}
      {hasOptions && (
        <OptionsEditor
          options={element.options || []}
          onChange={(opts) => up('options', opts)}
          type={element.type}
        />
      )}

      {/* Searchable */}
      {['select', 'multiselect', 'tags'].includes(element.type) && (
        <div className="flex items-center justify-between py-2 border-t border-slate-100 mt-2">
          <span className="text-xs font-medium text-slate-600">Searchable</span>
          <Toggle value={element.searchable !== false} onChange={(v) => up('searchable', v)} />
        </div>
      )}

      {/* File config */}
      {['file', 'multifile', 'image', 'multiimage'].includes(element.type) && (
        <>
          <div className="mb-3">
            <label className={labelCls}>Accepted types</label>
            <input
              className={inputCls}
              value={element.accept || ''}
              onChange={(e) => up('accept', e.target.value)}
              placeholder="e.g. image/*, .pdf, .docx"
            />
          </div>
          <div className="mb-3">
            <label className={labelCls}>Max size (MB)</label>
            <input className={inputCls} type="number" min={1} value={element.maxSize || 5} onChange={(e) => up('maxSize', Number(e.target.value))} />
          </div>
          {['multifile', 'multiimage'].includes(element.type) && (
            <div className="mb-3">
              <label className={labelCls}>Max files</label>
              <input className={inputCls} type="number" min={1} value={element.maxFiles || 10} onChange={(e) => up('maxFiles', Number(e.target.value))} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange, type }) {
  const [newLabel, setNewLabel] = useState('');

  const addOption = () => {
    const label = newLabel.trim() || `Option ${options.length + 1}`;
    const value = label.toLowerCase().replace(/\s+/g, '_');
    onChange([...options, { label, value }]);
    setNewLabel('');
  };

  const updateOption = (idx, field, val) => {
    const updated = options.map((opt, i) => i === idx ? { ...opt, [field]: val } : opt);
    onChange(updated);
  };

  const removeOption = (idx) => onChange(options.filter((_, i) => i !== idx));

  const moveOption = (idx, dir) => {
    const arr = [...options];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    onChange(arr);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={`${labelCls} mb-0`}>Options</label>
        <span className="text-[10px] text-slate-400">{options.length} items</span>
      </div>

      <div className="space-y-1.5 mb-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-1.5 group">
            <button
              onClick={() => moveOption(idx, -1)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-slate-500 transition-opacity"
              title="Move up"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <input
              className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#07bf9b]"
              value={opt.label || ''}
              onChange={(e) => updateOption(idx, 'label', e.target.value)}
              placeholder="Label"
            />
            <input
              className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#07bf9b] text-slate-400"
              value={opt.value || ''}
              onChange={(e) => updateOption(idx, 'value', e.target.value)}
              placeholder="Value"
            />
            <button
              onClick={() => removeOption(idx)}
              className="p-1 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new option */}
      <div className="flex items-center gap-1.5">
        <input
          className="flex-1 px-2 py-1 text-xs border border-dashed border-slate-200 rounded focus:outline-none focus:border-[#07bf9b] bg-slate-50"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOption()}
          placeholder="New option label..."
        />
        <button
          onClick={addOption}
          className="flex items-center gap-1 px-2 py-1 text-xs text-white rounded transition-colors"
          style={{ backgroundColor: '#07bf9b' }}
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}
