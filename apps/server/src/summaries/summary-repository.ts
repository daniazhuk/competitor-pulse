import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { DbExecutor } from '../db/client.js';
import { snapshots, type SnapshotRow } from '../db/schema.js';

/**
 * Atomically claims due pending summaries. `SKIP LOCKED` lets several workers
 * share the queue; pushing `summary_next_attempt_at` to `leaseUntil` acts as a
 * lease, so a job whose worker crashed becomes due again once the lease ends.
 */
export async function claimDueSummaries(
  db: DbExecutor,
  options: { now: Date; leaseUntil: Date; limit: number },
): Promise<SnapshotRow[]> {
  const due = db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(
      and(eq(snapshots.summaryStatus, 'pending'), lte(snapshots.summaryNextAttemptAt, options.now)),
    )
    .orderBy(asc(snapshots.summaryNextAttemptAt))
    .limit(options.limit)
    .for('update', { skipLocked: true });

  return db
    .update(snapshots)
    .set({
      summaryAttempts: sql`${snapshots.summaryAttempts} + 1`,
      summaryNextAttemptAt: options.leaseUntil,
    })
    .where(inArray(snapshots.id, due))
    .returning();
}

export async function findSnapshotsByIds(db: DbExecutor, ids: string[]): Promise<SnapshotRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(snapshots).where(inArray(snapshots.id, ids));
}

export async function completeSummary(db: DbExecutor, id: string, summary: string): Promise<void> {
  await db
    .update(snapshots)
    .set({ summary, summaryStatus: 'ready', summaryNextAttemptAt: null, summaryError: null })
    .where(and(eq(snapshots.id, id), eq(snapshots.summaryStatus, 'pending')));
}

export async function scheduleSummaryRetry(
  db: DbExecutor,
  id: string,
  options: { nextAttemptAt: Date; error: string },
): Promise<void> {
  await db
    .update(snapshots)
    .set({ summaryNextAttemptAt: options.nextAttemptAt, summaryError: options.error })
    .where(and(eq(snapshots.id, id), eq(snapshots.summaryStatus, 'pending')));
}

export async function failSummary(db: DbExecutor, id: string, error: string): Promise<void> {
  await db
    .update(snapshots)
    .set({ summaryStatus: 'failed', summaryNextAttemptAt: null, summaryError: error })
    .where(and(eq(snapshots.id, id), eq(snapshots.summaryStatus, 'pending')));
}
