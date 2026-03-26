import useFormStore from '@/store/useFormStore';
import { Toggle } from './GeneralTab';

const inputCls = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#07bf9b] focus:ring-1 focus:ring-[#07bf9b]/20 transition-colors bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div>
        <div className="text-xs font-medium text-slate-600">{label}</div>
        {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
      </div>
      <div className="flex-shrink-0 ml-2">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const AUTOCOMPLETE_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'username', label: 'Username' },
  { value: 'new-password', label: 'New password' },
  { value: 'current-password', label: 'Current password' },
  { value: 'tel', label: 'Telephone' },
  { value: 'address-line1', label: 'Address line 1' },
  { value: 'address-line2', label: 'Address line 2' },
  { value: 'postal-code', label: 'Postal code' },
  { value: 'country', label: 'Country' },
];

const NO_INTERACT = ['heading', 'paragraph', 'divider', 'link'];

export default function AttributesTab({ element }) {
  const { updateElement } = useFormStore();

  const upAttr = (key, val) => {
    updateElement(element.id, {
      attributes: { ...(element.attributes || {}), [key]: val },
    });
  };

  const attr = element.attributes || {};
  const isStatic = NO_INTERACT.includes(element.type);
  const isInput = ['text', 'number', 'email', 'phone', 'password', 'url', 'textarea'].includes(element.type);

  return (
    <div className="p-4">
      {/* Disabled */}
      {!isStatic && (
        <Row label="Disabled" hint="Prevent user interaction">
          <Toggle value={attr.disabled || false} onChange={(v) => upAttr('disabled', v)} />
        </Row>
      )}

      {/* Readonly */}
      {isInput && (
        <Row label="Readonly" hint="Value visible but not editable">
          <Toggle value={attr.readonly || false} onChange={(v) => upAttr('readonly', v)} />
        </Row>
      )}

      {/* Autofocus */}
      {!isStatic && (
        <Row label="Autofocus" hint="Focus this element on page load">
          <Toggle value={attr.autofocus || false} onChange={(v) => upAttr('autofocus', v)} />
        </Row>
      )}

      {/* Autocomplete */}
      {isInput && (
        <Field label="Autocomplete">
          <select className={inputCls} value={attr.autocomplete || ''} onChange={(e) => upAttr('autocomplete', e.target.value)}>
            {AUTOCOMPLETE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>
      )}

      {/* ID */}
      <Field label="ID" hint="HTML id attribute">
        <input
          className={inputCls}
          value={attr.id || ''}
          onChange={(e) => upAttr('id', e.target.value)}
          placeholder="element-id"
        />
      </Field>

      {/* Class */}
      <Field label="Class" hint="Additional CSS classes">
        <input
          className={inputCls}
          value={attr.class || ''}
          onChange={(e) => upAttr('class', e.target.value)}
          placeholder="custom-class another-class"
        />
      </Field>

      {/* Name attribute (different from field name identifier) */}
      {isInput && (
        <Field label="Name attribute" hint="HTML name attribute for form submission">
          <input
            className={inputCls}
            value={attr.name || element.name || ''}
            onChange={(e) => upAttr('name', e.target.value)}
            placeholder={element.name}
          />
        </Field>
      )}

      {/* Info box */}
      <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          These attributes are passed directly to the underlying HTML element.
          Use them for accessibility, custom behavior, or CSS targeting.
        </p>
      </div>
    </div>
  );
}
