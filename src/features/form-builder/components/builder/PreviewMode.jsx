import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectElements, selectFormSettings } from '@/features/form-builder/store/formSlice';
import s from './PreviewMode.module.css';

function evalConditions(element, formData, allElements) {
  const { conditions } = element;
  if (!conditions?.enabled || !conditions.rules?.length) return true;
  const results = conditions.rules.map((rule) => {
    const val = formData[rule.field];
    switch (rule.operator) {
      case '==': return val == rule.value;
      case '!=': return val != rule.value;
      case '>':  return Number(val) > Number(rule.value);
      case '>=': return Number(val) >= Number(rule.value);
      case '<':  return Number(val) < Number(rule.value);
      case '<=': return Number(val) <= Number(rule.value);
      case '^':  return String(val||'').startsWith(rule.value);
      case '$':  return String(val||'').endsWith(rule.value);
      case '*':  return String(val||'').includes(rule.value);
      case 'in': return rule.value.split(',').map(v=>v.trim()).includes(String(val));
      case 'not_in': return !rule.value.split(',').map(v=>v.trim()).includes(String(val));
      case 'empty':     return !val || val==='' || (Array.isArray(val)&&val.length===0);
      case 'not_empty': return val && val!=='' && (!Array.isArray(val)||val.length>0);
      default: return true;
    }
  });
  return conditions.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

function TagInput({ value = [], onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = (tag) => { if (tag && !value.includes(tag)) onChange([...value, tag]); setInput(''); };
  return (
    <div className={s.tagsBox} onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
      {value.map((tag, i) => (
        <span key={i} className={s.tag}>
          {tag}
          <button type="button" className={s.tagDel} onClick={() => onChange(value.filter((_,j)=>j!==i))}>×</button>
        </span>
      ))}
      <input
        className={s.tagInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (['Enter',',','Tab'].includes(e.key)) { e.preventDefault(); add(input.trim()); } }}
        placeholder={value.length===0 ? (placeholder||'Type and press Enter…') : ''}
      />
    </div>
  );
}

function PreviewField({ element, value, onChange, error }) {
  const { type } = element;
  const hasLabel = element.showLabel !== false && element.label;

  const Wrap = ({ children }) => (
    <div className={s.fieldWrap}>
      {hasLabel && (
        <label className={s.label}>
          {element.label}
          {element.validation?.required && <span className={s.required}>*</span>}
          {element.tooltip && <span className={s.tooltip} title={element.tooltip}>(?)</span>}
        </label>
      )}
      {children}
      {element.description && <div className={s.desc}>{element.description}</div>}
    </div>
  );

  const inputCls = `${s.input} ${error ? s.inputError : ''}`;

  switch (type) {
    case 'text': case 'email': case 'phone': case 'url': case 'location':
      return <Wrap><input className={inputCls} type="text" placeholder={element.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} /></Wrap>;
    case 'number':
      return <Wrap><input className={inputCls} type="number" placeholder={element.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} /></Wrap>;
    case 'password':
      return <Wrap><input className={inputCls} type="password" placeholder={element.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} /></Wrap>;
    case 'textarea': case 'editor':
      return <Wrap><textarea className={`${inputCls} ${s.textarea||''}`} style={{resize:'none'}} rows={element.rows||4} placeholder={element.placeholder} value={value||''} onChange={e=>onChange(e.target.value)} /></Wrap>;
    case 'select':
      return (
        <Wrap>
          <select className={s.select} value={value||''} onChange={e=>onChange(e.target.value)}>
            <option value="">{element.placeholder||'Select…'}</option>
            {(element.options||[]).map((o,i)=><option key={i} value={o.value}>{o.label}</option>)}
          </select>
        </Wrap>
      );
    case 'multiselect':
      return (
        <Wrap>
          <select className={s.select} style={{minHeight:80}} multiple value={Array.isArray(value)?value:[]} onChange={e=>onChange(Array.from(e.target.selectedOptions,o=>o.value))}>
            {(element.options||[]).map((o,i)=><option key={i} value={o.value}>{o.label}</option>)}
          </select>
          <div className={s.desc}>Hold Ctrl/Cmd to select multiple</div>
        </Wrap>
      );
    case 'checkbox':
      return (
        <div className={s.fieldWrap}>
          <label className={s.checkRow}>
            <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} />
            <span className={s.checkText}>
              {element.text||element.label}
              {element.validation?.required && <span className={s.required}>*</span>}
            </span>
          </label>
          {element.description && <div className={s.desc}>{element.description}</div>}
        </div>
      );
    case 'checkboxgroup':
      return (
        <Wrap>
          <div className={s.optionList}>
            {(element.options||[]).map((o,i)=>(
              <label key={i} className={s.optionRow}>
                <input type="checkbox" checked={(Array.isArray(value)?value:[]).includes(o.value)}
                  onChange={e=>{ const arr=Array.isArray(value)?[...value]:[]; onChange(e.target.checked?[...arr,o.value]:arr.filter(v=>v!==o.value)); }} />
                <span className={s.optionLabel}>{o.label}</span>
              </label>
            ))}
          </div>
        </Wrap>
      );
    case 'radiogroup':
      return (
        <Wrap>
          <div className={s.optionList}>
            {(element.options||[]).map((o,i)=>(
              <label key={i} className={s.optionRow}>
                <input type="radio" name={element.name} value={o.value} checked={value===o.value} onChange={()=>onChange(o.value)} />
                <span className={s.optionLabel}>{o.label}</span>
              </label>
            ))}
          </div>
        </Wrap>
      );
    case 'toggle':
      return (
        <div className={s.fieldWrap}>
          {hasLabel && <label className={s.label}>{element.label}</label>}
          <div className={s.toggleRow}>
            <button type="button" className={s.toggleBtn} style={{background:value?'#07bf9b':'#cbd5e1'}} onClick={()=>onChange(!value)}>
              <span className={s.toggleThumb} style={{transform:value?'translateX(20px)':'translateX(0)'}} />
            </button>
            <span className={s.toggleVal}>{value?(element.trueLabel||'Yes'):(element.falseLabel||'No')}</span>
          </div>
        </div>
      );
    case 'tags':
      return <Wrap><TagInput value={Array.isArray(value)?value:[]} onChange={onChange} placeholder={element.placeholder} /></Wrap>;
    case 'date': case 'datetime': case 'time':
      return <Wrap><input className={inputCls} type={type==='time'?'time':type==='datetime'?'datetime-local':'date'} value={value||''} onChange={e=>onChange(e.target.value)} /></Wrap>;
    case 'dates': case 'daterange':
      return (
        <Wrap>
          <div className={s.dateRow}>
            <input className={inputCls} type="date" value={(Array.isArray(value)?value[0]:'')||''} onChange={e=>onChange([e.target.value,Array.isArray(value)?value[1]:''])} />
            {type==='daterange'&&<><span className={s.dateSep}>to</span><input className={inputCls} type="date" value={(Array.isArray(value)?value[1]:'')||''} onChange={e=>onChange([Array.isArray(value)?value[0]:'',e.target.value])} /></>}
          </div>
        </Wrap>
      );
    case 'slider':
      return (
        <Wrap>
          <input type="range" style={{width:'100%',accentColor:'#07bf9b'}} min={element.min??0} max={element.max??100} step={element.step??1} value={value??element.defaultValue??50} onChange={e=>onChange(Number(e.target.value))} />
          <div className={s.sliderLabels}><span>{element.min??0}</span><span className={s.sliderValue}>{value??element.defaultValue??50}</span><span>{element.max??100}</span></div>
        </Wrap>
      );
    case 'rangeslider': {
      const v = Array.isArray(value)?value:(element.defaultValue||[20,80]);
      return (
        <Wrap>
          <div className={s.sliderLabels}><span>From: <strong>{v[0]}</strong></span><span>To: <strong>{v[1]}</strong></span></div>
          <input type="range" style={{width:'100%',accentColor:'#07bf9b'}} min={element.min??0} max={element.max??100} step={element.step??1} value={v[0]} onChange={e=>onChange([Number(e.target.value),v[1]])} />
          <input type="range" style={{width:'100%',accentColor:'#07bf9b'}} min={element.min??0} max={element.max??100} step={element.step??1} value={v[1]} onChange={e=>onChange([v[0],Number(e.target.value)])} />
        </Wrap>
      );
    }
    case 'file': case 'multifile': case 'image': case 'multiimage':
      return <Wrap><input className={s.fileInput} type="file" accept={element.accept} multiple={['multifile','multiimage'].includes(type)} /></Wrap>;
    case 'signature':
      return <Wrap><div className={s.signBox}>{element.placeholder||'Sign here'}</div></Wrap>;
    case 'h1': return <h1 className={s.h1}>{element.content}</h1>;
    case 'h2': return <h2 className={s.h2}>{element.content}</h2>;
    case 'h3': return <h3 className={s.h3}>{element.content}</h3>;
    case 'paragraph': return <p className={s.para}>{element.content}</p>;
    case 'divider':   return <hr className={s.divider} />;
    case 'spacer':    return <div style={{height:element.height||24}} />;
    case 'button': {
      const cls = element.buttonVariant==='secondary'?s.btnSecondary:s.btnPrimary;
      return <div className={s.fieldWrap}>{hasLabel&&<label className={s.label}>{element.label}</label>}<button type="button" className={cls}>{element.buttonLabel}</button></div>;
    }
    case 'link':
      return <div className={s.fieldWrap}>{hasLabel&&<label className={s.label}>{element.label}</label>}<a href={element.linkUrl||'#'} className={s.link}>{element.linkText||'Click here'}</a></div>;
    default:
      return <Wrap><input className={inputCls} placeholder={element.placeholder||element.label} value={value||''} onChange={e=>onChange(e.target.value)} /></Wrap>;
  }
}

