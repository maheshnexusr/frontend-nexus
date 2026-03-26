import s from './ElementRenderer.module.css';

function FieldWrapper({ el, children }) {
  return (
    <div className={s.field}>
      {el.showLabel !== false && el.label && (
        <label className={s.label}>
          {el.label}
          {el.validation?.required && <span className={s.required}>*</span>}
        </label>
      )}
      {el.decorators?.before && <div className={s.before}>{el.decorators.before}</div>}
      <div className={s.inputWrap}>
        {el.decorators?.prefix && <span className={s.prefix}>{el.decorators.prefix}</span>}
        <div className={el.decorators?.prefix ? s.prefixWrap : ''}>{children}</div>
        {el.decorators?.suffix && <span className={s.suffix}>{el.decorators.suffix}</span>}
      </div>
      {el.description && <div className={s.desc}>{el.description}</div>}
      {el.decorators?.after && <div className={s.after}>{el.decorators.after}</div>}
    </div>
  );
}

export default function ElementRenderer({ element: el }) {
  switch (el.type) {
    case 'text': case 'email': case 'phone': case 'password': case 'url': case 'location':
      return <FieldWrapper el={el}><input className={s.input} type={el.type === 'password' ? 'password' : 'text'} placeholder={el.placeholder} readOnly /></FieldWrapper>;

    case 'number':
      return <FieldWrapper el={el}><input className={s.input} type="number" placeholder={el.placeholder || '0'} readOnly /></FieldWrapper>;

    case 'textarea':
      return <FieldWrapper el={el}><textarea className={s.textarea} rows={el.rows || 3} placeholder={el.placeholder} readOnly /></FieldWrapper>;

    case 'editor':
      return (
        <FieldWrapper el={el}>
          <div className={s.editorBox}>
            <div className={s.editorBar}>
              {['B','I','U','Link'].map((b) => <span key={b} className={s.editorBarBtn}>{b}</span>)}
            </div>
            <div className={s.editorBody}>{el.placeholder || 'Rich text content...'}</div>
          </div>
        </FieldWrapper>
      );

    case 'signature':
      return <FieldWrapper el={el}><div className={s.signBox}>{el.placeholder || 'Sign here'}</div></FieldWrapper>;

    case 'select': case 'multiselect':
      return (
        <FieldWrapper el={el}>
          <div className={s.selectBox}>
            <span>{el.placeholder || 'Select an option...'}</span>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </FieldWrapper>
      );

    case 'tags':
      return (
        <FieldWrapper el={el}>
          <div className={s.tagsBox}>
            <span className={s.tag}>Tag 1 ×</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Add tag...</span>
          </div>
        </FieldWrapper>
      );

    case 'checkbox':
      return (
        <FieldWrapper el={el}>
          <label className={s.checkRow}>
            <input type="checkbox" readOnly />
            <span className={s.checkLabel}>{el.text || el.label}</span>
          </label>
        </FieldWrapper>
      );

    case 'checkboxgroup':
      return (
        <FieldWrapper el={el}>
          <div className={s.optionList}>
            {(el.options || []).map((opt, i) => (
              <label key={i} className={s.optionRow}>
                <input type="checkbox" readOnly />
                <span className={s.optionLabel}>{opt.label || opt}</span>
              </label>
            ))}
          </div>
        </FieldWrapper>
      );

    case 'radiogroup':
      return (
        <FieldWrapper el={el}>
          <div className={s.optionList}>
            {(el.options || []).map((opt, i) => (
              <label key={i} className={s.optionRow}>
                <input type="radio" readOnly />
                <span className={s.optionLabel}>{opt.label || opt}</span>
              </label>
            ))}
          </div>
        </FieldWrapper>
      );

    case 'toggle':
      return (
        <FieldWrapper el={el}>
          <div className={s.toggleRow}>
            <div className={s.toggleTrack}><div className={s.toggleThumb} /></div>
            <span className={s.toggleLabel}>{el.falseLabel || 'No'}</span>
          </div>
        </FieldWrapper>
      );

    case 'date': case 'datetime': case 'time': case 'dates': case 'daterange':
      return <FieldWrapper el={el}><input className={s.input} type={el.type === 'time' ? 'time' : el.type === 'datetime' ? 'datetime-local' : 'date'} readOnly /></FieldWrapper>;

    case 'slider': {
      const pct = ((el.defaultValue - el.min) / (el.max - el.min)) * 100;
      return (
        <FieldWrapper el={el}>
          <div className={s.sliderWrap}>
            <div className={s.sliderTrack}>
              <div className={s.sliderFill} style={{ width: `${pct}%` }} />
              <div className={s.sliderThumb} style={{ left: `${pct}%` }} />
            </div>
            <div className={s.sliderLabels}>
              <span>{el.min}</span>
              <span className={s.sliderValue}>{el.defaultValue}</span>
              <span>{el.max}</span>
            </div>
          </div>
        </FieldWrapper>
      );
    }

    case 'rangeslider': {
      const v = Array.isArray(el.defaultValue) ? el.defaultValue : [20, 80];
      const p0 = ((v[0] - el.min) / (el.max - el.min)) * 100;
      const p1 = ((v[1] - el.min) / (el.max - el.min)) * 100;
      return (
        <FieldWrapper el={el}>
          <div className={s.sliderWrap}>
            <div className={s.sliderTrack}>
              <div className={s.sliderFill} style={{ left: `${p0}%`, width: `${p1 - p0}%` }} />
              <div className={s.sliderThumb} style={{ left: `${p0}%` }} />
              <div className={s.sliderThumb} style={{ left: `${p1}%` }} />
            </div>
            <div className={s.sliderLabels}><span>{el.min}</span><span className={s.sliderValue}>{v[0]} – {v[1]}</span><span>{el.max}</span></div>
          </div>
        </FieldWrapper>
      );
    }

    case 'rating': {
      const max = el.max || 5;
      const val = el.defaultValue || 0;
      return (
        <FieldWrapper el={el}>
          <div className={s.ratingRow}>
            {Array.from({ length: max }).map((_, i) => (
              <span key={i} className={`${s.star} ${i < val ? s.starFilled : ''}`}>★</span>
            ))}
          </div>
        </FieldWrapper>
      );
    }

    case 'file': case 'multifile': case 'image': case 'multiimage':
      return (
        <FieldWrapper el={el}>
          <div className={s.uploadBox}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#cbd5e1' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{el.type.includes('multi') ? 'Drop files here or click to upload' : 'Drop file here or click to upload'}</span>
            {el.accept && <span className={s.uploadAccept}>{el.accept}</span>}
          </div>
        </FieldWrapper>
      );

    case 'h1': return <h1 className={s.h1}>{el.content || 'Form Heading'}</h1>;
    case 'h2': return <h2 className={s.h2}>{el.content || 'Section Heading'}</h2>;
    case 'h3': return <h3 className={s.h3}>{el.content || 'Subheading'}</h3>;
    case 'paragraph': return <p className={s.para}>{el.content || 'Paragraph text.'}</p>;
    case 'divider':   return <hr className={s.divider} />;
    case 'spacer':    return <div style={{ height: el.height || 24 }} />;

    case 'button': case 'submit': {
      const cls = el.buttonVariant === 'secondary' ? s.btnSecondary : s.btnPrimary;
      return <button className={cls}>{el.buttonLabel || el.label || 'Button'}</button>;
    }

    case 'link':
      return <a className={s.link} href="#">{el.linkText || 'Click here'}</a>;

    case 'steps':
      return (
        <div className={s.stepsRow}>
          {['Step 1','Step 2','Step 3'].map((st, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div className={`${s.step} ${i === 0 ? s.stepActive : s.stepInactive}`}>
                <span className={`${s.stepNum} ${i === 0 ? s.stepNumActive : s.stepNumInactive}`}>{i + 1}</span>
                {st}
              </div>
              {i < 2 && <div className={s.stepConnector} />}
            </div>
          ))}
        </div>
      );

    default:
      return <FieldWrapper el={el}><input className={s.input} placeholder={el.placeholder || el.label} readOnly /></FieldWrapper>;
  }
}
