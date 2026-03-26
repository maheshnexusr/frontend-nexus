import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectElements } from '@/features/form-builder/store/formSlice';
import { getFieldInfo } from '@/features/form-builder/lib/fieldSchema';
import s from './ModelView.module.css';

const SKIP = ['h1','h2','h3','divider','spacer','button','submit','link','steps','paragraph'];

const TYPE_MAP = {
  text:'string', number:'number', email:'string', phone:'string', password:'string',
  url:'string', textarea:'string', editor:'string', signature:'string', location:'string',
  select:'string', multiselect:'array', tags:'array',
  checkbox:'boolean', checkboxgroup:'array', radiogroup:'string', toggle:'boolean',
  date:'string', datetime:'string', time:'string', dates:'array', daterange:'array',
  slider:'number', rangeslider:'array',
  file:'object', multifile:'array', image:'object', multiimage:'array',
};

function getSchema(el) {
  const schema = { type: TYPE_MAP[el.type] || 'string' };
  if (el.validation?.required)  schema.required  = true;
  if (el.defaultValue !== undefined && el.defaultValue !== '') schema.default = el.defaultValue;
  if (el.validation?.minLength) schema.minLength  = Number(el.validation.minLength);
  if (el.validation?.maxLength) schema.maxLength  = Number(el.validation.maxLength);
  if (el.validation?.min)       schema.minimum    = Number(el.validation.min);
  if (el.validation?.max)       schema.maximum    = Number(el.validation.max);
  if (el.validation?.pattern)   schema.pattern    = el.validation.pattern;
  if (el.options)               schema.enum       = el.options.map((o) => o.value);
  return schema;
}

export default function ModelView() {
  const elements    = useSelector(selectElements);
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const fields = elements.filter((el) => !SKIP.includes(el.type));

  return (
    <div className={s.outer}>
      <div className={s.inner}>
        <div className={s.heading}>
          <h2>Data Model</h2>
          <p>Structure of form data that will be submitted</p>
        </div>

        {fields.length === 0 ? (
          <div className={s.empty}>Add elements to see the data model</div>
        ) : (
          <>
            <div className={s.card}>
              <div className={s.cardTop}><span>{'{'}</span><span style={{color:'#94a3b8',fontWeight:400}}>Form data object</span></div>
              <div className={s.cardBody}>
                {fields.map((el) => {
                  const info   = getFieldInfo(el.type);
                  const schema = getSchema(el);
                  const open   = expanded[el.id];
                  return (
                    <div key={el.id}>
                      <button className={s.fieldRow} onClick={() => toggle(el.id)}>
                        <div className={s.fieldIcon} style={{ background: info.color + '18', color: info.color }}>
                          <span style={{ fontSize: 8, fontWeight: 700 }}>{el.type.slice(0,2).toUpperCase()}</span>
                        </div>
                        <div className={s.fieldInfo}>
                          <div className={s.fieldName}>{el.name}</div>
                          <div className={s.fieldLabel}>{el.label}</div>
                        </div>
                        <div className={s.fieldMeta}>
                          <span className={s.typeBadge} style={{ background: info.color + '18', color: info.color }}>{schema.type}</span>
                          {el.validation?.required && <span className={s.requiredBadge}>required</span>}
                          <span className={s.chevron}>{open ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {open && (
                        <div className={s.expanded}>
                          <pre>{JSON.stringify(schema, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className={s.cardBottom}>{'}'}</div>
            </div>

            <div className={s.jsonPreview}>
              <div className={s.jsonTitle}>JSON schema preview</div>
              <pre className={s.jsonPre}>
                {JSON.stringify(
                  Object.fromEntries(fields.map((el) => [el.name, getSchema(el)])),
                  null, 2
                )}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
