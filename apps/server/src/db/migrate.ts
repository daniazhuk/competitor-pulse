import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { createDatabase, type Database } from './client.js';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  const config = loadConfig();
  const logger = createLogger(config);
  const { db, pool } = createDatabase(config.DATABASE_URL);
  try {
    await runMigrations(db);
    logger.info('Migrations applied');
  } finally {
    await pool.end();
  }
}
