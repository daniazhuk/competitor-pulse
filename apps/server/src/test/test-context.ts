import type { Listing } from '@competitor-pulse/contract';
import { sql } from 'drizzle-orm';
import { pino } from 'pino';
import { inject } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/client.js';
import {
  FixtureListingSource,
  type ListingFixtures,
} from '../listing-source/fixture-listing-source.js';
import { SnapshotPoller } from '../snapshots/snapshot-poller.js';
import type { ChangeSummarizer, ChangeSummaryInput } from '../summaries/change-summarizer.js';
import { SummaryWorker } from '../summaries/summary-worker.js';

export const START_TIME = new Date('2026-09-10T12:00:00.000Z');
export const MAX_SUMMARY_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 1_000;

export const listing = (overrides: Partial<Listing> = {}): Listing => ({
  title: 'Acme CRM',
  tagline: 'Simple CRM for small teams',
  price: '$29/mo',
  description: 'Track leads and deals in one place.',
  ...overrides,
});

export const FIXTURES: ListingFixtures = {
  'acme-crm': [listing(), listing({ price: '$39/mo' }), listing({ price: '$39/mo' })],
  'north-analytics': [listing({ title: 'North Analytics' })],
};

export class FakeClock {
  private current = new Date(START_TIME);
  readonly now = (): Date => new Date(this.current);
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Records every call; behaviour can be swapped per test. */
export class FakeSummarizer implements ChangeSummarizer {
  readonly calls: ChangeSummaryInput[] = [];
  respond: (input: ChangeSummaryInput) => Promise<string> = (input) =>
    Promise.resolve(`Changed: ${input.changes.map((change) => change.field).join(', ')}`);

  summarize(input: ChangeSummaryInput): Promise<string> {
    this.calls.push(input);
    return this.respond(input);
  }
}

export function createTestContext() {
  const { db, pool } = createDatabase(inject('databaseUrl'));
  const logger = pino({ level: 'silent' });
  const clock = new FakeClock();
  const source = new FixtureListingSource(structuredClone(FIXTURES));
  const summarizer = new FakeSummarizer();

  const poller = new SnapshotPoller({ db, pool, source, clock: clock.now, logger, concurrency: 2 });
  const summaryWorker = new SummaryWorker({
    db,
    summarizer,
    clock: clock.now,
    logger,
    batchSize: 10,
    maxAttempts: MAX_SUMMARY_ATTEMPTS,
    retryBaseDelayMs: RETRY_BASE_DELAY_MS,
    leaseMs: 60_000,
  });

  // Routes get a recording no-op so tests control exactly when polling happens.
  const initialPolls: string[] = [];
  const app = buildApp({
    db,
    source,
    logger,
    poller: {
      pollCompetitor: (id) => {
        initialPolls.push(id);
        return Promise.resolve(null);
      },
    },
  });

  return {
    db,
    pool,
    app,
    clock,
    source,
    summarizer,
    poller,
    summaryWorker,
    initialPolls,
    async reset() {
      await db.execute(sql`TRUNCATE competitors, snapshots`);
    },
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

export type TestContext = ReturnType<typeof createTestContext>;
