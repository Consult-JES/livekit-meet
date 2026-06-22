import styles from '../styles/Home.module.css';

export default function Page() {
  return (
    <main className={styles.main} data-lk-theme="default">
      <div className={styles.landing}>
        <img
          src="/images/accredit-mark.svg"
          alt="Accredit"
          width="72"
          height="72"
          className={styles.landingMark}
        />
        <h1 className={styles.landingTitle}>Accredit Meet</h1>
        <p className={styles.landingText}>
          This is Accredit&rsquo;s secure video conferencing. Meetings are launched from your course
          or event — open the session from your Accredit dashboard to join.
        </p>
      </div>
    </main>
  );
}
