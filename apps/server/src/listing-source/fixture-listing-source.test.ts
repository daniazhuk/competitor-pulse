import { describe, expect, it } from 'vitest';
import { FixtureListingSource } from './fixture-listing-source.js';

const listing = (price: string) => ({ title: 'T', tagline: 'G', price, description: 'D' });

describe('FixtureListingSource', () => {
  const createSource = () =>
    new FixtureListingSource({ acme: [listing('$1'), listing('$2')], other: [listing('$9')] });

  it('advances through versions and repeats the last one', async () => {
    const source = createSource();
    const prices = [];
    for (let i = 0; i < 4; i += 1) prices.push((await source.fetchListing('acme')).price);
    expect(prices).toEqual(['$1', '$2', '$2', '$2']);
  });

  it('keeps an independent cursor per competitor', async () => {
    const source = createSource();
    await source.fetchListing('acme');
    expect((await source.fetchListing('other')).price).toBe('$9');
    expect((await source.fetchListing('acme')).price).toBe('$2');
  });

  it('knows which competitors it can serve', async () => {
    const source = createSource();
    expect(await source.hasCompetitor('acme')).toBe(true);
    expect(await source.hasCompetitor('unknown')).toBe(false);
    await expect(source.fetchListing('unknown')).rejects.toThrow('unknown');
  });
});
