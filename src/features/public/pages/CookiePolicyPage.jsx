import styles from './StaticPage.module.css';
export default function CookiePolicyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Cookie Policy</h1>
        <p className={styles.updated}>Last updated: January 2025</p>
        <p className={styles.body}>
          SclinNexus uses essential cookies to operate the platform securely.
          Full cookie policy content will be added by the legal team prior to launch.
        </p>
      </div>
    </div>
  );
}
