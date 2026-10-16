import { snapshotsQuerySchema, type Snapshot } from '@competitor-pulse/contract';
import type { FastifyInstance } from 'fastify';
import { competitorParamsSchema } from '../competitors/competitor-routes.js';
import type { CompetitorService } from '../competitors/competitor-service.js';
import type { Database } from '../db/client.js';
import type { SnapshotRow } from '../db/schema.js';
import { parseOrThrow } from '../shared/validation.js';
import { listSnapshots } from './snapshot-repository.js';

function toSnapshotResponse(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    fetchedAt: row.fetchedAt.toISOString(),
    title: row.title,
    tagline: row.tagline,
    price: row.price,
    description: row.description,
    changed: row.changed,
    summary: row.summaryStatus === 'ready' ? row.summary : null,
    summaryStatus: row.summaryStatus,
    changes: row.changes,
  };
}

export function registerSnapshotRoutes(
  app: FastifyInstance,
  deps: { db: Database; competitors: CompetitorService },
): void {
  app.get('/api/competitors/:id/snapshots', async (request): Promise<Snapshot[]> => {
    const { id } = parseOrThrow(competitorParamsSchema, request.params);
    const { limit, before } = parseOrThrow(snapshotsQuerySchema, request.query);

    await deps.competitors.assertTracked(id);
    const rows = await listSnapshots(deps.db, id, {
      limit,
      before: before ? new Date(before) : undefined,
    });
    return rows.map(toSnapshotResponse);
  });
}
