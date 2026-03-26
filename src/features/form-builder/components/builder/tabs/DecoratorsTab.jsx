import useFormStore from '@/store/useFormStore';

const inputCls = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#07bf9b] focus:ring-1 focus:ring-[#07bf9b]/20 transition-colors bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      {label && <label className={labelCls}>{label}</label>}
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function DecoratorsTab({ element }) {
  const { updateElement } = useFormStore();

  const updateDecorator = (key, val) => {
    updateElement(element.id, {
      decorators: { ...(element.decorators || {}), [key]: val },
    });
  };

  const dec = element.decorators || {};

  const ICONS = ['', '🔍', '📧', '📱', '🌐', '🔑', '📅', '💰', '@', '#', '%', '$', '€', '£', '→', '✓'];

  return (
    <div className="p-4">
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Add prefix/suffix addons or content before/after the element.
      </p>

      {/* Prefix */}
      <Field label="Prefix" hint="Text or icon shown before the input">
        <div className="flex gap-1.5">
          <input
            className={inputCls}
            value={dec.prefix || ''}
            onChange={(e) => updateDecorator('prefix', e.target.value)}
            placeholder="e.g. https://"
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {ICONS.filter(Boolean).map((icon) => (
            <button
              key={icon}
              onClick={() => updateDecorator('prefix', icon)}
              className={`px-1.5 py-0.5 text-sm rounded border transition-colors ${dec.prefix === icon ? 'border-[#07bf9b] bg-[#07bf9b]/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </Field>

      {/* Suffix */}
      <Field label="Suffix" hint="Text or icon shown after the input">
        <input
          className={inputCls}
          value={dec.suffix || ''}
          onChange={(e) => updateDecorator('suffix', e.target.value)}
          placeholder="e.g. .com"
        />
        <div className="flex flex-wrap gap-1 mt-1">
          {ICONS.filter(Boolean).map((icon) => (
            <button
              key={icon}
              onClick={() => updateDecorator('suffix', icon)}
              className={`px-1.5 py-0.5 text-sm rounded border transition-colors ${dec.suffix === icon ? 'border-[#07bf9b] bg-[#07bf9b]/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </Field>

      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Surrounding content</p>

        {/* Before */}
        <Field label="Before" hint="Content rendered before the element wrapper">
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={dec.before || ''}
            onChange={(e) => updateDecorator('before', e.target.value)}
            placeholder="Content before element"
          />
        </Field>

        {/* After */}
        <Field label="After" hint="Content rendered after the element wrapper">
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={dec.after || ''}
            onChange={(e) => updateDecorator('after', e.target.value)}
            placeholder="Content after element"
          />
        </Field>
      </div>
    </div>
  );
}
