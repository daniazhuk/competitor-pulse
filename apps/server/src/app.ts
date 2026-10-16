import type { ApiErrorBody } from '@competitor-pulse/contract';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import { registerCompetitorRoutes } from './competitors/competitor-routes.js';
import { CompetitorService } from './competitors/competitor-service.js';
import type { Database } from './db/client.js';
import { AppError } from './errors.js';
import type { ListingSource } from './listing-source/listing-source.js';
import type { Logger } from './logger.js';
import type { SnapshotPoller } from './snapshots/snapshot-poller.js';
import { registerSnapshotRoutes } from './snapshots/snapshot-routes.js';

export interface AppDeps {
  db: Database;
  source: ListingSource;
  poller: Pick<SnapshotPoller, 'pollCompetitor'>;
  logger: Logger;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;

const errorBody = (code: string, message: string): ApiErrorBody => ({ error: { code, message } });

export function buildApp({ db, source, poller, logger }: AppDeps): FastifyInstance {
  // Widen pino's Logger so the instance matches the default FastifyInstance type.
  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance });
  const competitors = new CompetitorService(db, source);

  app.get('/api/health', () => ({ status: 'ok' }));
  registerCompetitorRoutes(app, { competitors, poller });
  registerSnapshotRoutes(app, { db, competitors });

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send(errorBody('NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
  );

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message));
    }
    // Fastify's own 4xx errors, e.g. malformed JSON or an unsupported content type.
    if (
      error.statusCode &&
      error.statusCode >= HTTP_BAD_REQUEST &&
      error.statusCode < HTTP_INTERNAL_ERROR
    ) {
      return reply.code(error.statusCode).send(errorBody('VALIDATION_ERROR', error.message));
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply
      .code(HTTP_INTERNAL_ERROR)
      .send(errorBody('INTERNAL_ERROR', 'Something went wrong on our side'));
  });

  return app;
}
