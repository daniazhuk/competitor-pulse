import type { FieldChange, Snapshot } from '@competitor-pulse/contract';
import { formatDateTime } from '../../shared/format-date-time';
import styles from './Timeline.module.css';

export function SnapshotCard({ snapshot }: { snapshot: Snapshot }) {
  return (
    <article className={styles.card}>
      <time className={styles.time} dateTime={snapshot.fetchedAt}>
        {formatDateTime(snapshot.fetchedAt)}
      </time>
      <p className={styles.field}>
        <strong>{snapshot.title}</strong> — {snapshot.tagline}
      </p>
      <p className={styles.field}>{snapshot.price}</p>
      <p className={styles.field}>{snapshot.description}</p>
      <ChangeSummary snapshot={snapshot} />
    </article>
  );
}

function ChangeSummary({ snapshot }: { snapshot: Snapshot }) {
  if (!snapshot.changed) {
    return <p className={styles.muted}>No change since previous snapshot.</p>;
  }
  if (snapshot.summary) {
    return <p className={styles.summary}>{snapshot.summary}</p>;
  }
  if (snapshot.summaryStatus === 'pending') {
    return <p className={styles.muted}>Generating AI summary…</p>;
  }
  // The AI summary failed for good: fall back to the deterministic diff.
  return (
    <div className={styles.muted}>
      <p className={styles.field}>AI summary unavailable. Detected changes:</p>
      <ul className={styles.changes}>
        {snapshot.changes.map((change) => (
          <li key={change.field}>{describeChange(change)}</li>
        ))}
      </ul>
    </div>
  );
}

const describeChange = ({ field, before, after }: FieldChange) =>
  `${field}: "${before}" → "${after}"`;
