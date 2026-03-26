import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import useFormStore from '@/store/useFormStore';
import { Toggle } from './GeneralTab';
import { VALIDATION_RULES } from '@/lib/fieldSchema';

const inputCls = 'w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#07bf9b] focus:ring-1 focus:ring-[#07bf9b]/20 transition-colors bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
      <div>
        <div className="text-xs font-medium text-slate-600">{label}</div>
        {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
      </div>
      <div className="flex-shrink-0 ml-2">{children}</div>
    </div>
  );
}

const VALIDATE_ON = [
  { value: 'change', label: 'On change' },
  { value: 'blur', label: 'On blur' },
  { value: 'submit', label: 'On submit' },
];

const NUMERIC_TYPES = ['number', 'slider', 'rangeslider'];
const TEXT_TYPES = ['text', 'email', 'password', 'url', 'textarea', 'editor'];
const NO_VALIDATION = ['heading', 'paragraph', 'divider', 'button', 'submit', 'reset', 'link'];

export default function ValidationTab({ element }) {
  const { updateElement } = useFormStore();

  const upValidation = (key, val) => {
    updateElement(element.id, {
      validation: { ...(element.validation || {}), [key]: val },
    });
  };

  const v = element.validation || {};
  const isNumeric = NUMERIC_TYPES.includes(element.type);
  const isText = TEXT_TYPES.includes(element.type);
  const noValidation = NO_VALIDATION.includes(element.type);

  if (noValidation) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[120px]">
        <p className="text-sm text-slate-400 text-center">This element type does not support validation.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Required */}
      <Row label="Required" hint="Field must be filled">
        <Toggle value={v.required || false} onChange={(val) => upValidation('required', val)} />
      </Row>

      {/* Nullable */}
      <Row label="Nullable" hint="Skip validation if empty">
        <Toggle value={v.nullable || false} onChange={(val) => upValidation('nullable', val)} />
      </Row>

      {/* Email validation */}
      {element.type === 'email' && (
        <Row label="Email format">
          <Toggle value={v.email !== false} onChange={(val) => upValidation('email', val)} />
        </Row>
      )}

      {/* URL validation */}
      {element.type === 'url' && (
        <Row label="URL format">
          <Toggle value={v.url !== false} onChange={(val) => upValidation('url', val)} />
        </Row>
      )}

      {/* Numeric validations */}
      {isNumeric && (
        <>
          <div className="py-2.5 border-b border-slate-100">
            <label className={labelCls}>Min value</label>
            <input
              className={inputCls}
              type="number"
              value={v.min || ''}
              onChange={(e) => upValidation('min', e.target.value)}
              placeholder="No minimum"
            />
          </div>
          <div className="py-2.5 border-b border-slate-100">
            <label className={labelCls}>Max value</label>
            <input
              className={inputCls}
              type="number"
              value={v.max || ''}
              onChange={(e) => upValidation('max', e.target.value)}
              placeholder="No maximum"
            />
          </div>
        </>
      )}

      {/* Text length validations */}
      {isText && (
        <>
          <div className="py-2.5 border-b border-slate-100">
            <label className={labelCls}>Min length</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              value={v.minLength || ''}
              onChange={(e) => upValidation('minLength', e.target.value)}
              placeholder="No minimum"
            />
          </div>
          <div className="py-2.5 border-b border-slate-100">
            <label className={labelCls}>Max length</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              value={v.maxLength || ''}
              onChange={(e) => upValidation('maxLength', e.target.value)}
              placeholder="No maximum"
            />
          </div>
          <div className="py-2.5 border-b border-slate-100">
            <label className={labelCls}>Pattern (regex)</label>
            <input
              className={inputCls}
              value={v.pattern || ''}
              onChange={(e) => upValidation('pattern', e.target.value)}
              placeholder="/^[a-z]+$/i"
            />
          </div>
        </>
      )}

      {/* Validate on */}
      <div className="py-2.5 border-b border-slate-100">
        <label className={labelCls}>Validate on</label>
        <div className="flex gap-1">
          {VALIDATE_ON.map((opt) => (
            <button
              key={opt.value}
              onClick={() => upValidation('validateOn', opt.value)}
              className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                (v.validateOn || 'submit') === opt.value
                  ? 'border-[#07bf9b] text-[#07bf9b] bg-[#07bf9b]/5'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom rules */}
      <div className="pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className={`${labelCls} mb-0`}>Custom rules</label>
        </div>
        <CustomRules rules={v.rules || []} onChange={(rules) => upValidation('rules', rules)} />
      </div>
    </div>
  );
}

function CustomRules({ rules, onChange }) {
  const [selectedRule, setSelectedRule] = useState('');

  const addRule = () => {
    if (!selectedRule) return;
    onChange([...rules, { rule: selectedRule, value: '' }]);
    setSelectedRule('');
  };

  const updateRule = (idx, field, val) => {
    onChange(rules.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const removeRule = (idx) => onChange(rules.filter((_, i) => i !== idx));

  const available = VALIDATION_RULES.filter((r) => !rules.find((existing) => existing.rule === r.value));

  return (
    <div className="space-y-1.5">
      {rules.map((rule, idx) => {
        const ruleInfo = VALIDATION_RULES.find((r) => r.value === rule.rule);
        const needsValue = ['min', 'max', 'min_length', 'max_length', 'between', 'in', 'not_in', 'regex', 'same', 'different', 'before', 'after'].includes(rule.rule);
        return (
          <div key={idx} className="flex items-center gap-1.5 group">
            <div
              className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-50"
            >
              <span className="text-xs font-medium text-slate-600">{ruleInfo?.label || rule.rule}</span>
              {needsValue && (
                <>
                  <span className="text-xs text-slate-400">:</span>
                  <input
                    className="flex-1 text-xs bg-transparent border-none outline-none text-slate-600"
                    value={rule.value || ''}
                    onChange={(e) => updateRule(idx, 'value', e.target.value)}
                    placeholder="value"
                  />
                </>
              )}
            </div>
            <button onClick={() => removeRule(idx)} className="p-1 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {available.length > 0 && (
        <div className="flex gap-1.5">
          <select
            className="flex-1 px-2 py-1.5 text-xs border border-dashed border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:border-[#07bf9b]"
            value={selectedRule}
            onChange={(e) => setSelectedRule(e.target.value)}
          >
            <option value="">Add rule...</option>
            {available.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={addRule}
            disabled={!selectedRule}
            className="px-2 py-1 text-xs text-white rounded disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#07bf9b' }}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
