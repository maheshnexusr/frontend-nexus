import { Construction } from 'lucide-react';
import styles from './PlaceholderPage.module.css';

/**
 * Generic placeholder for pages that are under construction.
 * Replace with the real page component when ready.
 */
export default function PlaceholderPage({ title = 'Page', description }) {
  return (
    <div className={styles.page}>
      <div className={styles.icon}>
        <Construction size={48} strokeWidth={1.25} />
      </div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.sub}>
        {description ?? 'This page is under construction and will be available soon.'}
      </p>
    </div>
  );
}
