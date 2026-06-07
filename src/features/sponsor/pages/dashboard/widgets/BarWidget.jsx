import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import styles from '../dashboard.module.css';

// Short axis label: turn an ISO date (YYYY-MM-DD) into "04 Jun"; leave any other
// label (e.g. a site name) untouched.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortLabel(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [, m, d] = v.split('-');
    return `${d} ${MONTHS[Number(m) - 1] ?? ''}`.trim();
  }
  return v;
}

function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tip.box}>
      <div style={tip.label}>{shortLabel(label)}</div>
      <div style={tip.value}>
        <span style={{ ...tip.dot, background: payload[0].color || payload[0].fill }} />
        {payload[0].value}{unit}
      </div>
    </div>
  );
}

export default function BarWidget({
  title, data = [], valueKey, labelKey, color = '#2563eb', onBarClick, half = false,
  unit = '', domainMax,
}) {
  const clsName = half ? `${styles.chartCard} ${styles.chartCardHalf}` : styles.chartCard;
  if (!data.length) {
    return (
      <div className={clsName}>
        <p className={styles.chartTitle}>{title}</p>
        <div style={empty.box}>
          <p className={styles.chartHint}>No data available.</p>
        </div>
      </div>
    );
  }

  const gradId = `barGrad-${String(color).replace(/[^a-z0-9]/gi, '')}`;
  const many   = data.length > 8;

  return (
    <div className={clsName}>
      <p className={styles.chartTitle}>{title}</p>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 24, right: 16, left: -8, bottom: many ? 28 : 8 }} barCategoryGap="28%">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
            <XAxis
              dataKey={labelKey}
              tickFormatter={shortLabel}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval={many ? 'preserveStartEnd' : 0}
              angle={many ? -28 : 0}
              textAnchor={many ? 'end' : 'middle'}
              height={many ? 48 : 24}
              dy={4}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={unit ? 40 : 32}
              unit={unit || undefined}
              domain={domainMax != null ? [0, domainMax] : undefined}
            />
            <Tooltip cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} content={<ChartTooltip unit={unit} />} />
            <Bar
              dataKey={valueKey}
              fill={`url(#${gradId})`}
              radius={[6, 6, 0, 0]}
              maxBarSize={46}
              cursor={onBarClick ? 'pointer' : 'default'}
              onClick={onBarClick ? (d) => onBarClick(d?.payload ?? d) : undefined}
            >
              <LabelList
                dataKey={valueKey}
                position="top"
                offset={8}
                style={{ fontSize: 11, fontWeight: 600, fill: '#475569' }}
                formatter={(v) => (v ? `${v}${unit}` : '')}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const empty = {
  box: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, border: '1px dashed #e2e8f0', borderRadius: 8, background: '#fafbfc' },
};
const tip = {
  box:   { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 6px 20px rgba(15,23,42,0.12)', padding: '8px 11px', minWidth: 90 },
  label: { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 },
  value: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: '#0f172a' },
  dot:   { width: 9, height: 9, borderRadius: 3, display: 'inline-block' },
};
