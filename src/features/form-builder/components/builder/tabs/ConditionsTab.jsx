import { Plus, Trash2, Info } from 'lucide-react';
import useFormStore from '@/store/useFormStore';
import { Toggle } from './GeneralTab';
import { OPERATORS } from '@/lib/fieldSchema';

const inputCls = 'w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-[#07bf9b] transition-colors bg-white';

const OPERATORS_NEEDING_VALUE = OPERATORS.filter((o) => !['empty', 'not_empty'].includes(o.value)).map((o) => o.value);

export default function ConditionsTab({ element }) {
  const { updateElement, elements } = useFormStore();

  const upConditions = (updates) => {
    updateElement(element.id, {
      conditions: { ...(element.conditions || {}), ...updates },
    });
  };

  const cond = element.conditions || { enabled: false, logic: 'AND', rules: [] };
  const rules = cond.rules || [];

  // All other elements available as condition sources
  const availableFields = elements.filter((e) => e.id !== element.id);

  const addRule = () => {
    const newRule = {
      field: availableFields[0]?.name || '',
      operator: '==',
      value: '',
    };
    upConditions({ rules: [...rules, newRule] });
  };

  const updateRule = (idx, key, val) => {
    const updated = rules.map((r, i) => (i === idx ? { ...r, [key]: val } : r));
    upConditions({ rules: updated });
  };

  const removeRule = (idx) => {
    upConditions({ rules: rules.filter((_, i) => i !== idx) });
  };

  return (
    <div className="p-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <div className="text-xs font-medium text-slate-700">Enable conditions</div>
          <div className="text-[10px] text-slate-400">Show/hide this element based on other fields</div>
        </div>
        <Toggle value={cond.enabled || false} onChange={(v) => upConditions({ enabled: v })} />
      </div>

      {!cond.enabled ? (
        <div className="py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Info className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-xs text-slate-400">Enable conditions to control when this element is visible</p>
        </div>
      ) : (
        <>
          {/* AND / OR toggle */}
          <div className="mb-4">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Logic operator
            </label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {['AND', 'OR'].map((logic) => (
                <button
                  key={logic}
                  onClick={() => upConditions({ logic })}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    cond.logic === logic
                      ? 'text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={cond.logic === logic ? { backgroundColor: '#07bf9b' } : {}}
                >
                  {logic}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {cond.logic === 'AND'
                ? 'All conditions must be true to show this element'
                : 'At least one condition must be true to show this element'}
            </p>
          </div>

          {/* Rules list */}
          {rules.length === 0 ? (
            <div className="py-4 text-center border-2 border-dashed border-slate-200 rounded-lg mb-3">
              <p className="text-xs text-slate-400">No conditions yet</p>
            </div>
          ) : (
            <div className="space-y-3 mb-3">
              {rules.map((rule, idx) => (
                <ConditionRule
                  key={idx}
                  rule={rule}
                  idx={idx}
                  availableFields={availableFields}
                  onUpdate={updateRule}
                  onRemove={removeRule}
                  showLogicLabel={idx > 0}
                  logic={cond.logic}
                />
              ))}
            </div>
          )}

          {/* Add condition */}
          <button
            onClick={addRule}
            disabled={availableFields.length === 0}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-dashed rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: '#07bf9b', color: '#07bf9b' }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#07bf9b10')}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
          >
            <Plus className="w-3.5 h-3.5" />
            Add condition
          </button>

          {availableFields.length === 0 && (
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Add more elements to the form to use as conditions
            </p>
          )}

          {/* Summary */}
          {rules.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Summary</p>
              <p className="text-xs text-slate-500">
                Show this element when{' '}
                <span className="font-medium text-slate-700">
                  {cond.logic === 'AND' ? 'all' : 'any'} of the following{' '}
                  {rules.length === 1 ? 'condition is' : `${rules.length} conditions are`} met
                </span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConditionRule({ rule, idx, availableFields, onUpdate, onRemove, showLogicLabel, logic }) {
  const needsValue = OPERATORS_NEEDING_VALUE.includes(rule.operator);

  return (
    <div className="relative">
      {showLogicLabel && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: '#07bf9b' }}>
            {logic}
          </span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 group">
        {/* IF label + delete */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IF</span>
          <button
            onClick={() => onRemove(idx)}
            className="p-0.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Field selector */}
        <select
          className={inputCls}
          value={rule.field}
          onChange={(e) => onUpdate(idx, 'field', e.target.value)}
        >
          <option value="">Select field...</option>
          {availableFields.map((f) => (
            <option key={f.id} value={f.name}>
              {f.label || f.name}
            </option>
          ))}
        </select>

        {/* Operator selector */}
        <select
          className={inputCls}
          value={rule.operator}
          onChange={(e) => onUpdate(idx, 'operator', e.target.value)}
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>

        {/* Value input */}
        {needsValue && (
          <input
            className={inputCls}
            value={rule.value || ''}
            onChange={(e) => onUpdate(idx, 'value', e.target.value)}
            placeholder="Expected value"
          />
        )}
      </div>
    </div>
  );
}
