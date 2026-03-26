import styles from './StaticPage.module.css';
export default function TermsOfUsePage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Terms of Use</h1>
        <p className={styles.updated}>Last updated: January 2025</p>
        <p className={styles.body}>
          These Terms of Use govern your access to and use of the SclinNexus
          Electronic Data Capture platform. Full terms will be added by the
          legal team prior to launch.
        </p>
      </div>
    </div>
  );
}
