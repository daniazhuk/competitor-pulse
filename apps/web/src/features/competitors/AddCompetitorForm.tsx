import { competitorIdSchema } from '@competitor-pulse/contract';
import { useId, useState, type SubmitEvent } from 'react';
import { StatusMessage } from '../../shared/StatusMessage';
import styles from './CompetitorList.module.css';
import { useTrackCompetitor } from './use-competitors';

export function AddCompetitorForm() {
  const inputId = useId();
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const trackCompetitor = useTrackCompetitor();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = competitorIdSchema.safeParse(value);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid competitor id');
      return;
    }

    setValidationError(null);
    trackCompetitor.mutate(parsed.data, { onSuccess: () => setValue('') });
  };

  const errorMessage = validationError ?? trackCompetitor.error?.message;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="visually-hidden">
        Competitor id
      </label>
      <input
        id={inputId}
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="competitor id, e.g. acme-crm"
        autoComplete="off"
        aria-invalid={Boolean(errorMessage)}
      />
      <button type="submit" disabled={trackCompetitor.isPending}>
        Track
      </button>
      {errorMessage && <StatusMessage kind="error">{errorMessage}</StatusMessage>}
    </form>
  );
}
