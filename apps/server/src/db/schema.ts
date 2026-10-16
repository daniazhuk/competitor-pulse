import { SUMMARY_STATUSES, type FieldChange } from '@competitor-pulse/contract';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const competitors = pgTable(
  'competitors',
  {
    id: text('id').primaryKey(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [check('competitors_id_slug', sql`${table.id} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)],
);

export const summaryStatus = pgEnum('summary_status', SUMMARY_STATUSES);

export const snapshots = pgTable(
  'snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    competitorId: text('competitor_id')
      .notNull()
      .references(() => competitors.id, { onDelete: 'cascade' }),
    previousSnapshotId: uuid('previous_snapshot_id').references((): AnyPgColumn => snapshots.id, {
      onDelete: 'set null',
    }),
    fetchedAt: timestamptz('fetched_at').notNull(),
    title: text('title').notNull(),
    tagline: text('tagline').notNull(),
    price: text('price').notNull(),
    description: text('description').notNull(),
    changed: boolean('changed').notNull(),
    changes: jsonb('changes').$type<FieldChange[]>().notNull().default([]),
    summary: text('summary'),
    summaryStatus: summaryStatus('summary_status').notNull(),
    summaryAttempts: integer('summary_attempts').notNull().default(0),
    summaryNextAttemptAt: timestamptz('summary_next_attempt_at'),
    summaryError: text('summary_error'),
  },
  (table) => [
    // Serves both the timeline query and "latest snapshot for competitor" during polling.
    index('snapshots_competitor_fetched_at_idx').on(table.competitorId, table.fetchedAt.desc()),
    // Keeps the summary work queue scan small: only pending rows are indexed.
    index('snapshots_pending_summary_idx')
      .on(table.summaryNextAttemptAt)
      .where(sql`${table.summaryStatus} = 'pending'`),
  ],
);

export type SnapshotRow = typeof snapshots.$inferSelect;
export type NewSnapshotRow = typeof snapshots.$inferInsert;
