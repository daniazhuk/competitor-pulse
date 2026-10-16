import type { Listing } from '@competitor-pulse/contract';
import type pg from 'pg';
import { withAdvisoryLock, type Database } from '../db/client.js';
import type { SnapshotRow } from '../db/schema.js';
import { listCompetitorIds } from '../competitors/competitor-repository.js';
import type { ListingSource } from '../listing-source/listing-source.js';
import type { Logger } from '../logger.js';
import type { Clock } from '../shared/clock.js';
import { forEachWithConcurrency } from '../shared/concurrency.js';
import { diffListings } from './diff.js';
import { findLatestSnapshot, insertSnapshot, lockCompetitor } from './snapshot-repository.js';

/** Arbitrary app-wide constant identifying the polling job's advisory lock. */
const POLL_LOCK_KEY = 4_271_001;

export interface SnapshotPollerDeps {
  db: Database;
  pool: pg.Pool;
  source: ListingSource;
  clock: Clock;
  logger: Logger;
  concurrency: number;
}

export type PollRunResult =
  { status: 'skipped' } | { status: 'completed'; polled: number; failed: number };

export class SnapshotPoller {
  constructor(private readonly deps: SnapshotPollerDeps) {}

  /** One scheduler tick: fetch every tracked competitor once. */
  async pollAll(): Promise<PollRunResult> {
    const { pool, logger, concurrency } = this.deps;

    const outcome = await withAdvisoryLock(pool, POLL_LOCK_KEY, async () => {
      const ids = await listCompetitorIds(this.deps.db);
      let failed = 0;

      await forEachWithConcurrency(ids, concurrency, async (id) => {
        try {
          await this.pollCompetitor(id);
        } catch (error) {
          failed += 1;
          logger.error({ err: error, competitorId: id }, 'Failed to poll competitor');
        }
      });

      return { polled: ids.length, failed };
    });

    if (!outcome.acquired) {
      logger.debug('Poll skipped: another run holds the lock');
      return { status: 'skipped' };
    }
    logger.info(outcome.result, 'Poll run completed');
    return { status: 'completed', ...outcome.result };
  }

  /** Returns the stored snapshot, or null if the competitor was removed meanwhile. */
  async pollCompetitor(competitorId: string): Promise<SnapshotRow | null> {
    const listing = await this.deps.source.fetchListing(competitorId);
    return this.recordSnapshot(competitorId, listing);
  }

  private async recordSnapshot(
    competitorId: string,
    listing: Listing,
  ): Promise<SnapshotRow | null> {
    return this.deps.db.transaction(async (tx) => {
      if (!(await lockCompetitor(tx, competitorId))) return null;

      // Taken under the lock so fetchedAt order always matches insertion order.
      const fetchedAt = this.deps.clock();
      const previous = await findLatestSnapshot(tx, competitorId);
      const changes = diffListings(previous, listing);
      const changed = changes.length > 0;

      // The LLM is never called inside this transaction: the snapshot is
      // committed first and summarized asynchronously by the summary worker.
      return insertSnapshot(tx, {
        competitorId,
        previousSnapshotId: previous?.id ?? null,
        fetchedAt,
        ...listing,
        changed,
        changes,
        summaryStatus: changed ? 'pending' : 'none',
        summaryNextAttemptAt: changed ? fetchedAt : null,
      });
    });
  }
}
