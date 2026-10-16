import { readFile } from 'node:fs/promises';
import { listingSchema, type Listing } from '@competitor-pulse/contract';
import { z } from 'zod';
import type { ListingSource } from './listing-source.js';

const fixturesSchema = z.record(z.string(), z.array(listingSchema).min(1));
export type ListingFixtures = z.infer<typeof fixturesSchema>;

/**
 * In-process stand-in for a competitor's website: each fetch returns the next
 * version in the sequence and keeps repeating the last one once exhausted.
 * The cursor lives in memory on purpose — it simulates external state, not ours.
 */
export class FixtureListingSource implements ListingSource {
  private readonly cursors = new Map<string, number>();

  constructor(private readonly fixtures: ListingFixtures) {}

  static async fromFile(path: string): Promise<FixtureListingSource> {
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    return new FixtureListingSource(fixturesSchema.parse(raw));
  }

  hasCompetitor(id: string): Promise<boolean> {
    return Promise.resolve(Object.hasOwn(this.fixtures, id));
  }

  fetchListing(id: string): Promise<Listing> {
    const versions = this.fixtures[id];
    if (!versions) {
      return Promise.reject(new Error(`No fixture listings for competitor "${id}"`));
    }

    const cursor = this.cursors.get(id) ?? 0;
    const lastIndex = versions.length - 1;
    this.cursors.set(id, Math.min(cursor + 1, lastIndex));

    // Index is clamped to the array bounds, so a version always exists.
    const listing = versions[Math.min(cursor, lastIndex)] as Listing;
    return Promise.resolve(structuredClone(listing));
  }
}
