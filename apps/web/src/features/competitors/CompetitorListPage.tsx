import { Link } from 'react-router';
import { StatusMessage } from '../../shared/StatusMessage';
import { AddCompetitorForm } from './AddCompetitorForm';
import styles from './CompetitorList.module.css';
import { useCompetitors, useUntrackCompetitor } from './use-competitors';

export function CompetitorListPage() {
  return (
    <>
      <AddCompetitorForm />
      <CompetitorList />
    </>
  );
}

function CompetitorList() {
  const { data: competitors, isPending, error } = useCompetitors();
  const untrackCompetitor = useUntrackCompetitor();

  if (isPending) return <StatusMessage kind="info">Loading competitors…</StatusMessage>;
  if (error)
    return <StatusMessage kind="error">Could not load competitors: {error.message}</StatusMessage>;
  if (competitors.length === 0) {
    return <StatusMessage kind="info">No competitors tracked yet. Add one above.</StatusMessage>;
  }

  const handleRemove = (id: string) => {
    if (window.confirm(`Stop tracking ${id}? Its snapshot history will be deleted.`)) {
      untrackCompetitor.mutate(id);
    }
  };

  return (
    <>
      {untrackCompetitor.error && (
        <StatusMessage kind="error">
          Could not remove: {untrackCompetitor.error.message}
        </StatusMessage>
      )}
      <ul className={styles.list} aria-label="Tracked competitors">
        {competitors.map(({ id }) => (
          <li key={id} className={styles.row}>
            <Link to={`/competitors/${encodeURIComponent(id)}`}>{id}</Link>
            <button type="button" onClick={() => handleRemove(id)} aria-label={`Remove ${id}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