export default function PreviewMode() {
  const elements     = useSelector(selectElements);
  const formSettings = useSelector(selectFormSettings);
  const [formData, setFormData]     = useState({});
  const [submitted, setSubmitted]   = useState(false);
  const [errors, setErrors]         = useState({});

  const setValue = (name, val) => {
    setFormData(prev => ({...prev,[name]:val}));
    if (errors[name]) setErrors(prev => ({...prev,[name]:null}));
  };

  const validate = () => {
    const errs = {};
    elements.forEach(el => {
      if (!evalConditions(el, formData, elements)) return;
      const val = formData[el.name];
      if (el.validation?.required && (!val || val==='' || (Array.isArray(val)&&val.length===0)))
        errs[el.name] = `${el.label||el.name} is required`;
      if (el.validation?.email && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
        errs[el.name] = 'Invalid email address';
      if (el.validation?.minLength && val && String(val).length < Number(el.validation.minLength))
        errs[el.name] = `Minimum ${el.validation.minLength} characters required`;
      if (el.validation?.maxLength && val && String(val).length > Number(el.validation.maxLength))
        errs[el.name] = `Maximum ${el.validation.maxLength} characters allowed`;
    });
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className={s.success}>
        <div className={s.successCard}>
          <div className={s.successIcon}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className={s.successTitle}>Form Submitted!</h2>
          <p className={s.successMsg}>{formSettings.successMessage||'Thank you for your submission.'}</p>
          <button className={s.resetBtn} onClick={()=>{setSubmitted(false);setFormData({});setErrors({});}}>Reset Form</button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.outer}>
      <div className={s.inner}>
        <div className={s.card}>
          {(formSettings.title||formSettings.description) && (
            <div className={s.formHeader}>
              {formSettings.title && <h1 className={s.formTitle}>{formSettings.title}</h1>}
              {formSettings.description && <p className={s.formDesc}>{formSettings.description}</p>}
            </div>
          )}
          <form className={s.form} onSubmit={handleSubmit}>
            {elements.length === 0
              ? <div className={s.empty}>No elements to preview. Add fields in the Editor.</div>
              : <>
                  {elements.map(el => {
                    if (!evalConditions(el, formData, elements)) return null;
                    return (
                      <div key={el.id}>
                        <PreviewField element={el} value={formData[el.name]} onChange={val=>setValue(el.name,val)} error={errors[el.name]} />
                        {errors[el.name] && (
                          <div className={s.error}>
                            <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            {errors[el.name]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className={s.submitRow}>
                    <button type="submit" className={s.submitBtn}>{formSettings.submitText||'Submit'}</button>
                  </div>
                </>
            }
          </form>
        </div>

        {Object.keys(formData).length > 0 && (
          <div className={s.dataInspector}>
            <div className={s.dataTitle}>Live form data</div>
            <pre className={s.dataPre}>{JSON.stringify(formData,null,2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
