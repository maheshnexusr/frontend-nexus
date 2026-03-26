import useFormStore from '@/store/useFormStore';
import { Toggle } from './GeneralTab';

const inputCls = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#07bf9b] focus:ring-1 focus:ring-[#07bf9b]/20 transition-colors bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

const SIZE_OPTIONS = [
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
];

export default function LayoutTab({ element }) {
  const { updateElement } = useFormStore();
  const up = (key, val) => updateElement(element.id, { [key]: val });

  const isStatic = ['heading', 'paragraph', 'divider', 'button', 'submit', 'reset', 'link'].includes(element.type);

  return (
    <div className="p-4">
      {/* Size */}
      {!['divider', 'heading', 'paragraph'].includes(element.type) && (
        <div className="mb-4">
          <label className={labelCls}>Size</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => up('size', opt.value)}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  (element.size || 'md') === opt.value
                    ? 'text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
                style={(element.size || 'md') === opt.value ? { backgroundColor: '#07bf9b' } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Columns */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className={`${labelCls} mb-0`}>Columns</label>
          <span className="text-xs font-medium" style={{ color: '#07bf9b' }}>{element.columns || 12}/12</span>
        </div>
        <input
          type="range"
          min={1}
          max={12}
          value={element.columns || 12}
          onChange={(e) => up('columns', Number(e.target.value))}
          className="w-full accent-[#07bf9b]"
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          {[1, 2, 3, 4, 6, 8, 9, 10, 12].map((n) => (
            <button key={n} onClick={() => up('columns', n)} className="hover:text-slate-600 transition-colors">{n}</button>
          ))}
        </div>
      </div>

      {/* Label columns (only for fields with labels) */}
      {!isStatic && element.showLabel !== false && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelCls} mb-0`}>Label columns</label>
            <span className="text-xs font-medium" style={{ color: '#07bf9b' }}>{element.labelColumns || 3}/12</span>
          </div>
          <input
            type="range"
            min={1}
            max={11}
            value={element.labelColumns || 3}
            onChange={(e) => up('labelColumns', Number(e.target.value))}
            className="w-full accent-[#07bf9b]"
          />
        </div>
      )}

      {/* Toggles */}
      {!isStatic && (
        <>
          <Row label="Show label">
            <Toggle value={element.showLabel !== false} onChange={(v) => up('showLabel', v)} />
          </Row>
          <Row label="Show description">
            <Toggle value={element.showDescription !== false} onChange={(v) => up('showDescription', v)} />
          </Row>
        </>
      )}

      {/* Alignment (for static/button elements) */}
      {['heading', 'paragraph', 'button', 'submit', 'reset', 'link'].includes(element.type) && (
        <div className="mt-4">
          <label className={labelCls}>Alignment</label>
          <div className="flex gap-1">
            {['left', 'center', 'right'].map((align) => (
              <button
                key={align}
                onClick={() => up('align', align)}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors capitalize ${
                  (element.align || 'left') === align
                    ? 'border-[#07bf9b] text-[#07bf9b] bg-[#07bf9b]/5'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
