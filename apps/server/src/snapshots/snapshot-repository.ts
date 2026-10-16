import { and, desc, eq, lt } from 'drizzle-orm';
import type { DbExecutor } from '../db/client.js';
import { competitors, snapshots, type NewSnapshotRow, type SnapshotRow } from '../db/schema.js';

/**
 * Row-locks the competitor so concurrent polls of the same competitor are
 * serialized and each new snapshot is diffed against the true latest one.
 * Returns false if the competitor no longer exists.
 */
export async function lockCompetitor(tx: DbExecutor, competitorId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: competitors.id })
    .from(competitors)
    .where(eq(competitors.id, competitorId))
    .for('update');
  return rows.length > 0;
}

export async function findLatestSnapshot(
  db: DbExecutor,
  competitorId: string,
): Promise<SnapshotRow | undefined> {
  const [latest] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.competitorId, competitorId))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(1);
  return latest;
}

export async function insertSnapshot(db: DbExecutor, row: NewSnapshotRow): Promise<SnapshotRow> {
  const [inserted] = await db.insert(snapshots).values(row).returning();
  if (!inserted) throw new Error('Snapshot insert returned no row');
  return inserted;
}

export async function listSnapshots(
  db: DbExecutor,
  competitorId: string,
  options: { limit: number; before?: Date | undefined },
): Promise<SnapshotRow[]> {
  const conditions = [eq(snapshots.competitorId, competitorId)];
  if (options.before) conditions.push(lt(snapshots.fetchedAt, options.before));

  return db
    .select()
    .from(snapshots)
    .where(and(...conditions))
    .orderBy(desc(snapshots.fetchedAt), desc(snapshots.id))
    .limit(options.limit);
}
