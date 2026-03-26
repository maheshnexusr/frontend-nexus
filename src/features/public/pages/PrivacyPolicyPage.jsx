import styles from './StaticPage.module.css';
export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: January 2025</p>
        <p className={styles.body}>
          This Privacy Policy describes how SclinNexus collects, uses, and protects your
          personal information when you use our clinical data capture platform.
          Full policy content will be added by the legal team prior to launch.
        </p>
      </div>
    </div>
  );
}
