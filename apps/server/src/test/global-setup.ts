import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const POSTGRES_IMAGE = 'postgres:17-alpine';

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = container.getConnectionUri();

  const { db, pool } = createDatabase(databaseUrl);
  try {
    await runMigrations(db);
  } finally {
    await pool.end();
  }

  project.provide('databaseUrl', databaseUrl);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
