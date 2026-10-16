import type { Listing } from '@competitor-pulse/contract';

/** Where competitor listings come from. Production would scrape or call an API. */
export interface ListingSource {
  hasCompetitor(id: string): Promise<boolean>;
  fetchListing(id: string): Promise<Listing>;
}
