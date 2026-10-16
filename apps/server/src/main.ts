import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { FixtureListingSource } from './listing-source/fixture-listing-source.js';
import { createLogger } from './logger.js';
import { systemClock } from './shared/clock.js';
import { startIntervalLoop } from './shared/interval-loop.js';
import { SnapshotPoller } from './snapshots/snapshot-poller.js';
import { OpenAiSummarizer } from './summaries/openai-summarizer.js';
import { SummaryWorker } from './summaries/summary-worker.js';

const LEASE_TO_TIMEOUT_RATIO = 2;

const config = loadConfig();
const logger = createLogger(config);
const { db, pool } = createDatabase(config.DATABASE_URL);
const source = await FixtureListingSource.fromFile(config.FIXTURES_PATH);

const poller = new SnapshotPoller({
  db,
  pool,
  source,
  clock: systemClock,
  logger: logger.child({ component: 'poller' }),
  concurrency: config.POLL_CONCURRENCY,
});

const summaryWorker = new SummaryWorker({
  db,
  summarizer: new OpenAiSummarizer({
    baseUrl: config.LLM_BASE_URL,
    apiKey: config.LLM_API_KEY,
    model: config.LLM_MODEL,
    timeoutMs: config.LLM_TIMEOUT_MS,
  }),
  clock: systemClock,
  logger: logger.child({ component: 'summary-worker' }),
  batchSize: config.SUMMARY_BATCH_SIZE,
  maxAttempts: config.SUMMARY_MAX_ATTEMPTS,
  retryBaseDelayMs: config.SUMMARY_RETRY_BASE_DELAY_MS,
  leaseMs: config.LLM_TIMEOUT_MS * LEASE_TO_TIMEOUT_RATIO,
});

const app = buildApp({ db, source, poller, logger });
await app.listen({ host: config.HOST, port: config.PORT });

const loops = [
  startIntervalLoop(
    'poller',
    config.POLL_INTERVAL_MS,
    async () => {
      await poller.pollAll();
    },
    logger,
  ),
  startIntervalLoop(
    'summary-worker',
    config.SUMMARY_POLL_INTERVAL_MS,
    async () => {
      await summaryWorker.processDueSummaries();
    },
    logger,
  ),
];

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');
  await app.close();
  await Promise.all(loops.map((loop) => loop.stop()));
  await pool.end();
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown(signal).catch((error: unknown) => {
      logger.error({ err: error }, 'Shutdown failed');
      process.exitCode = 1;
    });
  });
}
