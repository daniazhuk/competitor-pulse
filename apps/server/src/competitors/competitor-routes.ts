import {
  competitorIdSchema,
  createCompetitorBodySchema,
  type Competitor,
} from '@competitor-pulse/contract';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseOrThrow } from '../shared/validation.js';
import type { SnapshotPoller } from '../snapshots/snapshot-poller.js';
import type { CompetitorService } from './competitor-service.js';

export const competitorParamsSchema = z.object({ id: competitorIdSchema });

export interface CompetitorRoutesDeps {
  competitors: CompetitorService;
  poller: Pick<SnapshotPoller, 'pollCompetitor'>;
}

export function registerCompetitorRoutes(
  app: FastifyInstance,
  { competitors: service, poller }: CompetitorRoutesDeps,
): void {
  app.get('/api/competitors', async (): Promise<Competitor[]> => {
    const ids = await service.list();
    return ids.map((id) => ({ id }));
  });

  app.post('/api/competitors', async (request, reply): Promise<Competitor> => {
    const { id } = parseOrThrow(createCompetitorBodySchema, request.body);
    await service.track(id);

    // Take the first snapshot right away instead of waiting for the next tick.
    // Not awaited: the scheduler retries on its next run if this fails.
    poller.pollCompetitor(id).catch((error: unknown) => {
      request.log.warn({ err: error, competitorId: id }, 'Initial poll failed');
    });

    reply.code(201).header('location', `/api/competitors/${id}`);
    return { id };
  });

  app.delete('/api/competitors/:id', async (request, reply) => {
    const { id } = parseOrThrow(competitorParamsSchema, request.params);
    await service.untrack(id);
    return reply.code(204).send();
  });
}
