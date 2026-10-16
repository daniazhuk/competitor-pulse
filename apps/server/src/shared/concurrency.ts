/** Runs `task` for every item with at most `limit` tasks in flight. */
export async function forEachWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const item = items[nextIndex] as T;
      nextIndex += 1;
      await task(item);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
