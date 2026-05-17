import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import styles from '../dashboard.module.css';

export default function BarWidget({
  title, data = [], valueKey, labelKey, color = '#2563eb', onBarClick, half = false,
}) {
  const clsName = half ? `${styles.chartCard} ${styles.chartCardHalf}` : styles.chartCard;
  if (!data.length) {
    return (
      <div className={clsName}>
        <p className={styles.chartTitle}>{title}</p>
        <p className={styles.chartHint}>No data available.</p>
      </div>
    );
  }
  return (
    <div className={clsName}>
      <p className={styles.chartTitle}>{title}</p>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, right: 16, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey={labelKey}
              tick={{ fontSize: 11, fill: '#64748b' }}
              interval={0}
              angle={data.length > 6 ? -18 : 0}
              textAnchor={data.length > 6 ? 'end' : 'middle'}
              height={data.length > 6 ? 60 : 30}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(37, 99, 235, 0.08)' }} />
            <Bar
              dataKey={valueKey}
              fill={color}
              radius={[6, 6, 0, 0]}
              cursor={onBarClick ? 'pointer' : 'default'}
              onClick={onBarClick ? (d) => onBarClick(d?.payload ?? d) : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
