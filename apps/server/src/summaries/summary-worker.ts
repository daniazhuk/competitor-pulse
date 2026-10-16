import type { Listing } from '@competitor-pulse/contract';
import type { Database } from '../db/client.js';
import type { SnapshotRow } from '../db/schema.js';
import type { Logger } from '../logger.js';
import type { Clock } from '../shared/clock.js';
import type { ChangeSummarizer } from './change-summarizer.js';
import {
  claimDueSummaries,
  completeSummary,
  failSummary,
  findSnapshotsByIds,
  scheduleSummaryRetry,
} from './summary-repository.js';

const MAX_RETRY_DELAY_MS = 15 * 60 * 1_000;
const MAX_STORED_ERROR_LENGTH = 500;

export interface SummaryWorkerDeps {
  db: Database;
  summarizer: ChangeSummarizer;
  clock: Clock;
  logger: Logger;
  batchSize: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  /** How long a claimed job is reserved; must exceed the LLM timeout. */
  leaseMs: number;
}

const toListing = ({ title, tagline, price, description }: SnapshotRow): Listing => ({
  title,
  tagline,
  price,
  description,
});

export class SummaryWorker {
  constructor(private readonly deps: SummaryWorkerDeps) {}

  /** Claims and processes one batch. Returns the number of jobs handled. */
  async processDueSummaries(): Promise<number> {
    const { db, clock, batchSize, leaseMs } = this.deps;
    const now = clock();
    const jobs = await claimDueSummaries(db, {
      now,
      leaseUntil: new Date(now.getTime() + leaseMs),
      limit: batchSize,
    });
    if (jobs.length === 0) return 0;

    const previousIds = jobs.flatMap((job) => job.previousSnapshotId ?? []);
    const previousById = new Map(
      (await findSnapshotsByIds(db, previousIds)).map((row) => [row.id, row]),
    );

    await Promise.all(
      jobs.map((job) =>
        this.processJob(
          job,
          job.previousSnapshotId ? previousById.get(job.previousSnapshotId) : undefined,
        ),
      ),
    );
    return jobs.length;
  }

  private async processJob(job: SnapshotRow, previous: SnapshotRow | undefined): Promise<void> {
    const { db, summarizer, logger } = this.deps;
    const log = logger.child({ snapshotId: job.id, competitorId: job.competitorId });

    if (!previous) {
      await failSummary(db, job.id, 'Previous snapshot is missing');
      log.warn('Summary failed: previous snapshot is missing');
      return;
    }

    try {
      const summary = await summarizer.summarize({
        competitorId: job.competitorId,
        previous: toListing(previous),
        current: toListing(job),
        changes: job.changes,
      });
      await completeSummary(db, job.id, summary);
      log.info('Summary generated');
    } catch (error) {
      await this.handleFailure(job, error);
    }
  }

  private async handleFailure(job: SnapshotRow, error: unknown): Promise<void> {
    const { db, clock, logger, maxAttempts, retryBaseDelayMs } = this.deps;
    const message = (error instanceof Error ? error.message : String(error)).slice(
      0,
      MAX_STORED_ERROR_LENGTH,
    );
    const log = logger.child({ snapshotId: job.id, attempt: job.summaryAttempts });

    if (job.summaryAttempts >= maxAttempts) {
      await failSummary(db, job.id, message);
      log.error({ err: error }, 'Summary failed permanently');
      return;
    }

    const delayMs = Math.min(retryBaseDelayMs * 2 ** (job.summaryAttempts - 1), MAX_RETRY_DELAY_MS);
    await scheduleSummaryRetry(db, job.id, {
      nextAttemptAt: new Date(clock().getTime() + delayMs),
      error: message,
    });
    log.warn({ err: error, retryInMs: delayMs }, 'Summary failed, retry scheduled');
  }
}
