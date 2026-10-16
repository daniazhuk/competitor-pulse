import type { Logger } from '../logger.js';

export interface IntervalLoop {
  stop(): Promise<void>;
}

/**
 * Runs `task` immediately and then `intervalMs` after each run finishes, so a
 * slow run never overlaps the next one. Errors are logged and the loop goes on.
 */
export function startIntervalLoop(
  name: string,
  intervalMs: number,
  task: () => Promise<void>,
  logger: Logger,
): IntervalLoop {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> = Promise.resolve();

  const run = (): void => {
    inFlight = task()
      .catch((error: unknown) => {
        logger.error({ err: error, loop: name }, 'Loop iteration failed');
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(run, intervalMs);
      });
  };

  run();

  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await inFlight;
    },
  };
}
