import { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectExportJSON } from '@/features/form-builder/store/formSlice';
import s from './CodeView.module.css';

function highlight(json) {
  return json
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (m) => {
      let color = '#4ade80';
      if (/^"/.test(m)) color = /:$/.test(m) ? '#93c5fd' : '#6ee7b7';
      else if (/true|false/.test(m)) color = '#fde68a';
      else if (/null/.test(m)) color = '#64748b';
      else color = '#fdba74';
      return `<span style="color:${color}">${m}</span>`;
    });
}

export default function CodeView() {
  const json   = useSelector(selectExportJSON);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'form-schema.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  let stats = null;
  try {
    const parsed   = JSON.parse(json);
    const elements = parsed.elements || [];
    const types    = [...new Set(elements.map((e) => e.type))];
    stats = {
      elements: elements.length,
      types: types.length,
      size: `${(json.length / 1024).toFixed(1)} KB`,
      required: elements.filter((e) => e.validation?.required).length,
    };
  } catch { /* empty */ }

  return (
    <div className={s.outer}>
      <div className={s.inner}>
        <div className={s.topBar}>
          <div className={s.viewTabs}>
            <button className={`${s.viewTab} ${s.viewTabActive}`}>JSON Schema</button>
          </div>
          <div className={s.actions}>
            <button className={s.btnOutline} onClick={handleDownload}>
              <Download size={13} /> Download
            </button>
            <button
              className={s.btnCopy}
              style={{ background: copied ? '#10b981' : '#07bf9b' }}
              onClick={handleCopy}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className={s.codeBox}>
          <div className={s.chrome}>
            <span className={`${s.dot} ${s.dotR}`} />
            <span className={`${s.dot} ${s.dotY}`} />
            <span className={`${s.dot} ${s.dotG}`} />
            <span className={s.filename}>form-schema.json</span>
          </div>
          <pre className={s.pre}>
            <code className={s.code} dangerouslySetInnerHTML={{ __html: highlight(json) }} />
          </pre>
        </div>

        {stats && (
          <div className={s.stats}>
            <div className={s.stat}><div className={s.statVal}>{stats.elements}</div><div className={s.statLabel}>Elements</div></div>
            <div className={s.stat}><div className={s.statVal}>{stats.types}</div><div className={s.statLabel}>Field types</div></div>
            <div className={s.stat}><div className={s.statVal}>{stats.size}</div><div className={s.statLabel}>Size</div></div>
            <div className={s.stat}><div className={s.statVal}>{stats.required}</div><div className={s.statLabel}>Required</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
