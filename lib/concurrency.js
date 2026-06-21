import os from "node:os";

export const DEFAULT_CONCURRENCY = Math.min(
  128,
  Math.max(32, os.cpus().length * 4),
);

export async function mapWithConcurrency(items, fn, concurrency = DEFAULT_CONCURRENCY) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
