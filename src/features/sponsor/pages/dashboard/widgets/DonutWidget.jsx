import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';
import styles from '../dashboard.module.css';

const DEFAULT_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#ea580c'];

export default function DonutWidget({
  title, data = [], valueKey, labelKey, colors = DEFAULT_COLORS, onSliceClick, half = true,
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
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={labelKey}
              innerRadius={48}
              outerRadius={82}
              paddingAngle={2}
              onClick={onSliceClick ? (d) => onSliceClick(d?.payload ?? d) : undefined}
              cursor={onSliceClick ? 'pointer' : 'default'}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
