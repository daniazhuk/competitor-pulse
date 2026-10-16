import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
/** Either the root database or a transaction, so repositories work in both. */
export type DbExecutor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
}

export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new pg.Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

/**
 * Runs `task` only if this process wins the session-level advisory lock, so
 * overlapping ticks or multiple app instances never run the same job twice.
 */
export async function withAdvisoryLock<T>(
  pool: pg.Pool,
  lockKey: number,
  task: () => Promise<T>,
): Promise<{ acquired: false } | { acquired: true; result: T }> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [lockKey],
    );
    if (!rows[0]?.locked) return { acquired: false };

    try {
      return { acquired: true, result: await task() };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    }
  } finally {
    client.release();
  }
}
