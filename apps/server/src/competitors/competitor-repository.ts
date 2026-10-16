import { asc, eq } from 'drizzle-orm';
import type { DbExecutor } from '../db/client.js';
import { competitors } from '../db/schema.js';

export async function listCompetitorIds(db: DbExecutor): Promise<string[]> {
  const rows = await db
    .select({ id: competitors.id })
    .from(competitors)
    .orderBy(asc(competitors.createdAt), asc(competitors.id));
  return rows.map((row) => row.id);
}

export async function competitorExists(db: DbExecutor, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: competitors.id })
    .from(competitors)
    .where(eq(competitors.id, id))
    .limit(1);
  return rows.length > 0;
}

/** Returns false if the id is already tracked. */
export async function insertCompetitor(db: DbExecutor, id: string): Promise<boolean> {
  const rows = await db
    .insert(competitors)
    .values({ id })
    .onConflictDoNothing()
    .returning({ id: competitors.id });
  return rows.length > 0;
}

/** Returns false if there was nothing to delete. Snapshots cascade. */
export async function deleteCompetitor(db: DbExecutor, id: string): Promise<boolean> {
  const rows = await db
    .delete(competitors)
    .where(eq(competitors.id, id))
    .returning({ id: competitors.id });
  return rows.length > 0;
}
