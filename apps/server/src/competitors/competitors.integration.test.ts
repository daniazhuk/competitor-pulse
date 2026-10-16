import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../test/test-context.js';

describe('competitors API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = createTestContext();
    await ctx.reset();
  });
  afterEach(() => ctx.close());

  const track = (id: unknown) =>
    ctx.app.inject({ method: 'POST', url: '/api/competitors', payload: { id } });

  it('tracks a competitor with a normalized id and lists it', async () => {
    const created = await track('  ACME-crm ');

    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({ id: 'acme-crm' });
    expect(ctx.initialPolls).toEqual(['acme-crm']);

    const list = await ctx.app.inject({ method: 'GET', url: '/api/competitors' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([{ id: 'acme-crm' }]);
  });

  it('rejects duplicates with 409', async () => {
    await track('acme-crm');
    const duplicate = await track('acme-crm');

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({
      error: { code: 'CONFLICT', message: 'Competitor "acme-crm" is already tracked' },
    });
  });

  it('rejects ids the listing source does not know with 422', async () => {
    const response = await track('unknown-co');

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: 'UNKNOWN_COMPETITOR' } });
  });

  it.each([{ id: 'not a slug' }, { id: 42 }, {}])(
    'rejects invalid body %j with 400',
    async (payload) => {
      const response = await ctx.app.inject({ method: 'POST', url: '/api/competitors', payload });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    },
  );

  it('removes a competitor together with its snapshots', async () => {
    await track('acme-crm');
    await ctx.poller.pollCompetitor('acme-crm');

    const removed = await ctx.app.inject({ method: 'DELETE', url: '/api/competitors/acme-crm' });
    expect(removed.statusCode).toBe(204);
    expect(removed.body).toBe('');

    const snapshots = await ctx.app.inject({ url: '/api/competitors/acme-crm/snapshots' });
    expect(snapshots.statusCode).toBe(404);

    const again = await ctx.app.inject({ method: 'DELETE', url: '/api/competitors/acme-crm' });
    expect(again.statusCode).toBe(404);
  });
});
