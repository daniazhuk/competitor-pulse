import { Link, useParams } from 'react-router';
import { ApiError } from '../../shared/api-client';
import { StatusMessage } from '../../shared/StatusMessage';
import { SnapshotCard } from './SnapshotCard';
import styles from './Timeline.module.css';
import { useSnapshots } from './use-snapshots';

export function TimelinePage() {
  const { id = '' } = useParams();

  return (
    <>
      <Link to="/" className={styles.back}>
        ← Back to competitors
      </Link>
      <h2 className={styles.heading}>{id}</h2>
      <Timeline competitorId={id} />
    </>
  );
}

function Timeline({ competitorId }: { competitorId: string }) {
  const {
    data: snapshots,
    isPending,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSnapshots(competitorId);

  if (isPending) return <StatusMessage kind="info">Loading snapshots…</StatusMessage>;
  if (error instanceof ApiError && error.status === 404) {
    return <StatusMessage kind="error">This competitor is not tracked.</StatusMessage>;
  }
  if (error)
    return <StatusMessage kind="error">Could not load snapshots: {error.message}</StatusMessage>;
  if (snapshots.length === 0) {
    return (
      <StatusMessage kind="info">
        No snapshots yet. The first one appears after the next poll.
      </StatusMessage>
    );
  }

  return (
    <>
      <ol className={styles.timeline} aria-label={`Snapshots of ${competitorId}, newest first`}>
        {snapshots.map((snapshot) => (
          <li key={snapshot.id}>
            <SnapshotCard snapshot={snapshot} />
          </li>
        ))}
      </ol>
      {hasNextPage && (
        <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading…' : 'Load older snapshots'}
        </button>
      )}
    </>
  );
}
