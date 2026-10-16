import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const DEFAULT_FIXTURES_PATH = fileURLToPath(
  new URL('../../../files/fixtures/listings.json', import.meta.url),
);

const positiveInt = z.coerce.number().int().positive();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  HOST: z.string().default('0.0.0.0'),
  PORT: positiveInt.default(3000),
  DATABASE_URL: z.url(),
  FIXTURES_PATH: z.string().default(DEFAULT_FIXTURES_PATH),

  POLL_INTERVAL_MS: positiveInt.default(60_000),
  POLL_CONCURRENCY: positiveInt.default(10),

  SUMMARY_POLL_INTERVAL_MS: positiveInt.default(2_000),
  SUMMARY_BATCH_SIZE: positiveInt.default(10),
  SUMMARY_MAX_ATTEMPTS: positiveInt.default(5),
  SUMMARY_RETRY_BASE_DELAY_MS: positiveInt.default(5_000),

  LLM_BASE_URL: z.url().default('http://localhost:4001/v1'),
  LLM_API_KEY: z.string().min(1).default('mock-key'),
  LLM_MODEL: z.string().min(1).default('gpt-4o-mini'),
  LLM_TIMEOUT_MS: positiveInt.default(15_000),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
