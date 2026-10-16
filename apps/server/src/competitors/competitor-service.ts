import type { Database } from '../db/client.js';
import { ConflictError, NotFoundError, UnknownCompetitorError } from '../errors.js';
import type { ListingSource } from '../listing-source/listing-source.js';
import {
  competitorExists,
  deleteCompetitor,
  insertCompetitor,
  listCompetitorIds,
} from './competitor-repository.js';

export class CompetitorService {
  constructor(
    private readonly db: Database,
    private readonly source: ListingSource,
  ) {}

  list(): Promise<string[]> {
    return listCompetitorIds(this.db);
  }

  /** `id` must already be normalized by the transport layer. */
  async track(id: string): Promise<void> {
    if (!(await this.source.hasCompetitor(id))) throw new UnknownCompetitorError(id);
    if (!(await insertCompetitor(this.db, id))) {
      throw new ConflictError(`Competitor "${id}" is already tracked`);
    }
  }

  async untrack(id: string): Promise<void> {
    if (!(await deleteCompetitor(this.db, id))) throw notTracked(id);
  }

  async assertTracked(id: string): Promise<void> {
    if (!(await competitorExists(this.db, id))) throw notTracked(id);
  }
}

const notTracked = (id: string) => new NotFoundError(`Competitor "${id}" is not tracked`);
