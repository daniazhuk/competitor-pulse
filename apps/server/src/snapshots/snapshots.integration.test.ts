import type { Snapshot } from '@competitor-pulse/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  MAX_SUMMARY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  type TestContext,
} from '../test/test-context.js';

const MINUTE_MS = 60_000;

describe('snapshot polling, diffing and summaries', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = createTestContext();
    await ctx.reset();
    await ctx.app.inject({ method: 'POST', url: '/api/competitors', payload: { id: 'acme-crm' } });
  });
  afterEach(() => ctx.close());

  const pollTimes = async (times: number) => {
    for (let i = 0; i < times; i += 1) {
      await ctx.poller.pollCompetitor('acme-crm');
      ctx.clock.advance(15 * MINUTE_MS);
    }
  };

  const getSnapshots = async (query = ''): Promise<Snapshot[]> => {
    const response = await ctx.app.inject({ url: `/api/competitors/acme-crm/snapshots${query}` });
    expect(response.statusCode).toBe(200);
    return response.json<Snapshot[]>();
  };

  it('stores every fetch, newest first, and only flags real changes', async () => {
    await pollTimes(4);

    const snapshots = await getSnapshots();

    expect(snapshots.map((s) => [s.price, s.changed, s.summaryStatus])).toEqual([
      ['$39/mo', false, 'none'],
      ['$39/mo', false, 'none'],
      ['$39/mo', true, 'pending'],
      ['$29/mo', false, 'none'],
    ]);
    expect(snapshots[0]?.fetchedAt).toBe('2026-09-10T12:45:00.000Z');
    expect(snapshots[2]?.changes).toEqual([{ field: 'price', before: '$29/mo', after: '$39/mo' }]);
    expect(snapshots.every((s) => s.summary === null)).toBe(true);
  });

  it('summarizes only changed snapshots, sending previous and new listing', async () => {
    await pollTimes(4);

    expect(await ctx.summaryWorker.processDueSummaries()).toBe(1);
    expect(await ctx.summaryWorker.processDueSummaries()).toBe(0);

    expect(ctx.summarizer.calls).toHaveLength(1);
    expect(ctx.summarizer.calls[0]).toMatchObject({
      competitorId: 'acme-crm',
      previous: { price: '$29/mo' },
      current: { price: '$39/mo' },
    });

    const changed = (await getSnapshots()).find((s) => s.changed);
    expect(changed).toMatchObject({ summaryStatus: 'ready', summary: 'Changed: price' });
  });

  it('keeps the snapshot and retries with backoff when the LLM fails, then gives up', async () => {
    ctx.summarizer.respond = () => Promise.reject(new Error('LLM unavailable'));
    await pollTimes(2);

    for (let attempt = 1; attempt <= MAX_SUMMARY_ATTEMPTS; attempt += 1) {
      expect(await ctx.summaryWorker.processDueSummaries()).toBe(1);
      // Not due again until the backoff has elapsed.
      expect(await ctx.summaryWorker.processDueSummaries()).toBe(0);
      ctx.clock.advance(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }

    expect(ctx.summarizer.calls).toHaveLength(MAX_SUMMARY_ATTEMPTS);
    const [latest] = await getSnapshots();
    expect(latest).toMatchObject({
      price: '$39/mo',
      changed: true,
      summary: null,
      summaryStatus: 'failed',
    });
  });

  it('recovers when a retry succeeds', async () => {
    ctx.summarizer.respond = () => Promise.reject(new Error('timeout'));
    await pollTimes(2);
    await ctx.summaryWorker.processDueSummaries();

    ctx.summarizer.respond = () => Promise.resolve('Price went up.');
    ctx.clock.advance(RETRY_BASE_DELAY_MS);
    await ctx.summaryWorker.processDueSummaries();

    const [latest] = await getSnapshots();
    expect(latest).toMatchObject({ summary: 'Price went up.', summaryStatus: 'ready' });
  });

  it('paginates with limit and before', async () => {
    await pollTimes(3);

    const firstPage = await getSnapshots('?limit=2');
    expect(firstPage).toHaveLength(2);

    const cursor = encodeURIComponent(firstPage[1]?.fetchedAt ?? '');
    const secondPage = await getSnapshots(`?limit=2&before=${cursor}`);
    expect(secondPage.map((s) => s.fetchedAt)).toEqual(['2026-09-10T12:00:00.000Z']);
  });

  it('rejects an invalid pagination query', async () => {
    const response = await ctx.app.inject({ url: '/api/competitors/acme-crm/snapshots?limit=0' });
    expect(response.statusCode).toBe(400);
  });

  it('lets only one poll run at a time across overlapping ticks', async () => {
    const [first, second] = await Promise.all([ctx.poller.pollAll(), ctx.poller.pollAll()]);

    expect([first.status, second.status].sort()).toEqual(['completed', 'skipped']);
    expect(await getSnapshots()).toHaveLength(1);
  });

  it('skips competitors removed between fetch and save', async () => {
    await ctx.app.inject({ method: 'DELETE', url: '/api/competitors/acme-crm' });
    expect(await ctx.poller.pollCompetitor('acme-crm')).toBeNull();
  });
});
