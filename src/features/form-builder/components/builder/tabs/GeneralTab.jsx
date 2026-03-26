import useFormStore from '@/store/useFormStore';

const inputCls = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#07bf9b] focus:ring-1 focus:ring-[#07bf9b]/20 transition-colors bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
const fieldCls = 'mb-3';

function FormField({ label, hint, children }) {
  return (
    <div className={fieldCls}>
      {label && <label className={labelCls}>{label}</label>}
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const TEXT_INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'tel', label: 'Tel' },
  { value: 'password', label: 'Password' },
  { value: 'url', label: 'URL' },
  { value: 'search', label: 'Search' },
  { value: 'color', label: 'Color' },
];

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

export default function GeneralTab({ element }) {
  const { updateElement } = useFormStore();
  const up = (key, val) => updateElement(element.id, { [key]: val });

  const isInput = ['text', 'number', 'email', 'phone', 'password', 'url', 'location'].includes(element.type);
  const hasPlaceholder = ['text', 'number', 'email', 'phone', 'password', 'url', 'location', 'textarea', 'select', 'multiselect', 'tags', 'signature'].includes(element.type);
  const isStatic = ['heading', 'paragraph', 'divider', 'button', 'submit', 'reset', 'link'].includes(element.type);

  return (
    <div className="p-4 space-y-0">
      {/* Field name (identifier) */}
      <FormField label="Field name" hint="Used as the key in form data">
        <input
          className={inputCls}
          value={element.name || ''}
          onChange={(e) => up('name', e.target.value)}
          placeholder="field_name"
        />
      </FormField>

      {/* Label */}
      {!['divider'].includes(element.type) && (
        <FormField label="Label">
          <input
            className={inputCls}
            value={element.label || ''}
            onChange={(e) => up('label', e.target.value)}
            placeholder="Field label"
          />
        </FormField>
      )}

      {/* Heading level */}
      {element.type === 'heading' && (
        <FormField label="Heading level">
          <select className={inputCls} value={element.headingLevel || 'h2'} onChange={(e) => up('headingLevel', e.target.value)}>
            {HEADING_LEVELS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </FormField>
      )}

      {/* Heading / Paragraph / Link content */}
      {['heading', 'paragraph'].includes(element.type) && (
        <FormField label="Content">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={element.content || ''}
            onChange={(e) => up('content', e.target.value)}
            placeholder={element.type === 'heading' ? 'Heading text' : 'Paragraph text'}
          />
        </FormField>
      )}

      {/* Button label */}
      {['button', 'submit', 'reset'].includes(element.type) && (
        <FormField label="Button label">
          <input
            className={inputCls}
            value={element.buttonLabel || ''}
            onChange={(e) => up('buttonLabel', e.target.value)}
          />
        </FormField>
      )}

      {/* Button variant */}
      {['button', 'submit', 'reset'].includes(element.type) && (
        <FormField label="Variant">
          <select className={inputCls} value={element.buttonVariant || 'primary'} onChange={(e) => up('buttonVariant', e.target.value)}>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="danger">Danger</option>
          </select>
        </FormField>
      )}

      {/* Link */}
      {element.type === 'link' && (
        <>
          <FormField label="Link text">
            <input className={inputCls} value={element.linkText || ''} onChange={(e) => up('linkText', e.target.value)} />
          </FormField>
          <FormField label="URL">
            <input className={inputCls} value={element.linkUrl || ''} onChange={(e) => up('linkUrl', e.target.value)} placeholder="https://" />
          </FormField>
        </>
      )}

      {/* Input type (for text) */}
      {element.type === 'text' && (
        <FormField label="Input type">
          <select className={inputCls} value={element.inputType || 'text'} onChange={(e) => up('inputType', e.target.value)}>
            {TEXT_INPUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormField>
      )}

      {/* Placeholder */}
      {hasPlaceholder && (
        <FormField label="Placeholder">
          <input
            className={inputCls}
            value={element.placeholder || ''}
            onChange={(e) => up('placeholder', e.target.value)}
            placeholder="Placeholder text"
          />
        </FormField>
      )}

      {/* Checkbox text */}
      {element.type === 'checkbox' && (
        <FormField label="Checkbox text">
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={element.text || ''}
            onChange={(e) => up('text', e.target.value)}
          />
        </FormField>
      )}

      {/* Textarea rows */}
      {element.type === 'textarea' && (
        <FormField label="Rows">
          <input
            className={inputCls}
            type="number"
            min={1}
            max={20}
            value={element.rows || 3}
            onChange={(e) => up('rows', Number(e.target.value))}
          />
        </FormField>
      )}

      {/* Tooltip */}
      {!isStatic && (
        <FormField label="Tooltip">
          <input
            className={inputCls}
            value={element.tooltip || ''}
            onChange={(e) => up('tooltip', e.target.value)}
            placeholder="Hover hint text"
          />
        </FormField>
      )}

      {/* Description */}
      {!isStatic && (
        <FormField label="Description" hint="Shown below the input">
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={element.description || ''}
            onChange={(e) => up('description', e.target.value)}
            placeholder="Additional description"
          />
        </FormField>
      )}

      {/* Show label toggle */}
      <div className="flex items-center justify-between py-2">
        <span className="text-xs font-medium text-slate-600">Show label</span>
        <Toggle value={element.showLabel !== false} onChange={(v) => up('showLabel', v)} />
      </div>
    </div>
  );
}

export function Toggle({ value, onChange, size = 'sm' }) {
  const s = size === 'sm' ? { track: 'w-8 h-4', thumb: 'w-3 h-3', on: 'translate-x-4' } : { track: 'w-10 h-5', thumb: 'w-4 h-4', on: 'translate-x-5' };
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`${s.track} rounded-full relative transition-colors flex-shrink-0`}
      style={{ backgroundColor: value ? '#07bf9b' : '#cbd5e1' }}
    >
      <span className={`${s.thumb} rounded-full bg-white shadow absolute top-0.5 left-0.5 transition-transform ${value ? s.on : ''}`} />
    </button>
  );
}
